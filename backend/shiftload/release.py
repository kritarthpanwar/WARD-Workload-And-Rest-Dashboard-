"""Weekly release job (trustee side, `release` role): core -> published.

weekly aggregates -> k=5 + membership rule -> rounding + Laplace noise
-> anomaly flags -> weekly reports. Rewrites the whole published release each
run; noise is seeded per cell so a re-run reproduces the same numbers.
"""
import json
from datetime import date, timedelta

import pandas as pd
import psycopg
from psycopg.rows import dict_row

from . import anomaly, config, narrative, privacy
from .synthetic import TZ

SHIFT_COLS = """shift_id, nurse_pid::text AS nurse_pid, unit_id, start_ts, shift_type, band,
    longest_no_break_min, ratio_status, breaks_uncertain, mean_pct_hrr, unexplained_hr_min,
    coverage_pct, is_synthetic"""


def load(conn) -> dict:
    cur = conn.cursor(row_factory=dict_row)
    shifts = pd.DataFrame(cur.execute(
        f"SELECT {SHIFT_COLS} FROM core.shifts WHERE finalized AND band IS NOT NULL AND data_mode <> 'replay'").fetchall())
    nurses = pd.DataFrame(cur.execute(
        """SELECT nurse_pid::text AS nurse_pid, unit_id, is_synthetic, participation_rank
           FROM core.nurses WHERE withdrawn_at IS NULL""").fetchall())
    units = cur.execute("SELECT unit_id, roster_size FROM core.units").fetchall()
    reports = cur.execute("SELECT unit_id, week_start, reports_sent FROM core.report_counts").fetchall()
    relief = cur.execute("SELECT unit_id, week_start, n FROM core.relief_counts").fetchall()
    actions = cur.execute(
        "SELECT unit_id, week_start, action_type FROM published.manager_actions ORDER BY created_at"
    ).fetchall()
    if not shifts.empty:
        local = pd.to_datetime(shifts["start_ts"], utc=True).dt.tz_convert(TZ)
        shifts["day"] = local.dt.date
        shifts["week_start"] = shifts["day"].map(lambda d: d - timedelta(days=d.weekday()))
        shifts["breaks_uncertain"] = shifts["breaks_uncertain"].fillna(False).astype(bool)
    return {
        "shifts": shifts, "nurses": nurses,
        "roster": {u["unit_id"]: u["roster_size"] for u in units},
        "reports": {(r["unit_id"], r["week_start"]): r["reports_sent"] for r in reports},
        "relief": {(r["unit_id"], r["week_start"]): r["n"] for r in relief},
        "actions": actions,
    }


def build_release(data: dict, scenario: int, today: date) -> dict:
    """Pure: published rows for one participation scenario."""
    shifts, nurses = data["shifts"], data["nurses"]
    if shifts.empty:
        return {"cells": [], "cohorts": [], "counts": [], "flags": [], "anomalies": pd.DataFrame()}
    # the slider only thins the synthetic cohort; real opted-in nurses always count
    keep = set(nurses[(~nurses["is_synthetic"]) | (nurses["participation_rank"] < scenario / 100.0)]["nurse_pid"])
    current_week = today - timedelta(days=today.weekday())
    s = shifts[shifts["nurse_pid"].isin(keep) & (shifts["week_start"] < current_week)]
    synthetic_total = max(int(nurses["is_synthetic"].sum()), 1)
    synthetic_share = len(keep & set(nurses[nurses["is_synthetic"]]["nurse_pid"])) / synthetic_total

    cells, cohorts, counts = [], [], []
    released: dict[tuple, frozenset] = {}
    for unit_id, unit_shifts in s.groupby("unit_id"):
        roster = data["roster"][unit_id]
        for week in sorted(unit_shifts["week_start"].unique()):
            wk = unit_shifts[unit_shifts["week_start"] == week]
            participation = 100.0 * wk["nurse_pid"].nunique() / roster
            mode = "synthetic" if wk["is_synthetic"].any() else "live"
            any_released, red_total = False, 0
            for stype in ("day", "night"):
                df = wk[wk["shift_type"] == stype]
                if df.empty:
                    continue
                cohort = privacy.hash_cohort(df["nurse_pid"].unique())
                prev = released.get((unit_id, week - timedelta(days=7), stype))
                status = privacy.cell_status(len(cohort), cohort, [prev] if prev is not None else [],
                                             participation, float(df["coverage_pct"].mean()))
                row = {"participation_scenario": scenario, "unit_id": unit_id, "week_start": week,
                       "shift_type": stype, "status": status, "data_mode": mode}
                if status in ("not_representative", "quality_gate"):
                    row["participation_pct"] = privacy.round10(participation / 100)
                    row["coverage_pct"] = privacy.round10(float(df["coverage_pct"].mean()) / 100)
                if status == "released":
                    row.update(privacy.build_cell(df, privacy.cell_rng(unit_id, week, stype, scenario)))
                    row["participation_pct"] = privacy.round10(participation / 100)
                    released[(unit_id, week, stype)] = cohort
                    any_released = True
                    red_total += row["red_shifts_noised"]
                    cohorts.append({"participation_scenario": scenario, "unit_id": unit_id,
                                    "week_start": week, "shift_type": stype,
                                    "cohort_hash_set": sorted(cohort)})
                cells.append(row)
            if any_released:
                rng = privacy.cell_rng(unit_id, week, "counts", scenario)
                # counter tables hold the whole opted-in cohort; scale for the slider
                counts.append({
                    "participation_scenario": scenario, "unit_id": unit_id, "week_start": week,
                    "red_shifts_noised": red_total,
                    "reports_sent_noised": privacy.noisy_count(
                        data["reports"].get((unit_id, week), 0) * synthetic_share, rng),
                    "relief_requests_noised": privacy.noisy_count(
                        data["relief"].get((unit_id, week), 0) * synthetic_share, rng),
                })

    found = anomaly.detect(anomaly.daily_series(s))
    flags = anomaly.weekly_flags(found)
    # a flag is only published for a cell that was itself released
    flags = [
        {"participation_scenario": scenario, **f}
        for f in flags.to_dict("records")
        if (f["unit_id"], f["week_start"], f["shift_type"]) in released
    ]
    return {"cells": cells, "cohorts": cohorts, "counts": counts, "flags": flags, "anomalies": found}


def build_reports(cells: list[dict], flags: list[dict], actions: list[dict], scenario: int) -> list[dict]:
    """One report per unit-week from published values only."""
    by_key = {(c["unit_id"], c["week_start"], c["shift_type"]): c for c in cells}
    unit_weeks = sorted({(c["unit_id"], c["week_start"]) for c in cells})
    latest = max((w for _, w in unit_weeks), default=None)
    out = []
    for unit_id, week in unit_weeks:
        last_week = week - timedelta(days=7)
        now = {st: by_key[(unit_id, week, st)] for st in ("day", "night") if (unit_id, week, st) in by_key}
        prev = {st: by_key[(unit_id, last_week, st)] for st in ("day", "night")
                if (unit_id, last_week, st) in by_key}
        week_flags = [f for f in flags if f["unit_id"] == unit_id and f["week_start"] == week]
        # actions logged for the previous week: what the no-break share did afterwards
        both = [st for st in now if st in prev and now[st]["status"] == prev[st]["status"] == "released"]
        week_actions = []
        if both:
            before = round(sum(prev[st]["pct_no_break_5h"] for st in both) / len(both))
            after = round(sum(now[st]["pct_no_break_5h"] for st in both) / len(both))
            week_actions = [
                {"action_type": a["action_type"], "before": before, "after": after}
                for a in actions
                if a["unit_id"] == unit_id and a["week_start"] == last_week and a["action_type"] != "none"
            ]
        payload = narrative.build_payload(now, prev, week_flags, week_actions)
        use_gemini = scenario == config.DEFAULT_SCENARIO and week == latest
        result = narrative.generate(payload, use_gemini)
        payload_json = {
            "cells": {st: _jsonable(c) for st, c in now.items()},
            "flags": [_jsonable(f) for f in week_flags],
            "sent_to_model": narrative.gemini_view(payload) if result["source"] == "gemini" else None,
            "rejection": result["rejection"],
        }
        out.append({"participation_scenario": scenario, "unit_id": unit_id, "week_start": week,
                    "payload_json": json.dumps(payload_json), "narrative": json.dumps(result["narrative"]),
                    "source": result["source"]})
    return out


def _jsonable(row: dict) -> dict:
    return {k: (v.isoformat() if isinstance(v, date) else v) for k, v in row.items()
            if k not in ("participation_scenario",)}


CELL_COLS = ["participation_scenario", "unit_id", "week_start", "shift_type", "status",
             "participation_pct", "coverage_pct", "pct_red_low", "pct_red_high", "pct_insufficient",
             "pct_no_break_5h", "pct_ratio_met_and_breaks", "phys_load_band", "red_shifts_noised",
             "data_mode"]


def _insert(cur, table: str, cols: list[str], rows: list[dict]) -> None:
    if not rows:
        return
    sql = f"INSERT INTO {table} ({', '.join(cols)}) VALUES ({', '.join(['%s'] * len(cols))})"
    cur.executemany(sql, [[r.get(c) for c in cols] for r in rows])


def run(today: date | None = None) -> dict:
    """Run the full release: cells, cohorts, anomaly flags and weekly reports."""
    today = today or date.today()
    summary = {"cells": 0, "released": 0, "flags": 0, "reports": 0}
    with psycopg.connect(config.RELEASE_DB_URL) as conn:
        data = load(conn)
        cur = conn.cursor()
        for table in ("unit_weekly", "unit_week_counts", "flags", "released_cohorts", "weekly_reports"):
            cur.execute(f"DELETE FROM published.{table}")
        cur.execute("DELETE FROM core.unit_anomalies_daily")
        for scenario in config.SCENARIOS:
            rel = build_release(data, scenario, today)
            reports = build_reports(rel["cells"], rel["flags"], data["actions"], scenario)
            _insert(cur, "published.unit_weekly", CELL_COLS, rel["cells"])
            _insert(cur, "published.unit_week_counts",
                    ["participation_scenario", "unit_id", "week_start", "red_shifts_noised",
                     "reports_sent_noised", "relief_requests_noised"], rel["counts"])
            _insert(cur, "published.released_cohorts",
                    ["participation_scenario", "unit_id", "week_start", "shift_type", "cohort_hash_set"],
                    rel["cohorts"])
            _insert(cur, "published.flags",
                    ["participation_scenario", "unit_id", "week_start", "shift_type", "metric",
                     "direction", "ratio_rounded"], rel["flags"])
            _insert(cur, "published.weekly_reports",
                    ["participation_scenario", "unit_id", "week_start", "payload_json", "narrative", "source"],
                    reports)
            if not rel["anomalies"].empty:
                rows = rel["anomalies"].assign(participation_scenario=scenario).to_dict("records")
                _insert(cur, "core.unit_anomalies_daily",
                        ["participation_scenario", "unit_id", "shift_type", "day", "metric", "value",
                         "median", "z", "ratio"], rows)
            if scenario == config.DEFAULT_SCENARIO:
                summary = {
                    "cells": len(rel["cells"]),
                    "released": sum(c["status"] == "released" for c in rel["cells"]),
                    "by_status": pd.Series([c["status"] for c in rel["cells"]]).value_counts().to_dict()
                    if rel["cells"] else {},
                    "flags": len(rel["flags"]),
                    "reports": len(reports),
                    "gemini_reports": sum(r["source"] == "gemini" for r in reports),
                }
        conn.commit()
    return summary


if __name__ == "__main__":
    print(json.dumps(run(), indent=2, default=str))
