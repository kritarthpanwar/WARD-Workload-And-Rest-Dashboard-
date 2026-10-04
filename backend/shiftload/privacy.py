"""Pure release-layer privacy rules (spec section 3). No I/O."""
import hashlib

import numpy as np
import pandas as pd

from . import config
from .metrics import phys_band


def hash_cohort(pids, salt: str = config.COHORT_HASH_SALT) -> frozenset[str]:
    return frozenset(
        hashlib.sha256(f"{salt}:{p}".encode()).hexdigest()[:16] for p in pids
    )


def membership_violation(a: frozenset, b: frozenset, k: int = config.K_MIN) -> bool:
    """True when two released cells would differ by 1..k-1 nurses (differencing risk)."""
    return 0 < len(a ^ b) < k


def round10(fraction: float) -> int:
    """Proportion in [0, 1] -> percent rounded to the nearest 10."""
    return int(round(min(max(fraction, 0.0), 1.0) * 10) * 10)


def cell_rng(*key) -> np.random.Generator:
    """Deterministic noise per cell, so re-running a release cannot average it out."""
    digest = hashlib.sha256(":".join(map(str, (config.COHORT_HASH_SALT, *key))).encode()).digest()
    return np.random.default_rng(int.from_bytes(digest[:8], "big"))


def noisy_count(count: float, rng, epsilon: float = config.LAPLACE_EPSILON) -> int:
    return max(0, int(round(count + rng.laplace(0, 1.0 / epsilon))))


def build_cell(df: pd.DataFrame, rng, epsilon: float = config.LAPLACE_EPSILON) -> dict:
    """Published values for one released cell.

    df: one row per shift with nurse_pid, band, longest_no_break_min, ratio_status,
    breaks_uncertain, mean_pct_hrr, coverage_pct.
    Each indicator is averaged per nurse first, so one nurse moves the sum of
    per-nurse rates by at most 1 (Laplace sensitivity = 1).
    """
    d = df.assign(
        red=df["band"] == "red",
        insufficient=df["band"] == "insufficient",
        no_break=df["longest_no_break_min"] >= config.NO_BREAK_RED_MIN,
        good=(df["ratio_status"] == "met")
        & (df["longest_no_break_min"] < config.NO_BREAK_RED_MIN)
        & ~df["breaks_uncertain"].astype(bool),
    )
    per_nurse = d.groupby("nurse_pid")[["red", "insufficient", "no_break", "good"]].mean()
    n = len(per_nurse)
    scale = 1.0 / epsilon

    def noisy_rate(col: str) -> float:
        return min(max((per_nurse[col].sum() + rng.laplace(0, scale)) / n, 0.0), 1.0)

    red, insufficient = noisy_rate("red"), noisy_rate("insufficient")
    known = max(1.0 - insufficient, 1e-9)
    shifts_per_nurse = len(d) / n
    return {
        # range: "missing = like observed" .. "missing = red"
        "pct_red_low": round10(red / known),
        "pct_red_high": round10(red + insufficient),
        "pct_insufficient": round10(insufficient),
        "pct_no_break_5h": round10(noisy_rate("no_break")),
        "pct_ratio_met_and_breaks": round10(noisy_rate("good")),
        "phys_load_band": phys_band(float(d["mean_pct_hrr"].mean())),
        "red_shifts_noised": max(0, int(round(red * n * shifts_per_nurse))),
        "coverage_pct": round10(float(d["coverage_pct"].mean()) / 100.0),
    }


def cell_status(n_nurses: int, cohort: frozenset, neighbours: list[frozenset],
                participation_pct: float, coverage_pct: float) -> str:
    """Decide whether a cell may be released. Order matters: privacy rules first."""
    if n_nurses < config.K_MIN:
        return "suppressed_k"
    if any(membership_violation(cohort, other) for other in neighbours):
        return "suppressed_membership"
    if participation_pct < config.PARTICIPATION_FLOOR_PCT:
        return "not_representative"
    if coverage_pct < config.QUALITY_GATE_COVERAGE_PCT:
        return "quality_gate"
    return "released"
