"""Synthetic unit cohort (spec section 9). Pure: returns DataFrames, no I/O.

Everything produced here is invented data for demonstrating the unit views.
Unit ordering for physical load follows ER > ICU > surgical > medical.
"""
import uuid
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd

from . import config
from .metrics import band_shift

TZ = ZoneInfo("America/Vancouver")

UNITS = [
    # unit_id, name, roster, mean %HRR, P(no break >= 5h), P(ratio met), unexplained windows
    ("er", "ER", 40, 27.0, 0.16, 0.50, 6.0),
    ("icu2", "ICU 2", 22, 24.0, 0.10, 0.70, 5.0),
    ("5east", "5 East Med-Surg", 34, 22.0, 0.09, 0.60, 4.0),
    ("4west", "4 West Med-Surg", 36, 21.0, 0.08, 0.60, 4.0),
]
HOSPITAL = "Synthetic General Hospital"
DRIFT_UNIT = "4west"          # given a worse last month
ANOMALY_SIZES = {
    "mean_pct_hrr": {"small": 2.0, "moderate": 5.0, "large": 9.0},          # added points
    "pct_no_break_5h": {"small": 0.4, "moderate": 0.65, "large": 0.9},      # share of shifts
    "pct_red": {"small": 0.4, "moderate": 0.65, "large": 0.9},
    "pct_insufficient": {"small": 0.4, "moderate": 0.65, "large": 0.9},
    "unexplained_hr_min": {"small": 1.5, "moderate": 2.5, "large": 4.0},    # multiplier
}


def last_complete_week_end(today: date) -> date:
    """Sunday of the most recent complete Monday-Sunday week."""
    return today - timedelta(days=today.weekday() + 1)


def generate(seed: int, end_date: date, n_days: int = 84, n_anomalies: int = 8,
             drift: bool = True) -> dict:
    """Build a cohort. n_anomalies=0 and drift=False gives the null cohort."""
    rng = np.random.default_rng(seed)
    start_date = end_date - timedelta(days=n_days - 1)

    units = pd.DataFrame(
        [(u[0], u[1], HOSPITAL, u[2]) for u in UNITS],
        columns=["unit_id", "name", "hospital", "roster_size"],
    )

    nurse_rows = []
    for unit_id, _, roster, *_ in UNITS:
        # stratified ranks: scenario p keeps p% of each unit's roster
        ranks = (rng.permutation(roster) + 0.5) / roster
        for i in range(roster):
            kind = rng.choice(["day", "night", "rotating"], p=[0.5, 0.35, 0.15])
            nurse_rows.append({
                "nurse_pid": str(uuid.UUID(bytes=rng.bytes(16), version=4)),
                "unit_id": unit_id,
                "birth_year": int(rng.integers(1966, 2003)),
                "hr_rest": float(np.round(rng.normal(64, 6), 1)),
                "rotation": kind,
                "offset": int(rng.integers(0, 8)),
                "hrr_effect": float(rng.normal(0, 2.5)),
                "participation_rank": float(ranks[i]),
                # a few nurses opt in part-way through, which churns cohorts
                "join_day": int(rng.integers(7, n_days - 14)) if rng.random() < 0.06 else 0,
            })
    nurses = pd.DataFrame(nurse_rows)
    unit_params = {u[0]: u for u in UNITS}

    rows = []
    for nurse in nurse_rows:
        _, _, _, mu, p_nb, p_ratio, lam = unit_params[nurse["unit_id"]]
        on_leave_week = None
        for d in range(nurse["join_day"], n_days):
            day = start_date + timedelta(days=d)
            if day.weekday() == 0 or on_leave_week is None:
                on_leave_week = rng.random() < 0.012
            phase = (d + nurse["offset"]) % 8          # 4 on, 4 off
            if phase >= 4 or on_leave_week or rng.random() < 0.03:
                continue
            if nurse["rotation"] == "rotating":
                shift_type = "day" if phase < 2 else "night"
            else:
                shift_type = nurse["rotation"]
            late = drift and nurse["unit_id"] == DRIFT_UNIT and d >= n_days - 28
            rows.append({
                "nurse_pid": nurse["nurse_pid"], "unit_id": nurse["unit_id"], "day": day,
                "shift_type": shift_type,
                "mu": mu + nurse["hrr_effect"] - (1.0 if shift_type == "night" else 0.0)
                + (4.0 if late else 0.0),
                "p_nb": p_nb + (0.08 if shift_type == "night" else 0.0) + (0.15 if late else 0.0),
                "p_ratio": p_ratio - (0.2 if late else 0.0),
                "lam": lam,
            })
    s = pd.DataFrame(rows)
    n = len(s)

    s["mean_pct_hrr"] = rng.normal(s["mu"], 3.0)
    no_break = rng.random(n) < s["p_nb"]
    s["longest_no_break_min"] = np.where(
        no_break, rng.uniform(300, 460, n), np.clip(rng.normal(205, 40, n), 80, 295)
    )
    bad = rng.random(n) < 0.06
    s["coverage_pct"] = np.where(
        bad, rng.uniform(30, 69, n), np.clip(100 - rng.gamma(2.0, 3.0, n), 70, 100)
    )
    s["max_gap_min"] = np.where(bad, rng.uniform(20, 150, n), rng.uniform(0, 25, n))
    overtime = rng.random(n) < 0.03
    s["shift_len_min"] = np.where(
        overtime, rng.uniform(760, 840, n), np.clip(rng.normal(725, 10, n), 690, 748)
    )
    s["unexplained_hr_min"] = 5.0 * rng.poisson(s["lam"])
    s["breaks_uncertain"] = rng.random(n) < 0.08
    r = rng.random(n)
    s["ratio_status"] = np.where(r < 0.1, "unknown", np.where(r < 0.1 + 0.9 * s["p_ratio"], "met", "not_met"))
    s["time_on_feet_min"] = np.clip(rng.normal(250 + 6.0 * s["mu"], 40), 120, 640)
    s["longest_on_feet_min"] = np.clip(rng.normal(150, 40, n), 40, 400)

    answer_key = _plant(s, rng, n_days, start_date, n_anomalies)

    s["mean_pct_hrr"] = s["mean_pct_hrr"].clip(4, 60).round(1)
    s["min_above_30_hrr"] = np.clip((s["mean_pct_hrr"] - 15) * 14 + rng.normal(0, 30, n), 0, 700)
    s["n_breaks_confirmed"] = np.where(
        s["breaks_uncertain"], 0, np.where(s["longest_no_break_min"] >= 300, rng.integers(0, 2, n), rng.integers(1, 4, n))
    )
    answered = rng.random(n) < 0.6
    drained = 2 + 0.12 * s["mean_pct_hrr"] + 0.008 * s["longest_no_break_min"] + rng.normal(0, 1.5, n)
    s["drained_rating"] = np.where(answered, np.clip(np.round(drained), 1, 10), np.nan)

    # amber threshold: 80th percentile of each nurse's own no-break history
    p80 = s.groupby("nurse_pid")["longest_no_break_min"].transform(
        lambda v: np.percentile(v, config.NO_BREAK_AMBER_PERCENTILE)
    )
    bands = [
        band_shift(mean_pct_hrr=a, longest_no_break_min=b, breaks_uncertain=c, coverage_pct=d,
                   max_gap_min=e, shift_len_min=f, amber_threshold=g)
        for a, b, c, d, e, f, g in zip(
            s["mean_pct_hrr"], s["longest_no_break_min"], s["breaks_uncertain"],
            s["coverage_pct"], s["max_gap_min"], s["shift_len_min"], p80)
    ]
    s["phys_band"] = [b["phys_band"] for b in bands]
    s["recovery_band"] = [b["recovery_band"] for b in bands]
    s["band"] = [b["band"] for b in bands]

    for col in ["longest_no_break_min", "max_gap_min", "shift_len_min", "time_on_feet_min",
                "longest_on_feet_min", "min_above_30_hrr", "unexplained_hr_min"]:
        s[col] = s[col].round().astype(int)
    s["coverage_pct"] = s["coverage_pct"].round(1)
    s["week_start"] = s["day"].map(lambda d: d - timedelta(days=d.weekday()))
    s["shift_id"] = [str(uuid.UUID(bytes=rng.bytes(16), version=4)) for _ in range(n)]
    start_hour = np.where(s["shift_type"] == "day", 7, 19)
    s["start_ts"] = [datetime.combine(d, time(int(h)), TZ) for d, h in zip(s["day"], start_hour)]
    s["end_ts"] = [t + timedelta(minutes=int(m)) for t, m in zip(s["start_ts"], s["shift_len_min"])]

    # counters carry no nurse id: only unit-week totals leave this function
    reported = (s["band"] == "red") & (rng.random(n) < 0.15)
    relief = (s["longest_no_break_min"] >= 300) & (rng.random(n) < 0.3)
    report_counts = s[reported].groupby(["unit_id", "week_start"]).size().rename("reports_sent").reset_index()
    relief_counts = s[relief].groupby(["unit_id", "week_start"]).size().rename("n").reset_index()

    return {
        "units": units,
        "nurses": nurses.drop(columns=["offset", "hrr_effect", "join_day"]),
        "shifts": s.drop(columns=["mu", "p_nb", "p_ratio", "lam"]),
        "report_counts": report_counts,
        "relief_counts": relief_counts,
        "answer_key": answer_key,
    }


def _plant(s: pd.DataFrame, rng, n_days: int, start_date: date, n_anomalies: int) -> list[dict]:
    """Plant anomalies on random unit-day-shift cells after the 28-day warm-up."""
    key = []
    cells = s[s["day"] >= start_date + timedelta(days=28)][["unit_id", "shift_type", "day"]]
    cells = cells.drop_duplicates().reset_index(drop=True)
    if n_anomalies == 0 or cells.empty:
        return key
    picks = rng.choice(len(cells), size=min(n_anomalies, len(cells)), replace=False)
    for idx in picks:
        cell = cells.iloc[int(idx)]
        metric = str(rng.choice(list(ANOMALY_SIZES)))
        size = str(rng.choice(["small", "moderate", "large"]))
        amount = ANOMALY_SIZES[metric][size]
        mask = (
            (s["unit_id"] == cell["unit_id"]) & (s["shift_type"] == cell["shift_type"])
            & (s["day"] == cell["day"])
        ).to_numpy()
        hit = mask & (rng.random(len(s)) < amount)
        if metric == "mean_pct_hrr":
            s.loc[mask, "mean_pct_hrr"] += amount
        elif metric == "unexplained_hr_min":
            s.loc[mask, "unexplained_hr_min"] = (s.loc[mask, "unexplained_hr_min"] + 5) * amount
        elif metric == "pct_no_break_5h":
            s.loc[hit, "longest_no_break_min"] = rng.uniform(300, 460, int(hit.sum()))
        elif metric == "pct_red":
            s.loc[hit, "mean_pct_hrr"] = rng.uniform(34, 42, int(hit.sum()))
        elif metric == "pct_insufficient":
            s.loc[hit, "coverage_pct"] = rng.uniform(30, 65, int(hit.sum()))
        key.append({"unit_id": cell["unit_id"], "shift_type": cell["shift_type"],
                    "day": cell["day"], "metric": metric, "size": size})
    return key


def participants(nurses: pd.DataFrame, scenario: int) -> set[str]:
    return set(nurses[nurses["participation_rank"] < scenario / 100.0]["nurse_pid"])
