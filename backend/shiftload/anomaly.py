"""Pure anomaly detection: robust z against the previous 28 days (spec 10.1)."""
from datetime import timedelta

import numpy as np
import pandas as pd

from . import config

METRICS = ["pct_red", "pct_no_break_5h", "mean_pct_hrr", "unexplained_hr_min", "pct_insufficient"]


def daily_series(shifts: pd.DataFrame) -> pd.DataFrame:
    """Exact daily values per (unit_id, shift_type). shifts needs a `day` column."""
    d = shifts.assign(
        red=(shifts["band"] == "red") * 100.0,
        insufficient=(shifts["band"] == "insufficient") * 100.0,
        no_break=(shifts["longest_no_break_min"] >= config.NO_BREAK_RED_MIN) * 100.0,
    )
    g = d.groupby(["unit_id", "shift_type", "day"])
    return g.agg(
        n=("nurse_pid", "nunique"),
        coverage=("coverage_pct", "mean"),
        pct_red=("red", "mean"),
        pct_no_break_5h=("no_break", "mean"),
        mean_pct_hrr=("mean_pct_hrr", "mean"),
        unexplained_hr_min=("unexplained_hr_min", "mean"),
        pct_insufficient=("insufficient", "mean"),
    ).reset_index()


def detect(daily: pd.DataFrame, z_threshold: float = config.ANOMALY_Z) -> pd.DataFrame:
    """Rows of (unit_id, shift_type, day, metric, value, median, z, ratio) for flagged days."""
    out = []
    eligible = daily[
        (daily["n"] >= config.ANOMALY_MIN_N) & (daily["coverage"] >= config.ANOMALY_MIN_COVERAGE)
    ]
    for (unit, stype), grp in eligible.groupby(["unit_id", "shift_type"]):
        grp = grp.sort_values("day")
        days = grp["day"].to_numpy()
        for metric in METRICS:
            values = grp[metric].to_numpy(dtype=float)
            for i, day in enumerate(days):
                lo = day - timedelta(days=config.ANOMALY_HISTORY_DAYS)
                hist = values[(days >= lo) & (days < day)]
                if len(hist) < config.ANOMALY_MIN_HISTORY:
                    continue
                median = float(np.median(hist))
                mad = float(np.median(np.abs(hist - median)))
                if mad == 0:
                    continue
                z = (values[i] - median) / (1.4826 * mad)
                if abs(z) >= z_threshold:
                    out.append({
                        "unit_id": unit, "shift_type": stype, "day": day, "metric": metric,
                        "value": float(values[i]), "median": median, "z": float(z),
                        "ratio": float(values[i] / median) if median else None,
                    })
    return pd.DataFrame(out, columns=["unit_id", "shift_type", "day", "metric", "value",
                                      "median", "z", "ratio"])


def ratio_label(ratio: float | None, direction: str) -> str:
    """Rounded wording for managers, e.g. "about 3× usual"."""
    if ratio is None or not np.isfinite(ratio):
        return "above usual" if direction == "up" else "below usual"
    if ratio >= 1.25:
        r = round(ratio * 2) / 2 if ratio < 3 else round(ratio)
        return f"about {r:g}× usual"
    if ratio <= 0.6:
        return "about half usual" if ratio > 0.35 else "well below usual"
    return "above usual" if direction == "up" else "below usual"


def weekly_flags(anomalies: pd.DataFrame) -> pd.DataFrame:
    """Collapse daily anomalies to one flag per (unit, shift_type, week, metric)."""
    cols = ["unit_id", "shift_type", "week_start", "metric", "direction", "ratio_rounded"]
    if anomalies.empty:
        return pd.DataFrame(columns=cols)
    a = anomalies.assign(
        week_start=anomalies["day"].map(lambda d: d - timedelta(days=d.weekday())),
        absz=anomalies["z"].abs(),
    )
    top = a.sort_values("absz").groupby(["unit_id", "shift_type", "week_start", "metric"]).tail(1)
    top = top.assign(direction=np.where(top["z"] > 0, "up", "down"))
    top["ratio_rounded"] = [ratio_label(r, d) for r, d in zip(top["ratio"], top["direction"])]
    return top[cols].reset_index(drop=True)
