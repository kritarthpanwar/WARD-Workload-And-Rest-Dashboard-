# ShiftLoad

Nurse workload documentation tool for StormHack. The full spec is
`CONTEXT.md` in this folder (v5). Read it before changing behaviour.

## Layout

    docker-compose.yml          TimescaleDB for local dev (port 5433)
    db/schema.sql               core / published / audit schemas + three DB roles
    backend/shiftload/          Python package
      metrics.py                pure: %HRR, coverage, windows, shift metrics, bands
      expected_hr.py            expected-HR model interface (untrained prior for now)
      privacy.py                pure: k=5, membership rule, rounding, Laplace noise
      anomaly.py                pure: robust z over 28 days
      synthetic.py              pure: synthetic unit cohort + planted anomalies
      release.py                release job: core -> published
      narrative.py              number-free payloads, validator, Gemini, templates
      compare.py                ComparisonRequest -> split view
      nurse_api.py              FastAPI, role app_rw (port 8001)
      manager_api.py            FastAPI, role published_ro only (port 8002)
    backend/scripts/            reset_db, seed, make_replay_day, eval_anomaly
    backend/tests/              pytest
    web/                        Next.js (port 3000)
    android/                    Android app: daily Health Connect upload + clock in/out

## Hard rules (from the spec, section 3)

- The manager service connects as `published_ro` and reads only the `published`
  schema. Never give it another credential or another schema.
- Missing data is never green. A gap never counts as a break.
- k = 5 and the membership-change rule apply to every published cell.
- Gemini never receives or writes a number. Code supplies every number.
- No Gemini on the nurse path.
- Every panel carries a LIVE / RECORDED / REPLAY / SYNTHETIC badge and every page the
  footer "Workload documentation tool — not a medical device."
- Raw minute/window data is deleted when a shift is finalized.
- No individual-level data for managers, no daily manager view.
- High heart rate while stationary is presented as the "stress indicator" (team
  decision, 2026-10-04). It is still never called a diagnosis and never sets the
  band. No causal wording in summaries.

## Working rules

- Run `backend/.venv/Scripts/python -m pytest backend/tests` before saying
  something is done. Never claim a step works without running it.
- Values marked (default) in the spec live in `backend/shiftload/config.py`.
- Do not report model or anomaly numbers that were not produced by a script
  in this repo.
- Small commits, plain messages.
