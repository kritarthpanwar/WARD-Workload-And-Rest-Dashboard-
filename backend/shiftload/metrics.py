"""Pure shift metrics and banding (spec section 8). No I/O.

A shift is two per-minute arrays indexed from shift start:
  hr     mean heart rate for the minute, NaN when the minute has no HR sample
  steps  steps in the minute
"""
import numpy as np

from . import config
from .expected_hr import ExpectedHRModel

ORDER = {"green": 0, "amber": 1, "red": 2}


def hr_max(birth_year: int, year: int) -> float:
    """Tanaka: 208 - 0.7 x age."""
    return 208.0 - 0.7 * (year - birth_year)


def lowest_5min_hr(hr: np.ndarray) -> float | None:
    """Lowest mean over 5 consecutive valid minutes."""
    best = None
    for i in range(len(hr) - 4):
        chunk = hr[i : i + 5]
        if not np.isnan(chunk).any():
            m = float(chunk.mean())
            best = m if best is None else min(best, m)
    return best


def shift_hr_rest(history_rest: float | None, hr: np.ndarray) -> float | None:
    """Lower of the 30-day resting HR and the lowest 5-min HR in the shift."""
    candidates = [v for v in (history_rest, lowest_5min_hr(hr)) if v is not None]
    return min(candidates) if candidates else None


def runs(mask: np.ndarray) -> list[tuple[int, int]]:
    """[start, end) of each run of True."""
    out, start = [], None
    for i, v in enumerate(mask):
        if v and start is None:
            start = i
        elif not v and start is not None:
            out.append((start, i))
            start = None
    if start is not None:
        out.append((start, len(mask)))
    return out


def coverage(hr: np.ndarray) -> tuple[float, int]:
    """(% of minutes with HR, longest run of minutes without HR)."""
    if len(hr) == 0:
        return 0.0, 0
    invalid = np.isnan(hr)
    gaps = [e - s for s, e in runs(invalid)]
    return 100.0 * (1 - invalid.mean()), max(gaps, default=0)


def suggest_breaks(steps: np.ndarray, pct_hrr: np.ndarray) -> list[tuple[int, int]]:
    """Sedentary runs with HR present and low load. A gap never counts as a break."""
    still = (~np.isnan(pct_hrr)) & (steps < config.SEDENTARY_STEPS)
    out = []
    for s, e in runs(still):
        if e - s >= config.BREAK_MIN_LEN and pct_hrr[s:e].mean() < config.BREAK_MAX_PCT_HRR:
            out.append((s, e))
    return out


def longest_no_break(shift_len: int, breaks: list[tuple[int, int]]) -> int:
    """Longest stretch between shift start / a break end and the next break start / shift end."""
    longest, cursor = 0, 0
    for s, e in sorted(breaks):
        longest = max(longest, s - cursor)
        cursor = max(cursor, e)
    return max(longest, shift_len - cursor)


def longest_on_feet(steps: np.ndarray, valid: np.ndarray) -> int:
    """Longest run without a sedentary gap of 10+ minutes. Non-wear is not rest."""
    sedentary = valid & (steps < config.SEDENTARY_STEPS)
    gaps = [(s, e) for s, e in runs(sedentary) if e - s >= config.SEDENTARY_GAP_MIN]
    return longest_no_break(len(steps), gaps)


def compute_minutes(hr, steps, hr_rest: float, hr_max_: float, model: ExpectedHRModel) -> dict:
    hr = np.asarray(hr, dtype=float)
    steps = np.asarray(steps, dtype=float)
    reserve = max(hr_max_ - hr_rest, 1.0)
    pct_hrr = np.clip((hr - hr_rest) / reserve * 100.0, 0, None)
    expected = hr_rest + model.predict_excess(steps)
    residual = hr - expected
    with np.errstate(invalid="ignore"):
        unexplained = (
            (residual > config.RESIDUAL_THRESHOLD_BPM)
            & (pct_hrr < config.HRR_HIGH)
            & (steps < config.LOW_MOTION_STEPS)
        )
    return {"pct_hrr": pct_hrr, "expected": expected, "residual": residual,
            "unexplained": unexplained}


def compute_windows(hr, steps, per_minute: dict) -> list[dict]:
    """5-minute windows. A window is scored only with >= 4 valid minutes."""
    hr = np.asarray(hr, dtype=float)
    steps = np.asarray(steps, dtype=float)
    out = []
    for start in range(0, len(hr), config.WINDOW_MIN):
        sl = slice(start, start + config.WINDOW_MIN)
        valid = ~np.isnan(hr[sl])
        n_valid = int(valid.sum())
        w = {"offset_min": start, "valid_minutes": n_valid, "steps": int(steps[sl].sum()),
             "hr_mean": None, "pct_hrr": None, "hr_expected": None, "hr_excess": None,
             "unexplained": None}
        if n_valid >= config.WINDOW_MIN_VALID:
            w["hr_mean"] = float(hr[sl][valid].mean())
            w["pct_hrr"] = float(per_minute["pct_hrr"][sl][valid].mean())
            w["hr_expected"] = float(per_minute["expected"][sl][valid].mean())
            w["hr_excess"] = float(per_minute["residual"][sl][valid].mean())
            w["unexplained"] = bool(
                per_minute["unexplained"][sl][valid].sum() >= config.UNEXPLAINED_MIN_OF_5
            )
        out.append(w)
    return out


def shift_metrics(hr, steps, per_minute: dict, windows: list[dict]) -> dict:
    hr = np.asarray(hr, dtype=float)
    steps = np.asarray(steps, dtype=float)
    valid = ~np.isnan(hr)
    cov, gap = coverage(hr)
    pct = per_minute["pct_hrr"]
    return {
        "coverage_pct": round(cov, 1),
        "max_gap_min": gap,
        "mean_pct_hrr": round(float(pct[valid].mean()), 1) if valid.any() else None,
        "min_above_30_hrr": int((pct[valid] >= config.HRR_HIGH).sum()),
        "time_on_feet_min": int((steps > 0).sum()),
        "longest_on_feet_min": longest_on_feet(steps, valid),
        "unexplained_hr_min": config.WINDOW_MIN * sum(1 for w in windows if w["unexplained"]),
    }


def phys_band(mean_pct_hrr: float | None) -> str:
    if mean_pct_hrr is None:
        return "insufficient"
    if mean_pct_hrr >= config.PHYS_RED:
        return "red"
    if mean_pct_hrr >= config.PHYS_AMBER:
        return "amber"
    return "green"


def recovery_band(longest_no_break_min: int, amber_threshold: float, breaks_uncertain: bool) -> str:
    if longest_no_break_min >= config.NO_BREAK_RED_MIN:
        return "red"
    if breaks_uncertain:
        return "insufficient"
    if longest_no_break_min >= amber_threshold:
        return "amber"
    return "green"


def band_shift(*, mean_pct_hrr, longest_no_break_min, breaks_uncertain, coverage_pct,
               max_gap_min, shift_len_min, amber_threshold) -> dict:
    """Two domains, worse wins. Missing data can raise a band, never lower it."""
    insufficient = coverage_pct < config.COVERAGE_MIN_PCT or max_gap_min > config.MAX_GAP_MIN
    phys = phys_band(mean_pct_hrr)
    if insufficient and phys != "red":
        phys = "insufficient"
    rec = recovery_band(longest_no_break_min, amber_threshold, breaks_uncertain)
    hard_red = (
        longest_no_break_min >= config.NO_BREAK_RED_MIN
        or shift_len_min > config.MAX_SHIFT_HOURS * 60
    )
    if hard_red or "red" in (phys, rec):
        band = "red"
    elif "insufficient" in (phys, rec):
        band = "insufficient"
    else:
        band = max(phys, rec, key=ORDER.get)
    return {"phys_band": phys, "recovery_band": rec, "band": band}
