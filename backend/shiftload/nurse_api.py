"""Nurse API service (DB role app_rw). Trustee side.

Run: uvicorn shiftload.nurse_api:app --port 8001
"""
import asyncio
import json
import statistics
import threading
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Literal

from fastapi import Depends, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from . import config, metrics, pipeline, release
from .common import User, bearer, make_app, make_pool, require, verify_firebase
from .synthetic import TZ

pool = make_pool(config.APP_DB_URL)
REPLAY_FILE = Path(__file__).resolve().parents[2] / "data" / "replay" / "recorded_day.json"
replays: dict[str, threading.Event] = {}      # nurse_pid -> stop signal of a running replay


@asynccontextmanager
async def lifespan(_app):
    pool.open()
    yield
    for stop in replays.values():
        stop.set()
    pool.close()


app = make_app("ShiftLoad nurse API", lifespan)
nurse_only = require(pool, "nurse_api", "nurse")
recipient_only = require(pool, "nurse_api", "charge_nurse")
admin_only = require(pool, "nurse_api", "admin")


# ------------------------------------------------------------------ helpers

def get_nurse(conn, user: User, onboarded: bool = True) -> dict:
    row = conn.execute(
        """SELECT n.*, i.display_name, u.name AS unit_name
           FROM core.nurse_identity i JOIN core.nurses n USING (nurse_pid)
           JOIN core.units u USING (unit_id) WHERE i.firebase_uid = %s""",
        (user.uid,),
    ).fetchone()
    if not row:
        raise HTTPException(404, "no nurse record for this login")
    if onboarded and (row["opted_in_at"] is None or row["withdrawn_at"] is not None):
        raise HTTPException(409, "finish onboarding first")
    return row


def active_shift(conn, nurse_pid) -> dict | None:
    return conn.execute(
        "SELECT * FROM core.shifts WHERE nurse_pid = %s AND NOT finalized ORDER BY start_ts DESC LIMIT 1",
        (nurse_pid,),
    ).fetchone()


def shift_now(conn, shift: dict) -> datetime:
    """A replayed shift lives on the clock of its data; a recorded one is already over; a live one uses the wall clock."""
    if shift["data_mode"] == "recorded":
        return shift["planned_end_ts"]
    if shift["data_mode"] == "replay":
        last = pipeline.latest_minute(conn, shift["nurse_pid"], shift["start_ts"])
        return last + timedelta(minutes=1) if last else shift["start_ts"]
    return min(datetime.now(timezone.utc), shift["start_ts"] + timedelta(hours=16))


def own_shift(conn, nurse: dict, shift_id: str) -> dict:
    row = conn.execute(
        "SELECT * FROM core.shifts WHERE shift_id = %s AND nurse_pid = %s", (shift_id, nurse["nurse_pid"])
    ).fetchone()
    if not row:
        raise HTTPException(404, "shift not found")
    return row


SHIFT_CARD = """shift_id, start_ts, end_ts, shift_type, data_mode, band, phys_band, recovery_band,
    recovery_provisional, mean_pct_hrr, min_above_30_hrr, longest_no_break_min, n_breaks_confirmed,
    breaks_uncertain, unexplained_hr_min, time_on_feet_min, longest_on_feet_min, coverage_pct,
    max_gap_min, ratio_status, drained_rating, sleep_before_min"""


# --------------------------------------------------------------- onboarding

class Onboarding(BaseModel):
    birth_year: int = Field(ge=1940, le=2010)
    rotation: dict
    relief_recipient: Literal["charge", "buddy", "float"] = "charge"
    auto_relief: bool = False


class Sample(BaseModel):
    ts: datetime
    type: Literal["hr", "steps", "resting_hr"]
    value: float


class SleepSession(BaseModel):
    start_ts: datetime
    end_ts: datetime


class Ingest(BaseModel):
    source_device: str
    samples: list[Sample] = []
    sleep: list[SleepSession] = []      # optional: only when the watch records sleep
    # daily uploads name the stretch they cover; sending it again replaces it instead of adding to it
    window_start: datetime | None = None
    window_end: datetime | None = None


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/session")
def session(request: Request):
    """Called right after a Firebase sign-in: records the account and returns its role."""
    claims = verify_firebase(bearer(request.headers.get("authorization")))
    uid, email = claims["user_id"], claims.get("email", "").lower()
    with pool.connection() as conn:
        conn.execute(
            "INSERT INTO audit.user_roles (firebase_uid, email) VALUES (%s, %s) ON CONFLICT (firebase_uid) DO NOTHING",
            (uid, email))
        row = conn.execute("SELECT role, unit_id, display_name FROM audit.user_roles WHERE firebase_uid = %s", (uid,)).fetchone()
        # a nurse's pseudonymous record is created the first time they sign in with the role
        if row["role"] == "nurse" and not conn.execute(
                "SELECT 1 FROM core.nurse_identity WHERE firebase_uid = %s", (uid,)).fetchone():
            if not row["unit_id"]:
                raise HTTPException(409, "this nurse account has no unit yet")
            pid = str(uuid.uuid4())
            conn.execute("INSERT INTO core.nurse_identity (firebase_uid, nurse_pid, display_name) VALUES (%s, %s, %s)",
                         (uid, pid, row["display_name"] or email.split("@")[0]))
            conn.execute("INSERT INTO core.nurses (nurse_pid, unit_id) VALUES (%s, %s)", (pid, row["unit_id"]))
    return {"uid": uid, "email": email, "role": row["role"]}


@app.get("/me")
def me(user: User = Depends(nurse_only)):
    with pool.connection() as conn:
        n = get_nurse(conn, user, onboarded=False)
        return {
            "display_name": n["display_name"], "unit_id": n["unit_id"], "unit_name": n["unit_name"],
            "onboarded": n["opted_in_at"] is not None and n["withdrawn_at"] is None,
            "birth_year": n["birth_year"], "hr_rest": n["hr_rest"], "rotation": n["rotation_json"],
            "baseline_status": n["baseline_status"], "relief_recipient": n["relief_recipient"],
            "auto_relief": n["auto_relief"], "paused_until": n["paused_until"],
            "purpose_limit": config.PURPOSE_LIMIT,
        }


@app.post("/onboarding")
def onboarding(body: Onboarding, user: User = Depends(nurse_only)):
    with pool.connection() as conn:
        n = get_nurse(conn, user, onboarded=False)
        conn.execute(
            """UPDATE core.nurses SET birth_year = %s, rotation_json = %s, relief_recipient = %s,
                   auto_relief = %s, opted_in_at = now(), withdrawn_at = NULL,
                   baseline_status = 'provisional' WHERE nurse_pid = %s""",
            (body.birth_year, json.dumps(body.rotation), body.relief_recipient, body.auto_relief,
             n["nurse_pid"]),
        )
    return {"ok": True}


@app.post("/onboarding/history")
def onboarding_history(body: Ingest, user: User = Depends(nurse_only)):
    """30-day history: keeps only a resting HR summary, not the samples."""
    resting = [s.value for s in body.samples if s.type == "resting_hr"]
    hrs = sorted(s.value for s in body.samples if s.type == "hr")
    if resting:
        hr_rest = statistics.median(resting)
    elif hrs:
        hr_rest = hrs[int(0.05 * (len(hrs) - 1))]     # 5th percentile of awake HR
    else:
        raise HTTPException(422, "no heart-rate samples in history")
    with pool.connection() as conn:
        n = get_nurse(conn, user)
        conn.execute("UPDATE core.nurses SET hr_rest = %s WHERE nurse_pid = %s", (hr_rest, n["nurse_pid"]))
    return {"hr_rest": hr_rest, "baseline_status": "provisional"}


class Settings(BaseModel):
    relief_recipient: Literal["charge", "buddy", "float"] | None = None
    auto_relief: bool | None = None
    pause_days: int | None = Field(default=None, ge=0, le=60)


@app.post("/me/settings")
def settings(body: Settings, user: User = Depends(nurse_only)):
    with pool.connection() as conn:
        n = get_nurse(conn, user)
        if body.relief_recipient is not None:
            conn.execute("UPDATE core.nurses SET relief_recipient = %s WHERE nurse_pid = %s",
                         (body.relief_recipient, n["nurse_pid"]))
        if body.auto_relief is not None:
            conn.execute("UPDATE core.nurses SET auto_relief = %s WHERE nurse_pid = %s",
                         (body.auto_relief, n["nurse_pid"]))
        if body.pause_days is not None:
            until = datetime.now(timezone.utc) + timedelta(days=body.pause_days) if body.pause_days else None
            conn.execute("UPDATE core.nurses SET paused_until = %s WHERE nurse_pid = %s",
                         (until, n["nurse_pid"]))
    return {"ok": True}


@app.post("/me/withdraw")
def withdraw(user: User = Depends(nurse_only)):
    """Delete everything held about this nurse."""
    with pool.connection() as conn:
        n = get_nurse(conn, user, onboarded=False)
        pid = n["nurse_pid"]
        if pid in replays:
            replays[pid].set()
        conn.execute(
            "DELETE FROM core.break_events WHERE shift_id IN (SELECT shift_id FROM core.shifts WHERE nurse_pid = %s)",
            (pid,))
        for table in ("shifts", "minutes", "windows", "relief_requests", "sleep_sessions"):
            conn.execute(f"DELETE FROM core.{table} WHERE nurse_pid = %s", (pid,))
        conn.execute(
            """UPDATE core.nurses SET birth_year = NULL, hr_rest = NULL, hr_steps_model_json = NULL,
                   rotation_json = NULL, opted_in_at = NULL, paused_until = NULL, withdrawn_at = now(),
                   baseline_status = 'provisional' WHERE nurse_pid = %s""", (pid,))
    return {"ok": True}


# -------------------------------------------------------------------- shift

class ShiftStart(BaseModel):
    start_ts: datetime | None = None


class ShiftCorrect(BaseModel):
    start_ts: datetime | None = None
    planned_end_ts: datetime | None = None


def create_shift(conn, nurse: dict, start: datetime, mode: str, device: str | None) -> str:
    if nurse["paused_until"] and nurse["paused_until"] > datetime.now(timezone.utc) and mode == "live":
        raise HTTPException(409, "recording is paused")
    if active_shift(conn, nurse["nurse_pid"]):
        raise HTTPException(409, "a shift is already running")
    shift_id = str(uuid.uuid4())
    conn.execute(
        """INSERT INTO core.shifts (shift_id, nurse_pid, unit_id, start_ts, planned_end_ts, shift_type,
               source_device, data_mode) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
        (shift_id, nurse["nurse_pid"], nurse["unit_id"], start, start + timedelta(hours=12),
         pipeline.shift_type_for(start), device, mode),
    )
    return shift_id


@app.post("/shifts/start")
def shift_start(body: ShiftStart, user: User = Depends(nurse_only)):
    with pool.connection() as conn:
        n = get_nurse(conn, user)
        start = pipeline.floor_minute(body.start_ts or datetime.now(timezone.utc))
        return {"shift_id": create_shift(conn, n, start, "live", None)}


class ClockedShift(BaseModel):
    start_ts: datetime      # clock-in
    end_ts: datetime        # clock-out


@app.post("/shifts/clock")
def shift_clock(body: ClockedShift, user: User = Depends(nurse_only)):
    """The nurse enters clock-in and clock-out; the shift is built from data the phone already uploaded."""
    start, end = pipeline.floor_minute(body.start_ts), pipeline.floor_minute(body.end_ts)
    hours = (end - start).total_seconds() / 3600
    if not 1 <= hours <= 16:
        raise HTTPException(422, "a shift must be between 1 and 16 hours long")
    if end > datetime.now(timezone.utc) + timedelta(minutes=5):
        raise HTTPException(422, "this shift has not finished yet")
    with pool.connection() as conn:
        n = get_nurse(conn, user)
        pid = n["nurse_pid"]
        if conn.execute("SELECT 1 FROM core.shifts WHERE nurse_pid = %s AND finalized AND start_ts < %s AND end_ts > %s",
                        (pid, end, start)).fetchone():
            raise HTTPException(409, "a finished shift already covers this time")
        have = conn.execute("SELECT count(*) AS n FROM core.minutes WHERE nurse_pid = %s AND ts >= %s AND ts < %s AND hr_n > 0",
                            (pid, start, end)).fetchone()["n"]
        if have == 0:
            raise HTTPException(409, "no watch data has been uploaded for that time yet")
        # entering the times again replaces an unfinished earlier attempt
        conn.execute("DELETE FROM core.break_events WHERE shift_id IN (SELECT shift_id FROM core.shifts WHERE nurse_pid = %s AND NOT finalized)", (pid,))
        conn.execute("DELETE FROM core.windows WHERE shift_id IN (SELECT shift_id FROM core.shifts WHERE nurse_pid = %s AND NOT finalized)", (pid,))
        conn.execute("DELETE FROM core.shifts WHERE nurse_pid = %s AND NOT finalized", (pid,))
        shift_id = str(uuid.uuid4())
        device = conn.execute("SELECT source_device FROM core.sleep_sessions WHERE nurse_pid = %s LIMIT 1", (pid,)).fetchone()
        conn.execute(
            """INSERT INTO core.shifts (shift_id, nurse_pid, unit_id, start_ts, planned_end_ts, shift_type,
                   source_device, data_mode) VALUES (%s, %s, %s, %s, %s, %s, %s, 'recorded')""",
            (shift_id, pid, n["unit_id"], start, end, pipeline.shift_type_for(start), device["source_device"] if device else None))
        shift = active_shift(conn, pid)
        c = pipeline.compute(conn, n, shift, end)
        pipeline.write_windows(conn, pid, shift, c["windows"])
    return {"shift_id": shift_id, "minutes_with_data": have, "minutes": int(hours * 60)}


@app.post("/shifts/{shift_id}/correct")
def shift_correct(shift_id: str, body: ShiftCorrect, user: User = Depends(nurse_only)):
    with pool.connection() as conn:
        n = get_nurse(conn, user)
        s = own_shift(conn, n, shift_id)
        if s["finalized"]:
            raise HTTPException(409, "shift already finalized")
        if body.planned_end_ts:
            conn.execute("UPDATE core.shifts SET planned_end_ts = %s WHERE shift_id = %s",
                         (body.planned_end_ts, shift_id))
        if body.start_ts:
            start = pipeline.floor_minute(body.start_ts)
            conn.execute("UPDATE core.shifts SET start_ts = %s, shift_type = %s WHERE shift_id = %s",
                         (start, pipeline.shift_type_for(start), shift_id))
    return {"ok": True}


def do_ingest(conn, nurse: dict, samples: list[dict], device: str) -> None:
    pipeline.ingest(conn, nurse["nurse_pid"], samples)
    shift = active_shift(conn, nurse["nurse_pid"])
    if shift:
        if not shift["source_device"]:
            conn.execute("UPDATE core.shifts SET source_device = %s WHERE shift_id = %s",
                         (device, shift["shift_id"]))
        c = pipeline.compute(conn, nurse, shift, shift_now(conn, shift))
        pipeline.write_windows(conn, nurse["nurse_pid"], shift, c["windows"])


@app.post("/ingest")
def ingest(body: Ingest, user: User = Depends(nurse_only)):
    with pool.connection() as conn:
        n = get_nurse(conn, user)
        resting = [s.value for s in body.samples if s.type == "resting_hr"]
        if resting and n["hr_rest"] is None:
            n["hr_rest"] = statistics.median(resting)
            conn.execute("UPDATE core.nurses SET hr_rest = %s WHERE nurse_pid = %s",
                         (n["hr_rest"], n["nurse_pid"]))
        if n["paused_until"] and n["paused_until"] > datetime.now(timezone.utc):
            raise HTTPException(409, "recording is paused")
        pid = n["nurse_pid"]
        if body.window_start and body.window_end:
            conn.execute("DELETE FROM core.minutes WHERE nurse_pid = %s AND ts >= %s AND ts < %s",
                         (pid, pipeline.floor_minute(body.window_start), body.window_end))
        if body.sleep:
            pipeline.store_sleep(conn, pid, [s.model_dump() for s in body.sleep], body.source_device)
        if body.samples:
            do_ingest(conn, n, [s.model_dump() for s in body.samples], body.source_device)
        # a repeat upload must not bring back raw data for a shift that is already finalized
        conn.execute(
            """DELETE FROM core.minutes m USING core.shifts s
               WHERE m.nurse_pid = %s AND s.nurse_pid = m.nurse_pid AND s.finalized
                 AND m.ts >= s.start_ts AND m.ts < s.end_ts""", (pid,))
        # raw data that no shift has claimed does not stay: it is dropped after a week
        cutoff = datetime.now(timezone.utc) - timedelta(days=config.RAW_RETENTION_DAYS)
        conn.execute("DELETE FROM core.minutes WHERE nurse_pid = %s AND ts < %s", (pid, cutoff))
        conn.execute("DELETE FROM core.sleep_sessions WHERE nurse_pid = %s AND end_ts < %s", (pid, cutoff))
    return {"accepted": len(body.samples), "sleep_sessions": len(body.sleep)}


@app.get("/me/shift/current")
def current(user: User = Depends(nurse_only)):
    with pool.connection() as conn:
        n = get_nurse(conn, user)
        shift = active_shift(conn, n["nurse_pid"])
        base = {"baseline_status": n["baseline_status"], "shift": None,
                "replay_running": n["nurse_pid"] in replays}
        if not shift:
            return base
        now = shift_now(conn, shift)
        c = pipeline.compute(conn, n, shift, now)
        last_break_end = max((e for _, e in c["suggested"]), default=0)
        since_break = c["shift_len"] - last_break_end
        pending = conn.execute(
            "SELECT 1 FROM core.relief_requests WHERE nurse_pid = %s", (n["nurse_pid"],)).fetchone()
        return {
            **base,
            "shift": {k: shift[k] for k in ("shift_id", "start_ts", "planned_end_ts", "shift_type",
                                            "data_mode", "source_device")},
            "elapsed_min": c["shift_len"],
            "hr_rest": round(c["hr_rest"], 1), "hr_max": round(c["hr_max"], 1),
            "model": {"name": c["model"].name, "trained": c["model"].trained},
            "windows": [{"t": w["offset_min"], "pct_hrr": w["pct_hrr"], "excess": w["hr_excess"],
                         "unexplained": w["unexplained"], "scored": w["pct_hrr"] is not None}
                        for w in c["windows"]],
            "metrics": c["metrics"],
            "phys_band_so_far": metrics.phys_band(c["metrics"]["mean_pct_hrr"]),
            "suggested_breaks": [{"start_min": s, "end_min": e} for s, e in c["suggested"]],
            "since_break_min": since_break,
            "sleep_before_min": pipeline.sleep_before_shift(conn, n["nurse_pid"], shift["start_ts"]),
            "nudge": since_break >= config.RELIEF_NUDGE_MIN and not pending,
            "relief_pending": bool(pending),
        }


class BreakAnswer(BaseModel):
    id: str
    status: Literal["confirmed", "rejected"]


class ShiftEnd(BaseModel):
    breaks: list[BreakAnswer] = []
    skipped: bool = False            # nurse skipped the batched confirmation
    ratio_status: Literal["met", "not_met", "unknown"] = "unknown"
    drained_rating: int | None = Field(default=None, ge=1, le=10)


@app.post("/shifts/{shift_id}/propose")
def propose(shift_id: str, user: User = Depends(nurse_only)):
    """End-of-shift step 1: the batched "we think you had breaks at..." prompt."""
    with pool.connection() as conn:
        n = get_nurse(conn, user)
        s = own_shift(conn, n, shift_id)
        if s["finalized"]:
            raise HTTPException(409, "shift already finalized")
        if n["nurse_pid"] in replays:
            raise HTTPException(409, "replay still running")
        end = shift_now(conn, s)
        c = pipeline.compute(conn, n, s, end)
        conn.execute("DELETE FROM core.break_events WHERE shift_id = %s", (shift_id,))
        out = []
        for a, b in c["suggested"]:
            bid = str(uuid.uuid4())
            st, en = s["start_ts"] + timedelta(minutes=a), s["start_ts"] + timedelta(minutes=b)
            conn.execute(
                "INSERT INTO core.break_events (break_id, shift_id, start_ts, end_ts, source) VALUES (%s, %s, %s, %s, 'suggested')",
                (bid, shift_id, st, en))
            out.append({"id": bid, "start_ts": st, "end_ts": en})
        conn.execute("UPDATE core.shifts SET end_ts = %s WHERE shift_id = %s", (end, shift_id))
        return {"end_ts": end, "breaks": out}


@app.post("/shifts/{shift_id}/end")
def shift_end(shift_id: str, body: ShiftEnd, user: User = Depends(nurse_only)):
    with pool.connection() as conn:
        n = get_nurse(conn, user)
        s = own_shift(conn, n, shift_id)
        if s["finalized"]:
            raise HTTPException(409, "shift already finalized")
        end = s["end_ts"] or shift_now(conn, s)
        for b in body.breaks:
            conn.execute("UPDATE core.break_events SET status = %s WHERE break_id = %s AND shift_id = %s",
                         (b.status, b.id, shift_id))
        rows = conn.execute(
            "SELECT start_ts, end_ts FROM core.break_events WHERE shift_id = %s AND status = 'confirmed'",
            (shift_id,)).fetchall()
        confirmed = [(int((r["start_ts"] - s["start_ts"]).total_seconds() // 60),
                      int((r["end_ts"] - s["start_ts"]).total_seconds() // 60)) for r in rows]
        pipeline.finalize(conn, n, s, end, confirmed, body.skipped, body.ratio_status, body.drained_rating)
        conn.execute("DELETE FROM core.relief_requests WHERE nurse_pid = %s", (n["nurse_pid"],))
        return conn.execute(f"SELECT {SHIFT_CARD} FROM core.shifts WHERE shift_id = %s", (shift_id,)).fetchone()


@app.get("/me/shifts")
def my_shifts(user: User = Depends(nurse_only)):
    with pool.connection() as conn:
        n = get_nurse(conn, user)
        return conn.execute(
            f"SELECT {SHIFT_CARD} FROM core.shifts WHERE nurse_pid = %s AND finalized ORDER BY start_ts DESC",
            (n["nurse_pid"],)).fetchall()


# ------------------------------------------------------------------ reports

def fmt_local(ts: datetime, pattern: str) -> str:
    return ts.astimezone(TZ).strftime(pattern)


@app.get("/me/reports/{shift_id}/draft")
def report_draft(shift_id: str, user: User = Depends(nurse_only)):
    """Template only: no model writes any of this text."""
    with pool.connection() as conn:
        n = get_nurse(conn, user)
        s = own_shift(conn, n, shift_id)
        if not s["finalized"] or s["band"] != "red":
            raise HTTPException(409, "a report draft is offered for red shifts only")
    hours, mins = divmod(s["longest_no_break_min"], 60)
    ratio = {"met": "met", "not_met": "not met", "unknown": "not recorded"}[s["ratio_status"]]
    lines = [
        "WORKLOAD RECORD",
        "Attachment for the BCNU Professional Responsibility Process (Appendix KK) / "
        "Article 32 joint OHS committee.",
        "",
        f"Unit: {n['unit_name']}",
        f"Shift: {fmt_local(s['start_ts'], '%a %d %b %Y, %H:%M')} to {fmt_local(s['end_ts'], '%H:%M')} ({s['shift_type']})",
        "Shift band: RED",
        "",
        f"Longest stretch without a break: {hours} h {mins} min ({s['recovery_band']})",
        f"Breaks confirmed: {s['n_breaks_confirmed']}",
        f"Physical load: mean heart-rate reserve {s['mean_pct_hrr']}% ({s['phys_band']}), "
        f"{s['min_above_30_hrr']} min at or above 30%",
        f"Time on feet: {s['time_on_feet_min']} min",
        f"Nurse-to-patient ratio: {ratio}",
        f"Recording coverage: {s['coverage_pct']}% of the shift",
        "",
        "This is an automatic workload record. It is not a medical or health assessment.",
    ]
    return {"shift_id": shift_id, "text": "\n".join(lines)}


@app.post("/me/reports/{shift_id}/sent")
def report_sent(shift_id: str, user: User = Depends(nurse_only)):
    """Only a unit-week counter moves. Nothing links the report to the nurse."""
    with pool.connection() as conn:
        n = get_nurse(conn, user)
        s = own_shift(conn, n, shift_id)
        conn.execute(
            """INSERT INTO core.report_counts (unit_id, week_start, reports_sent) VALUES (%s, %s, 1)
               ON CONFLICT (unit_id, week_start) DO UPDATE SET reports_sent = core.report_counts.reports_sent + 1""",
            (s["unit_id"], pipeline.week_start_for(s["start_ts"])))
    return {"ok": True}


# ------------------------------------------------------------------- relief

class Relief(BaseModel):
    recipient_type: Literal["charge", "buddy", "float"] | None = None


@app.post("/relief")
def relief(body: Relief, user: User = Depends(nurse_only)):
    with pool.connection() as conn:
        n = get_nurse(conn, user)
        if conn.execute("SELECT 1 FROM core.relief_requests WHERE nurse_pid = %s", (n["nurse_pid"],)).fetchone():
            return {"ok": True, "already_pending": True}
        conn.execute(
            "INSERT INTO core.relief_requests (request_id, unit_id, nurse_pid, recipient_type) VALUES (%s, %s, %s, %s)",
            (str(uuid.uuid4()), n["unit_id"], n["nurse_pid"], body.recipient_type or n["relief_recipient"]))
    return {"ok": True}


def relief_list() -> list[dict]:
    """What a recipient sees: a name and nothing else about the nurse."""
    with pool.connection() as conn:
        rows = conn.execute(
            """SELECT r.request_id::text AS request_id, i.display_name, r.recipient_type, u.name AS unit_name
               FROM core.relief_requests r JOIN core.nurse_identity i USING (nurse_pid)
               JOIN core.units u USING (unit_id) ORDER BY r.created_ts""").fetchall()
    return rows


@app.get("/relief")
def relief_get(user: User = Depends(recipient_only)):
    return relief_list()


@app.get("/relief/stream")
async def relief_stream(user: User = Depends(recipient_only)):
    """Server-sent events. The list is re-read every second and sent when it changes."""

    async def events():
        last, idle = None, 0
        while True:
            rows = await run_in_threadpool(relief_list)
            payload = json.dumps(rows)
            if payload != last:
                last, idle = payload, 0
                yield f"data: {payload}\n\n"
            else:
                idle += 1
                if idle % 15 == 0:
                    yield ": keep-alive\n\n"
            await asyncio.sleep(1)

    return StreamingResponse(events(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.post("/relief/{request_id}/handled")
def relief_handled(request_id: str, user: User = Depends(recipient_only)):
    with pool.connection() as conn:
        row = conn.execute(
            "DELETE FROM core.relief_requests WHERE request_id = %s RETURNING unit_id, created_ts",
            (request_id,)).fetchone()
        if not row:
            raise HTTPException(404, "request not found")
        conn.execute(
            """INSERT INTO core.relief_counts (unit_id, week_start, n) VALUES (%s, %s, 1)
               ON CONFLICT (unit_id, week_start) DO UPDATE SET n = core.relief_counts.n + 1""",
            (row["unit_id"], pipeline.week_start_for(row["created_ts"])))
    return {"ok": True}


# ------------------------------------------------------------------- replay

class ReplayStart(BaseModel):
    speed: float = Field(default=8, gt=0, le=720)     # shift minutes per second


def run_replay(nurse: dict, shift_id: str, start: datetime, day: dict, speed: float,
               stop: threading.Event) -> None:
    step = max(1, round(speed / 2))                   # two ticks per second
    minutes = day["minutes"]
    try:
        for i in range(0, len(minutes), step):
            if stop.is_set():
                return
            samples = []
            for m in minutes[i : i + step]:
                ts = start + timedelta(minutes=m["m"])
                if m["hr"] is not None:
                    samples.append({"ts": ts, "type": "hr", "value": m["hr"]})
                    samples.append({"ts": ts, "type": "steps", "value": m["steps"]})
            with pool.connection() as conn:
                if not conn.execute("SELECT 1 FROM core.shifts WHERE shift_id = %s AND NOT finalized",
                                    (shift_id,)).fetchone():
                    return
                if not samples:    # keep the replay clock moving through a non-wear gap
                    ts = start + timedelta(minutes=minutes[min(i + step, len(minutes)) - 1]["m"])
                    conn.execute(
                        "INSERT INTO core.minutes (ts, nurse_pid) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                        (pipeline.floor_minute(ts), nurse["nurse_pid"]))
                do_ingest(conn, nurse, samples, day["source_device"])
            time.sleep(0.5)
    finally:
        replays.pop(nurse["nurse_pid"], None)


@app.post("/replay/start")
def replay_start(body: ReplayStart, user: User = Depends(nurse_only)):
    """Feed the recorded day through the same ingest path, faster than real time."""
    if not REPLAY_FILE.exists():
        raise HTTPException(500, "recorded day missing: run scripts/make_replay_day.py")
    day = json.loads(REPLAY_FILE.read_text())
    with pool.connection() as conn:
        n = get_nurse(conn, user)
        pid = n["nurse_pid"]
        if pid in replays:
            raise HTTPException(409, "a replay is already running")
        yesterday = (datetime.now(TZ) - timedelta(days=1)).date()
        start = datetime(yesterday.year, yesterday.month, yesterday.day,
                         day["start_hour_local"], tzinfo=TZ).astimezone(timezone.utc)
        # clear an unfinished shift and any earlier replay of the same day
        conn.execute(
            """DELETE FROM core.break_events WHERE shift_id IN (SELECT shift_id FROM core.shifts
               WHERE nurse_pid = %s AND (NOT finalized OR (data_mode = 'replay' AND start_ts = %s)))""",
            (pid, start))
        conn.execute(
            "DELETE FROM core.shifts WHERE nurse_pid = %s AND (NOT finalized OR (data_mode = 'replay' AND start_ts = %s))",
            (pid, start))
        conn.execute("DELETE FROM core.minutes WHERE nurse_pid = %s", (pid,))
        conn.execute("DELETE FROM core.windows WHERE nurse_pid = %s", (pid,))
        conn.execute("DELETE FROM core.relief_requests WHERE nurse_pid = %s", (pid,))
        conn.execute("DELETE FROM core.sleep_sessions WHERE nurse_pid = %s AND start_ts >= %s",
                     (pid, start - timedelta(hours=24)))
        pipeline.store_sleep(conn, pid, [
            {"start_ts": start + timedelta(minutes=s["start_min"]), "end_ts": start + timedelta(minutes=s["end_min"])}
            for s in day.get("sleep", [])
        ], day["source_device"])
        if n["hr_rest"] is None:
            n["hr_rest"] = float(day["resting_hr"])
            conn.execute("UPDATE core.nurses SET hr_rest = %s WHERE nurse_pid = %s", (n["hr_rest"], pid))
        shift_id = create_shift(conn, n, start, "replay", day["source_device"])
    stop = threading.Event()
    replays[pid] = stop
    threading.Thread(target=run_replay, args=(n, shift_id, start, day, body.speed, stop), daemon=True).start()
    return {"shift_id": shift_id, "simulated": "Simulated" in day.get("note", "")}


# --------------------------------------------------------------------- jobs

@app.post("/jobs/release/run")
def job_release(user: User = Depends(admin_only)):
    """Weekly release: aggregates -> k=5 + membership rule -> rounding + noise -> published."""
    return release.run()


@app.post("/jobs/anomalies/run")
def job_anomalies(user: User = Depends(admin_only)):
    """Anomaly flags are rebuilt as part of the release so both always match."""
    return release.run()
