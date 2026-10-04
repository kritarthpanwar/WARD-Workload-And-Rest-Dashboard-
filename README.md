# ShiftLoad

Turns every opted-in nurse shift into an automatic, dated, unit-specific record
of physical load and recovery opportunity. Workload documentation tool — not a
medical device. Spec: `CONTEXT_storm` (v3).

## Run it locally

Needs Docker Desktop, Python 3.12+ and Node 20+.

```bash
docker compose up -d                                  # TimescaleDB on port 5433
cd backend
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt
export PYTHONPATH=.
.venv/Scripts/python scripts/reset_db.py              # schemas + roles (wipes data)
.venv/Scripts/python scripts/seed.py                  # synthetic cohort + demo logins
.venv/Scripts/python scripts/make_replay_day.py       # simulated recorded day
.venv/Scripts/python -m shiftload.release             # first weekly release
.venv/Scripts/python -m uvicorn shiftload.nurse_api:app --port 8001
.venv/Scripts/python -m uvicorn shiftload.manager_api:app --port 8002
cd ../web && npm install && npm run dev               # http://localhost:3000
```

Checks:

```bash
cd backend
.venv/Scripts/python -m pytest                        # unit tests
PYTHONIOENCODING=utf-8 .venv/Scripts/python scripts/smoke.py   # end to end, services running
.venv/Scripts/python scripts/eval_anomaly.py 50       # blind anomaly evaluation
```

## What is where

| Piece | Where | DB role |
|---|---|---|
| Nurse API (ingest, live card, end of shift, relief, reports, replay, release job) | `backend/shiftload/nurse_api.py`, port 8001 | `app_rw` (+ `release` for the job) |
| Manager service (weekly cells, flags, summary, compare, actions, committee) | `backend/shiftload/manager_api.py`, port 8002 | `published_ro` only |
| Website (nurse, relief recipient, manager, joint committee, trustee) | `web/` | — |
| Schemas `core`, `published`, `audit` | `db/schema.sql` | — |

## What is real, what is a stand-in

Built and tested:
- %HRR physical load, coverage rules, two-domain banding, missing data never green.
- Shift pipeline: minutes → 5-min windows → metrics → finalize → raw data deleted.
- Relief request → recipient view (server-sent events) → handled → deleted, weekly counter only.
- Weekly release: k = 5, membership-change rule, rounding to 10%, Laplace noise
  (seeded per cell), participation floor, coverage gate.
- Anomaly detection (robust z over 28 days) with a blind evaluation script.
- Weekly summary with number-free model payloads, validator and template fallback.
- Preset comparisons, action log, reporting gap, append-only access log.

Stand-ins, each labelled in the UI:
- **Sign-in** is a development role picker. Firebase Auth is not connected.
- **Expected-HR model** is a hand-set, untrained prior (`expected_hr.py`). The
  LightGBM model and its evaluation on the Fitbit/Hongn datasets are not done,
  so there are no model accuracy numbers yet.
- **Recorded day** for the replay is simulated (`scripts/make_replay_day.py`),
  not a real watch recording.
- **Unit data** is the synthetic cohort (`synthetic.py`), badged SYNTHETIC.
- **Gemini** is called only when `GEMINI_API_KEY` is set; without it every
  summary uses the template. The Gemini call itself has not been exercised.
- **Phone app / Health Connect**, 30-day history import, live pull and Cloud Run
  deployment are not built. `/ingest` accepts the documented sample format.
- Relief streaming re-reads the table every second behind SSE rather than
  using Postgres `LISTEN/NOTIFY`.

Differences from the spec, on purpose:
- Published cells are day and night only. There is no combined cell, because
  releasing day, night and day+night together lets one be differenced out of
  the others. Unit-week counters live in `published.unit_week_counts`.
- The participation slider is served by publishing the release at each
  participation level (20–100%) from the synthetic cohort.

## Anomaly evaluation (synthetic, 50 seeds, 60% participation, |z| ≥ 3)

From `scripts/eval_anomaly.py`, written to `data/eval/anomaly_eval.json`:

| Planted size | Caught |
|---|---|
| small | 14 of 71 (20%) |
| moderate | 21 of 59 (36%) |
| large | 38 of 70 (54%) |

False alarms on the null cohort: 6.8 flagged unit-days per 100. Another 200
planted anomalies fell on unit-days with fewer than five nurses, which the
detector skips by rule. These numbers describe the method on assumed data
shapes, not real units, and the thresholds have not been tuned.

## Environment

See `.env.example`. Defaults work for local development with no keys.
