"""DB-backed shift pipeline for the nurse API: minutes -> windows -> metrics -> finalize."""
from collections import defaultdict
from datetime import datetime, timedelta, timezone

import numpy as np

from . import config, metrics
from .expected_hr import load_model
from .synthetic import TZ


def floor_minute(ts: datetime) -> datetime:
    return ts.astimezone(timezone.utc).replace(second=0, microsecond=0)


def shift_type_for(start: datetime) -> str:
    return "day" if 5 <= start.astimezone(TZ).hour < 17 else "night"


def week_start_for(ts: datetime):
    d = ts.astimezone(TZ).date()
    return d - timedelta(days=d.weekday())


def ingest(conn, nurse_pid: str, samples: list[dict]) -> int:
    """Fold raw samples into per-minute rows. Returns minutes touched."""
    agg = defaultdict(lambda: [0.0, 0, 0])
    for s in samples:
        minute = floor_minute(s["ts"])
        if s["type"] == "hr":
            agg[minute][0] += float(s["value"])
            agg[minute][1] += 1
        elif s["type"] == "steps":
            agg[minute][2] += int(s["value"])
    with conn.cursor() as cur:
        cur.executemany(
            """INSERT INTO core.minutes (ts, nurse_pid, hr_sum, hr_n, steps) VALUES (%s, %s, %s, %s, %s)
               ON CONFLICT (nurse_pid, ts) DO UPDATE SET hr_sum = core.minutes.hr_sum + EXCLUDED.hr_sum,
                 hr_n = core.minutes.hr_n + EXCLUDED.hr_n, steps = core.minutes.steps + EXCLUDED.steps""",
            [(m, nurse_pid, v[0], v[1], v[2]) for m, v in agg.items()],
        )
    return len(agg)


def load_arrays(conn, nurse_pid: str, start: datetime, end: datetime):
    """Per-minute HR (NaN when no sample) and steps between start and end."""
    n = max(int((end - start).total_seconds() // 60), 0)
    hr = np.full(n, np.nan)
    steps = np.zeros(n)
    rows = conn.execute(
        "SELECT ts, hr_sum, hr_n, steps FROM core.minutes WHERE nurse_pid = %s AND ts >= %s AND ts < %s",
        (nurse_pid, start, end),
    ).fetchall()
    for r in rows:
        i = int((r["ts"] - start).total_seconds() // 60)
        if 0 <= i < n:
            if r["hr_n"] > 0:
                hr[i] = r["hr_sum"] / r["hr_n"]
            steps[i] = r["steps"]   # steps with no HR stay non-wear: the minute is invalid
    return hr, steps


def latest_minute(conn, nurse_pid: str, start: datetime) -> datetime | None:
    row = conn.execute(
        "SELECT max(ts) AS ts FROM core.minutes WHERE nurse_pid = %s AND ts >= %s", (nurse_pid, start)
    ).fetchone()
    return row["ts"]


def compute(conn, nurse: dict, shift: dict, end: datetime) -> dict:
    """Everything derivable from the raw minutes of a shift up to `end`."""
    start = shift["start_ts"]
    hr, steps = load_arrays(conn, nurse["nurse_pid"], start, end)
    year = start.astimezone(TZ).year
    hr_max = metrics.hr_max(nurse["birth_year"], year)
    hr_rest = metrics.shift_hr_rest(nurse["hr_rest"], hr)
    if hr_rest is None:      # no HR at all yet
        hr_rest = 65.0
    model = load_model(nurse.get("hr_steps_model_json"))
    per_minute = metrics.compute_minutes(hr, steps, hr_rest, hr_max, model)
    windows = metrics.compute_windows(hr, steps, per_minute)
    m = metrics.shift_metrics(hr, steps, per_minute, windows)
    return {
        "shift_len": len(hr), "hr_rest": hr_rest, "hr_max": hr_max, "model": model,
        "windows": windows, "metrics": m,
        "suggested": metrics.suggest_breaks(steps, per_minute["pct_hrr"]),
    }


def write_windows(conn, nurse_pid: str, shift: dict, windows: list[dict]) -> None:
    with conn.cursor() as cur:
        cur.execute("DELETE FROM core.windows WHERE shift_id = %s", (shift["shift_id"],))
        cur.executemany(
            """INSERT INTO core.windows (ts, nurse_pid, shift_id, hr_mean, steps, valid_minutes,
                   pct_hrr, hr_expected, hr_excess, unexplained)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            [(shift["start_ts"] + timedelta(minutes=w["offset_min"]), nurse_pid, shift["shift_id"],
              w["hr_mean"], w["steps"], w["valid_minutes"], w["pct_hrr"], w["hr_expected"],
              w["hr_excess"], w["unexplained"]) for w in windows],
        )


def amber_threshold(conn, nurse: dict) -> tuple[float, bool]:
    """80th percentile of the nurse's own history, else the unit's, else a fixed cold start.

    Returns (threshold in minutes, provisional).
    """
    own = conn.execute(
        """SELECT count(*) AS n,
                  percentile_cont(%s) WITHIN GROUP (ORDER BY longest_no_break_min) AS p
           FROM core.shifts WHERE nurse_pid = %s AND finalized""",
        (config.NO_BREAK_AMBER_PERCENTILE / 100, nurse["nurse_pid"]),
    ).fetchone()
    if own["n"] >= 5:
        return float(own["p"]), False
    unit = conn.execute(
        """SELECT count(*) AS n,
                  percentile_cont(%s) WITHIN GROUP (ORDER BY longest_no_break_min) AS p
           FROM core.shifts WHERE unit_id = %s AND finalized""",
        (config.NO_BREAK_AMBER_PERCENTILE / 100, nurse["unit_id"]),
    ).fetchone()
    if unit["n"] >= 20:
        return float(unit["p"]), True
    return float(config.NO_BREAK_AMBER_COLD_START), True


def finalize(conn, nurse: dict, shift: dict, end: datetime, confirmed: list[tuple[int, int]],
             breaks_uncertain: bool, ratio_status: str, drained_rating: int | None) -> dict:
    """Compute the shift card, store it, and delete the raw minutes and windows."""
    c = compute(conn, nurse, shift, end)
    # when the nurse skipped the prompt, suggested breaks stand in and the result is uncertain
    breaks = c["suggested"] if breaks_uncertain else confirmed
    no_break = metrics.longest_no_break(c["shift_len"], breaks)
    threshold, provisional = amber_threshold(conn, nurse)
    m = c["metrics"]
    bands = metrics.band_shift(
        mean_pct_hrr=m["mean_pct_hrr"], longest_no_break_min=no_break,
        breaks_uncertain=breaks_uncertain, coverage_pct=m["coverage_pct"],
        max_gap_min=m["max_gap_min"], shift_len_min=c["shift_len"], amber_threshold=threshold,
    )
    conn.execute(
        """UPDATE core.shifts SET end_ts = %s, finalized = true, time_on_feet_min = %s,
               longest_on_feet_min = %s, mean_pct_hrr = %s, min_above_30_hrr = %s,
               longest_no_break_min = %s, n_breaks_confirmed = %s, breaks_uncertain = %s,
               unexplained_hr_min = %s, coverage_pct = %s, max_gap_min = %s, phys_band = %s,
               recovery_band = %s, band = %s, recovery_provisional = %s, ratio_status = %s,
               drained_rating = %s
           WHERE shift_id = %s""",
        (end, m["time_on_feet_min"], m["longest_on_feet_min"], m["mean_pct_hrr"],
         m["min_above_30_hrr"], no_break, 0 if breaks_uncertain else len(confirmed),
         breaks_uncertain, m["unexplained_hr_min"], m["coverage_pct"], m["max_gap_min"],
         bands["phys_band"], bands["recovery_band"], bands["band"], provisional, ratio_status,
         drained_rating, shift["shift_id"]),
    )
    # raw data does not outlive the shift
    conn.execute("DELETE FROM core.minutes WHERE nurse_pid = %s AND ts < %s", (nurse["nurse_pid"], end))
    conn.execute("DELETE FROM core.windows WHERE shift_id = %s", (shift["shift_id"],))
    n_done = conn.execute(
        "SELECT count(*) AS n FROM core.shifts WHERE nurse_pid = %s AND finalized", (nurse["nurse_pid"],)
    ).fetchone()["n"]
    if n_done >= 5:
        conn.execute("UPDATE core.nurses SET baseline_status = 'ready' WHERE nurse_pid = %s",
                     (nurse["nurse_pid"],))
    return bands
