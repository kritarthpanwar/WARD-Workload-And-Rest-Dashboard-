from datetime import date, timedelta

import numpy as np
import pandas as pd

from shiftload import anomaly, privacy, synthetic


def cohort(n):
    return privacy.hash_cohort(f"nurse-{i}" for i in range(n))


def test_membership_rule():
    a = cohort(8)
    assert not privacy.membership_violation(a, a)                 # identical
    assert privacy.membership_violation(a, cohort(7))             # differs by 1
    assert privacy.membership_violation(a, cohort(12))            # differs by 4
    assert not privacy.membership_violation(a, cohort(13))        # differs by 5


def test_cell_status_order():
    a = cohort(8)
    assert privacy.cell_status(4, cohort(4), [], 80, 90) == "suppressed_k"
    assert privacy.cell_status(8, a, [cohort(7)], 80, 90) == "suppressed_membership"
    assert privacy.cell_status(8, a, [a], 30, 90) == "not_representative"
    assert privacy.cell_status(8, a, [a], 80, 40) == "quality_gate"
    assert privacy.cell_status(8, a, [a], 80, 90) == "released"


def test_round10():
    assert privacy.round10(0.24) == 20
    assert privacy.round10(0.26) == 30
    assert privacy.round10(1.4) == 100
    assert privacy.round10(-0.2) == 0


def test_cell_noise_is_deterministic():
    a = privacy.cell_rng("4west", "2026-09-21", "day", 60).laplace()
    b = privacy.cell_rng("4west", "2026-09-21", "day", 60).laplace()
    c = privacy.cell_rng("4west", "2026-09-21", "night", 60).laplace()
    assert a == b and a != c


def test_build_cell_outputs_are_rounded():
    df = pd.DataFrame({
        "nurse_pid": [f"n{i % 6}" for i in range(18)],
        "band": ["red"] * 6 + ["green"] * 9 + ["insufficient"] * 3,
        "longest_no_break_min": [320] * 6 + [200] * 12,
        "ratio_status": ["met"] * 18,
        "breaks_uncertain": [False] * 18,
        "mean_pct_hrr": [26.0] * 18,
        "coverage_pct": [91.0] * 18,
    })
    cell = privacy.build_cell(df, privacy.cell_rng("t"))
    for key in ("pct_red_low", "pct_red_high", "pct_insufficient", "pct_no_break_5h",
                "pct_ratio_met_and_breaks", "coverage_pct"):
        assert cell[key] % 10 == 0 and 0 <= cell[key] <= 100
    assert cell["pct_red_high"] >= cell["pct_red_low"] or cell["pct_insufficient"] == 0
    assert cell["phys_load_band"] == "amber"


def _daily(values):
    start = date(2026, 7, 6)
    return pd.DataFrame({
        "unit_id": "u", "shift_type": "day",
        "day": [start + timedelta(days=i) for i in range(len(values))],
        "n": 8, "coverage": 90.0,
        "pct_red": values, "pct_no_break_5h": 10.0, "mean_pct_hrr": 20.0,
        "unexplained_hr_min": 20.0, "pct_insufficient": 0.0,
    })


def test_detect_flags_spike_and_skips_flat_series():
    rng = np.random.default_rng(0)
    values = list(20 + rng.normal(0, 2, 30))
    values[25] = 60.0
    found = anomaly.detect(_daily(values))
    assert set(found["metric"]) == {"pct_red"}          # flat metrics have MAD = 0
    assert date(2026, 7, 6) + timedelta(days=25) in set(found["day"])


def test_detect_needs_14_days_history():
    values = [20.0, 21.0, 19.0, 22.0, 18.0, 90.0]
    assert anomaly.detect(_daily(values)).empty


def test_ratio_label():
    assert anomaly.ratio_label(3.1, "up") == "about 3× usual"
    assert anomaly.ratio_label(1.6, "up") == "about 1.5× usual"
    assert anomaly.ratio_label(1.1, "up") == "above usual"
    assert anomaly.ratio_label(0.5, "down") == "about half usual"


def test_synthetic_is_reproducible_and_never_green_when_missing():
    a = synthetic.generate(3, date(2026, 9, 27))
    b = synthetic.generate(3, date(2026, 9, 27))
    assert a["shifts"]["mean_pct_hrr"].equals(b["shifts"]["mean_pct_hrr"])
    s = a["shifts"]
    missing = (s["coverage_pct"] < 70) | (s["max_gap_min"] > 60)
    assert not (s[missing]["band"].isin(["green", "amber"])).any()
    assert len(a["answer_key"]) == 8
    assert synthetic.generate(3, date(2026, 9, 27), n_anomalies=0)["answer_key"] == []
