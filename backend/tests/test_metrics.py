import numpy as np

from shiftload import metrics
from shiftload.expected_hr import ExpectedHRModel

NAN = float("nan")


def band(**kw):
    base = dict(mean_pct_hrr=15.0, longest_no_break_min=120, breaks_uncertain=False,
                coverage_pct=95.0, max_gap_min=5, shift_len_min=720, amber_threshold=240)
    base.update(kw)
    return metrics.band_shift(**base)


def test_hr_max_tanaka():
    assert metrics.hr_max(1990, 2026) == 208 - 0.7 * 36


def test_coverage_and_gap():
    hr = np.array([70, 70, NAN, NAN, NAN, 70, NAN, 70, 70, 70])
    cov, gap = metrics.coverage(hr)
    assert cov == 60.0 and gap == 3


def test_gap_never_counts_as_break():
    steps = np.zeros(60)
    pct = np.full(60, 5.0)
    pct[10:50] = NAN  # watch off: still, but no HR
    assert metrics.suggest_breaks(steps, pct) == []


def test_suggested_break_needs_low_load():
    steps = np.zeros(40)
    assert metrics.suggest_breaks(steps, np.full(40, 5.0)) == [(0, 40)]
    # stationary effort is not a break
    assert metrics.suggest_breaks(steps, np.full(40, 35.0)) == []


def test_longest_no_break():
    assert metrics.longest_no_break(720, []) == 720
    assert metrics.longest_no_break(720, [(340, 370), (550, 580)]) == 340
    assert metrics.longest_no_break(720, [(100, 130)]) == 590


def test_window_needs_four_valid_minutes():
    hr = np.array([80, 80, 80, NAN, NAN, 80, 80, 80, 80, NAN])
    steps = np.zeros(10)
    pm = metrics.compute_minutes(hr, steps, 60, 180, ExpectedHRModel())
    w = metrics.compute_windows(hr, steps, pm)
    assert w[0]["pct_hrr"] is None and w[0]["valid_minutes"] == 3
    assert w[1]["pct_hrr"] is not None and w[1]["valid_minutes"] == 4


def test_stationary_effort_raises_physical_load_not_unexplained():
    # HR 125 with zero steps: %HRR = 65/120 = 54% -> above the 30% gate
    hr = np.full(10, 125.0)
    steps = np.zeros(10)
    pm = metrics.compute_minutes(hr, steps, 60, 180, ExpectedHRModel())
    w = metrics.compute_windows(hr, steps, pm)
    assert pm["pct_hrr"][0] > 50
    assert not any(x["unexplained"] for x in w)


def test_moderate_elevation_while_still_is_unexplained():
    # HR 85 with zero steps: %HRR 21%, residual 85 - 65 = 20 bpm
    hr = np.full(10, 85.0)
    steps = np.zeros(10)
    pm = metrics.compute_minutes(hr, steps, 60, 180, ExpectedHRModel())
    w = metrics.compute_windows(hr, steps, pm)
    assert all(x["unexplained"] for x in w)
    assert metrics.shift_metrics(hr, steps, pm, w)["unexplained_hr_min"] == 10


def test_walking_is_explained():
    hr = np.full(10, 95.0)
    steps = np.full(10, 100.0)
    pm = metrics.compute_minutes(hr, steps, 60, 180, ExpectedHRModel())
    assert not pm["unexplained"].any()


def test_bands_green_amber_red():
    assert band()["band"] == "green"
    assert band(mean_pct_hrr=25.0)["band"] == "amber"
    assert band(mean_pct_hrr=33.0)["band"] == "red"
    assert band(longest_no_break_min=250)["band"] == "amber"
    assert band(longest_no_break_min=300)["band"] == "red"


def test_missing_data_is_never_green():
    assert band(coverage_pct=60.0)["band"] == "insufficient"
    assert band(max_gap_min=61)["band"] == "insufficient"
    assert band(coverage_pct=60.0, mean_pct_hrr=25.0)["band"] == "insufficient"


def test_missing_data_does_not_lower_red():
    assert band(coverage_pct=40.0, mean_pct_hrr=35.0)["band"] == "red"
    assert band(coverage_pct=40.0, longest_no_break_min=320)["band"] == "red"
    assert band(coverage_pct=40.0, shift_len_min=780)["band"] == "red"


def test_uncertain_breaks_are_grey_unless_red():
    assert band(breaks_uncertain=True)["band"] == "insufficient"
    assert band(breaks_uncertain=True, longest_no_break_min=310)["band"] == "red"
