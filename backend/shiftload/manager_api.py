"""Manager service. Its only credential is the `published_ro` role.

Run: uvicorn shiftload.manager_api:app --port 8002
"""
import uuid
from contextlib import asynccontextmanager
from datetime import date, timedelta
from typing import Literal

from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field

from . import config, narrative
from .common import User, make_app, make_pool, require
from .compare import ComparisonRequest, compare

pool = make_pool(config.PUBLISHED_DB_URL)


@asynccontextmanager
async def lifespan(_app):
    pool.open()
    yield
    pool.close()


app = make_app("ShiftLoad manager service", lifespan)
manager_only = require(pool, "manager", "manager")
manager_or_committee = require(pool, "manager", "manager", "joint_committee")
committee_only = require(pool, "manager", "joint_committee")

CELL = """unit_id, week_start, shift_type, status, participation_pct, coverage_pct, pct_red_low,
    pct_red_high, pct_insufficient, pct_no_break_5h, pct_ratio_met_and_breaks, phys_load_band,
    red_shifts_noised, data_mode"""


def scenario_ok(scenario: int) -> int:
    if scenario not in config.SCENARIOS:
        raise HTTPException(422, "unknown participation scenario")
    return scenario


def monday(d: date) -> date:
    return d - timedelta(days=d.weekday())


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/meta")
def meta(user: User = Depends(manager_or_committee)):
    with pool.connection() as conn:
        units = conn.execute("SELECT unit_id, name, hospital FROM published.units ORDER BY name").fetchall()
        weeks = conn.execute(
            "SELECT DISTINCT week_start FROM published.unit_weekly ORDER BY week_start").fetchall()
    return {
        "units": units, "weeks": [w["week_start"] for w in weeks],
        "scenarios": config.SCENARIOS, "default_scenario": config.DEFAULT_SCENARIO,
        "k_min": config.K_MIN, "participation_floor_pct": config.PARTICIPATION_FLOOR_PCT,
        "quality_gate_coverage_pct": config.QUALITY_GATE_COVERAGE_PCT,
        "purpose_limit": config.PURPOSE_LIMIT, "footer": config.FOOTER,
    }


@app.get("/manager/weekly")
def weekly(unit: str | None = None, date_from: date | None = None, date_to: date | None = None,
           scenario: int = config.DEFAULT_SCENARIO, user: User = Depends(manager_only)):
    """Published weekly cells. Dates snap to whole weeks."""
    scenario_ok(scenario)
    sql = f"SELECT {CELL} FROM published.unit_weekly WHERE participation_scenario = %s"
    params: list = [scenario]
    if unit:
        sql += " AND unit_id = %s"
        params.append(unit)
    if date_from:
        sql += " AND week_start >= %s"
        params.append(monday(date_from))
    if date_to:
        sql += " AND week_start <= %s"
        params.append(monday(date_to))
    with pool.connection() as conn:
        return conn.execute(sql + " ORDER BY unit_id, week_start, shift_type", params).fetchall()


@app.get("/manager/flags")
def flags(unit: str | None = None, scenario: int = config.DEFAULT_SCENARIO,
          user: User = Depends(manager_only)):
    scenario_ok(scenario)
    sql = """SELECT unit_id, week_start, shift_type, metric, direction, ratio_rounded
             FROM published.flags WHERE participation_scenario = %s"""
    params: list = [scenario]
    if unit:
        sql += " AND unit_id = %s"
        params.append(unit)
    with pool.connection() as conn:
        rows = conn.execute(sql + " ORDER BY week_start DESC, unit_id", params).fetchall()
    for r in rows:
        r["label"] = narrative.METRIC_LABELS[r["metric"]]
    return rows


def report_row(conn, unit: str, week: date, scenario: int) -> dict:
    row = conn.execute(
        """SELECT unit_id, week_start, payload_json, narrative, source, generated_at
           FROM published.weekly_reports
           WHERE participation_scenario = %s AND unit_id = %s AND week_start = %s""",
        (scenario, unit, monday(week))).fetchone()
    if not row:
        raise HTTPException(404, "no report for this unit and week")
    counts = conn.execute(
        """SELECT red_shifts_noised, reports_sent_noised, relief_requests_noised
           FROM published.unit_week_counts
           WHERE participation_scenario = %s AND unit_id = %s AND week_start = %s""",
        (scenario, unit, monday(week))).fetchone()
    actions = conn.execute(
        """SELECT action_type, note, created_at FROM published.manager_actions
           WHERE unit_id = %s AND week_start = %s ORDER BY created_at""", (unit, monday(week))).fetchall()
    return {**row, "counts": counts, "actions": actions}


@app.get("/manager/summary")
def summary(unit: str, week: date, scenario: int = config.DEFAULT_SCENARIO,
            user: User = Depends(manager_only)):
    scenario_ok(scenario)
    with pool.connection() as conn:
        return report_row(conn, unit, week, scenario)


@app.get("/reports/weekly/{unit}/{week}")
def weekly_report(unit: str, week: date, scenario: int = config.DEFAULT_SCENARIO,
                  user: User = Depends(manager_or_committee)):
    scenario_ok(scenario)
    with pool.connection() as conn:
        return report_row(conn, unit, week, scenario)


def period_label(weeks: list[date]) -> str:
    first = weeks[0].strftime("%b %d").replace(" 0", " ")
    return f"week of {first}" if len(weeks) == 1 else f"{len(weeks)} weeks from {first}"


@app.post("/manager/compare")
def manager_compare(req: ComparisonRequest, user: User = Depends(manager_only)):
    """Preset comparisons. Reads published cells only; no model is involved."""
    with pool.connection() as conn:
        names = {u["unit_id"]: u["name"] for u in conn.execute("SELECT unit_id, name FROM published.units")}
        for u in req.units:
            if u not in names:
                raise HTTPException(422, f"unknown unit {u}")
        side_cells, labels = [], []
        for side in req.sides():
            side_cells.append(conn.execute(
                f"""SELECT {CELL} FROM published.unit_weekly WHERE participation_scenario = %s
                    AND unit_id = %s AND shift_type = ANY(%s) AND week_start = ANY(%s)""",
                (req.participation_scenario, side["unit"], side["shift_types"], side["weeks"])).fetchall())
            shift = "days and nights" if len(side["shift_types"]) == 2 else f"{side['shift_types'][0]}s"
            if req.compare_by == "period":
                labels.append(period_label(side["weeks"]))
            elif req.compare_by == "unit":
                labels.append(names[side["unit"]])
            else:
                labels.append(shift)
    out = compare(req, side_cells, labels)
    scope_shift = "days and nights" if req.shift_type == "all" else f"{req.shift_type}s"
    scope = {
        "period": f"{names[req.units[0]]}, {scope_shift}",
        "unit": f"{period_label(req.period_a.weeks())}, {scope_shift}",
        "shift_type": f"{names[req.units[0]]}, {period_label(req.period_a.weeks())}",
    }[req.compare_by]
    return {**out, "scope": scope}


class Action(BaseModel):
    unit_id: str
    week_start: date
    action_type: Literal["called_in_staff", "float_for_breaks", "reassigned_patients", "none"]
    note: str = Field(default="", max_length=500)


@app.post("/manager/actions")
def log_action(body: Action, user: User = Depends(manager_only)):
    with pool.connection() as conn:
        conn.execute(
            "INSERT INTO published.manager_actions (action_id, unit_id, week_start, action_type, note) VALUES (%s, %s, %s, %s, %s)",
            (str(uuid.uuid4()), body.unit_id, monday(body.week_start), body.action_type, body.note))
    return {"ok": True}


@app.get("/manager/actions")
def list_actions(unit: str | None = None, user: User = Depends(manager_or_committee)):
    sql = "SELECT unit_id, week_start, action_type, note, created_at FROM published.manager_actions"
    params: list = []
    if unit:
        sql += " WHERE unit_id = %s"
        params.append(unit)
    with pool.connection() as conn:
        rows = conn.execute(sql + " ORDER BY created_at DESC LIMIT 200", params).fetchall()
    for r in rows:
        r["label"] = narrative.ACTION_LABELS[r["action_type"]]
    return rows


@app.post("/manager/validator-demo")
def validator_demo(user: User = Depends(manager_or_committee)):
    """Runs the real validator on a canned bad model output. No model call, no data."""
    return narrative.validator_demo()


def round_to_10(n: int) -> int:
    return int(round(n / 10.0) * 10)


@app.get("/committee/gap")
def reporting_gap(unit: str, scenario: int = config.DEFAULT_SCENARIO,
                  user: User = Depends(manager_or_committee)):
    """Red shifts against workload reports sent. Noised weekly counts, totals rounded to 10."""
    scenario_ok(scenario)
    with pool.connection() as conn:
        rows = conn.execute(
            """SELECT week_start, red_shifts_noised, reports_sent_noised, relief_requests_noised
               FROM published.unit_week_counts WHERE participation_scenario = %s AND unit_id = %s
               ORDER BY week_start""", (scenario, unit)).fetchall()
    return {
        "weeks": rows,
        "red_shifts_about": round_to_10(sum(r["red_shifts_noised"] for r in rows)),
        "reports_sent_about": round_to_10(sum(r["reports_sent_noised"] for r in rows)),
        "relief_requests_about": round_to_10(sum(r["relief_requests_noised"] for r in rows)),
    }


@app.get("/committee/access-log")
def access_log(limit: int = 200, user: User = Depends(committee_only)):
    with pool.connection() as conn:
        rows = conn.execute(
            "SELECT ts, service, role, endpoint, params_hash FROM audit.access_log ORDER BY id DESC LIMIT %s",
            (min(limit, 1000),)).fetchall()
        total = conn.execute("SELECT count(*) AS n FROM audit.access_log").fetchone()["n"]
    return {"total": total, "rows": rows, "purpose_limit": config.PURPOSE_LIMIT}
