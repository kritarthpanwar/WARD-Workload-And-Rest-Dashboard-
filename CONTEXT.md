# WARD (Workload And Rest Dashboard) — Project Context (v5)

> Single source of truth for the project. Read this before writing code. Anything marked **(default)** is a tunable design choice, not a fact. Anything marked **(verify)** has not been confirmed yet. Anything marked **(not built)** is in the plan but not in the code.
>
> **v5 changes (2026-10-04), from what was actually built:**
> - **Name:** ShiftLoad is now **WARD — Workload And Rest Dashboard**. The Python package and database still say `shiftload`.
> - **No live data.** Live streaming and the "live pull" are scrapped. The phone uploads Health Connect data **once a day** at a time the nurse picks (plus "Upload now"), and the nurse enters **clock-in and clock-out** to turn that data into a shift. New badge: **RECORDED**.
> - **Relief requests removed** from the website and the app (the "need a break" button, the relief recipient view, relief settings, relief counts). Backend endpoints and tables still exist but nothing uses them.
> - **Sleep added:** sleep sessions from Health Connect (start and end only, never stages) give "sleep in the 24 hours before the shift", shown to the nurse and stored per shift.
> - **Raw data retention changed:** the daily upload includes off-shift data, so raw data that no shift claims is deleted after **7 days**; a shift's raw data is still deleted when the shift is finalized.
> - **Hosting:** website on **Vercel**, the two servers on **Render** (free plan), database on **Tiger Cloud**. Not Cloud Run.
> - **Auth:** Firebase **email/password** with email verification; roles live in a database table (`audit.user_roles`), assigned by a script, not Firebase custom claims. Demo logins stay on for judging.
> - **Android app built** (Kotlin, Health Connect): daily upload, clock-in/out, the shift chart, end-of-shift questions, shift history and workload report, demo login.
> - **Expected-HR model is still an untrained hand-set prior.** The LightGBM training and transfer tests have not been run.
> - **Anomaly blind evaluation has been run** (numbers in §10.1).
> - **UI:** modern soft cards, teal and navy, big plain statements ("Stress was high at 10:50"), no small explanatory text.
>
> v4 (kept): heart rate well above what steps predict while the nurse is stationary is presented as a **stress indicator**. It is not a diagnosis and does not set the band. Column names (`unexplained_hr_min`, `unexplained`) are unchanged.
>
> v3 (kept): heart-rate-reserve physical load; two anchored bands; missing data is never green; managers get a weekly published release from a trustee-held database; Gemini never sees a number.

---

## 1. What we're building

**WARD turns every opted-in nurse shift into an automatic, dated, unit-specific record of physical load and recovery opportunity, and measures how many overloaded shifts never become a workload report.** Those records feed processes that already exist in BC: the BCNU Professional Responsibility Process (Appendix KK) and joint OHS committee (Article 32), and the Joint Regional Implementation Committees (JRICs) that oversee nurse-to-patient ratios.

**Framing:** it *measures and documents* workload. It does **not** diagnose, predict burnout, or make medical claims about individuals. It does show a **stress indicator**: high heart rate while stationary. It is a staff workload tool, not a medical device.

### Pitch facts (lead with these)
- **CFNU 2025 survey (n = 4,736):** 67% of nurses say their workplace is "regularly over capacity"; **65% fear repercussions for reporting OHS concerns**; 48% work overtime regularly; 30% are considering leaving within a year — [CFNU 2025](https://nursesunions.ca/wp-content/uploads/2025/03/CFNU-Member-Survey-Report_March-25_final-65.pdf).
- **BC 58-hospital study:** nurses who leave cite inadequate staffing (66.6%) and burnout (61.9%) — [BCNU 2025](https://www.bcnu.org/news-and-events/news/2025/better-staffing-better-care-new-study-supports-bcs-ratios-rollout).
- **Documentation moves staffing:** Ontario's Southlake Independent Assessment Committee reviewed 109+ workload report forms (May 2019–Aug 2021) plus 43.68% turnover and recommended RN complements reaching 1:4 days / 1:5 nights (non-binding) — [ONA IAC report](https://ona.org/wp-content/uploads/2024/09/ona_iacreport_southlakerhc_20211114.pdf).
- **The gap ratios leave open:** under-ratio units are brought back up "including for overtime"; metrics go to JRICs quarterly — [mNPR manual](https://www2.gov.bc.ca/assets/gov/health/practitioner-pro/minimum-nurse-to-patient-ratios/mnpr_implementation_instruction_manual.pdf). BC's mNPR FAQ names no digital workload tool — [BC Gov FAQ](https://www2.gov.bc.ca/gov/content/health/practitioner-professional-resources/mnpr/mnpr-frequently-asked-questions).
- **Cost on the employer side:** BC paid private nursing agencies $508M in two years — [CTV News](https://www.ctvnews.ca/vancouver/article/exclusive-bc-paid-private-nursing-agencies-508-million-in-just-two-years/).
- Hendrich 2008 walking data (~3.0 mi per ~10 h day shift) is used **only to seed the synthetic cohort**, not in the hook.

### Non-goals
- No diagnosis, no burnout prediction, no clinical/patient data.
- The stress indicator is not a diagnosis. Hard stationary effort (%HRR ≥ 30%) is gated out and counted as physical load.
- No individual-level data for managers, ever; no daily manager view.
- No live streaming of heart rate (dropped in v5: not feasible, and not needed for documentation).
- No LLM-generated advice to managers.
- **Gemini never receives or writes a number.** Code supplies every number.
- No causal claims from the AI ("X caused Y"). Only "after X was logged, Y changed."
- No auto-sending reports in a nurse's name.

---

## 2. Roles and what each sees

| Role | Sees | Never sees |
|---|---|---|
| **Nurse** | Own shift view (physical-load chart, stress points, breaks, watch-off gaps, plain-sentence highlights, sleep before the shift, break ring), batched end-of-shift questions, own shift card (two domain bands + coverage), own shift history, template workload report, settings and privacy | Anyone else's data |
| **Manager** | **Weekly published** unit release: weekly summary, four measure cards, 12-week heatmap (unit × week × shift type) with flags and held-back cells, preset comparisons (split view), unusual-weeks list, action log, participation slider (demo), how the summary is kept honest (validator demo) | Names, pseudonymous IDs, per-shift or daily data, any suppressed cell |
| **Joint committee** (`joint_committee`: both BCNU and health-authority sides of the JRIC / joint OHS committee) | Reporting gap, week-by-week counts, weekly report, purpose limit, **append-only access log** | Individual data |
| **Trustee** (`admin`) | Weekly release button (publishes the weekly numbers, flags and reports) | — |

`charge_nurse` still exists as a role in the auth code but has no pages since relief requests were removed. Charge nurses in BC appear to be unionized peers paid a responsibility premium (Article 30 / Appendix RR in the 2012–2014 agreement) **(verify current agreement)**.

---

## 3. Privacy invariants (hard rules — never break these)

1. **Custody:** the Tiger Cloud project belongs to a **trustee** (BCNU or a university lab), not the health authority. Managers read **only the `published` schema** through a separate service (`ward-manager-api`) whose only database credential is a SELECT-on-`published` role. The release and anomaly jobs read exact data through the separate `release` role on the trustee side.
2. **k = 5 plus the membership-change rule:** suppress any cell with < 5 distinct nurses, **and** any cell whose nurse set differs from an adjacent or overlapping released cell by 1–4 members (0 < |Δ| < k). Released cohorts stored as hashed sets.
3. **Fixed calendar weeks only** for anything managers see; comparisons snap to whole weeks. Proportions **rounded to the nearest 10%**; **Laplace noise** on counts (per-nurse averaging first so sensitivity = 1; ε = 1 **(default — a governance decision for the pilot)**).
4. **Missing data is never green.** Coverage < 70% or a continuous gap > 60 min → "insufficient data" (grey). Missing data can raise a band, never lower it. A gap never counts as a break; the chart draws it as a dashed "watch off" box.
5. Show **proportions**, a **red-rate range** ("missing = like observed" → "missing = red"), **% shifts unknown**, coverage and participation on every manager view. **Participation floor 40% (default)** → "not representative". R4 (coverage < 50%) is a **gate** on every view.
6. **Pseudonymous IDs** (`nurse_pid`, UUID) inside the backend only. Firebase UID → pid mapping in a separate table readable only by `app_rw`.
7. **Shifts come from the nurse's clock-in and clock-out** over automatically uploaded data (v5). Nurses may pause recording or withdraw entirely; they may **not delete a single shift** after it is finalized. Because a nurse can choose not to enter a shift, participation per shift is not guaranteed (see §17).
8. **Raw data deletion:** a shift's raw minutes and windows, and the sleep sessions from the 24 hours before it, are **deleted at shift finalization**. Raw minutes and sleep sessions **no shift claims are deleted after 7 days** **(default)**. A repeat upload never brings back raw data for a finalized shift. Only per-shift metrics and a compact baseline summary persist.
9. **Gemini receives only placeholder keys, metric names and enumerated direction/size labels — no values, no names.** No Gemini on the nurse path. The plan calls for a paid key; the prototype currently runs on the free tier **(fix before any real data)**.
10. **Purpose limit** (no discipline, performance review, fitness-for-duty) shown on screen **next to the access log** and in the nurse's privacy settings. Future: BCNU memorandum making misuse a grievable breach; trustee-held encryption keys.
11. **LIVE / RECORDED / REPLAY / SYNTHETIC badge on every panel.** RECORDED = real watch data uploaded after the shift; REPLAY = simulated day (labelled "simulated"); SYNTHETIC = the made-up unit cohort.
12. Every screen footer: **"Workload documentation tool — not a medical device."**
13. Demo logins (no password) exist for judging only (`AUTH_MODE=both`); they must be switched off (`AUTH_MODE=firebase`) before any real data.

---

## 4. Architecture

```
Samsung watch (prototype) / upper-arm HR band (deployment)
        └─► Samsung Health ──► Health Connect (phone)
                                   │
                    WARD Android app: once a day at a chosen hour (WorkManager)
                    and on "Upload now", reads the last 72 h:
                    heart rate, steps per minute, resting HR, sleep start/end
                                   │  POST /ingest {window_start, window_end, samples, sleep}
                                   │  POST /shifts/clock {start_ts, end_ts}   ◄── nurse enters clock-in/out
                                   ▼
        ┌──────────── Trustee-held ───────────────────────────────────────────────┐
        │ Nurse API — FastAPI on Render (ward-nurse-api, DB role app_rw)           │
        │   minutes → expected-HR prior → residual, %HRR → 5-min windows           │
        │   → shift metrics + sleep before shift → two-domain band                 │
        │   → finalize (delete raw); purge unclaimed raw after 7 days              │
        │                                                                          │
        │ Tiger Cloud (TimescaleDB): core │ published │ audit (access log, roles)  │
        │                                                                          │
        │ Release job (release role, Trustee button): weekly aggregates            │
        │   → k=5 + membership rule → rounding + Laplace noise → published         │
        │ Anomaly job (release role): exact daily → weekly flags → published       │
        └──────────────────────────────────────────────────────────────────────────┘
                                   │
          Manager service — FastAPI on Render (ward-manager-api, published_ro only)
             weekly view · presets/compare · weekly summary · action log · committee
                                   │
     Gemini (gemini-3.8-flash): placeholder keys + metric names + enums only
            → validator (no digits / unknown keys / causal words) → template fallback
                                   │
        Next.js on Vercel + Firebase Auth (email/password; roles in audit.user_roles)
              nurse · manager · joint committee · trustee views
```

### Stack
| Layer | Choice |
|---|---|
| Database | **Tiger Cloud** (managed TimescaleDB), trustee-owned. Fallback: TimescaleDB in Docker (`docker-compose.yml`, port 5433). |
| Backend | **FastAPI** ×2 services (nurse API with `app_rw`; manager service with `published_ro`), psycopg 3 + connection pool |
| ML | pandas, numpy. Expected-HR model is a hand-set linear prior **(LightGBM training not built)** |
| Anomaly detection | pandas: rolling 28-day median + MAD (robust z) |
| Frontend | **Next.js 16** (React, TS), Manrope, lucide icons |
| Phone app | **Android**, Kotlin + Jetpack Compose, Health Connect client 1.1.0, WorkManager, package `ca.ward.app` |
| Auth | **Firebase Auth** (project `ward-1e2ac`), email/password + email verification. Roles `nurse`, `charge_nurse`, `manager`, `joint_committee`, `admin` stored in `audit.user_roles`, set with `backend/scripts/set_role.py`. Demo tokens `dev:<role>:<uid>` while `AUTH_MODE` is `dev` or `both`. |
| Hosting | Website: **Vercel** (`ward-workload-and-rest-dashboard.vercel.app`, root `web/`). Servers: **Render** free plan from `render.yaml` (`ward-nurse-api.onrender.com`, `ward-manager-api-zwo9.onrender.com`). Free services sleep after ~15 min idle; first request then takes up to a minute. |
| Jobs | Buttons (Trustee page runs the weekly release, which also rebuilds flags). No scheduler. |
| LLM | **Gemini** via AI Studio (`gemini-3.8-flash`), weekly summary prose only; free-text question parsing **(not built)** |
| Live updates | None (v5). Relief SSE removed from the UI. |
| Ask your unit | **Preset comparisons**; free text **(not built)** |

Not used: Supabase, Snowflake, Cloud Run. Future: hosting in a Canadian region; Vertex AI Canadian endpoint (if a current model is offered there) or self-hosted Gemma in Canada.

---

## 5. Data sources

### 5.1 Device data
- **Prototype:** Samsung watch → Samsung Health → **Health Connect** → WARD Android app. In Samsung Health turn on sharing to Health Connect, and set watch heart rate to **"Measure continuously"** (Galaxy Watch also has "Every 10 mins while still", which samples only during stillness and would bias everything).
- **What the app reads (each upload, last 72 h):** `HeartRateRecord` (every sample), `StepsRecord` (Health Connect's per-minute total, which removes double counting), `RestingHeartRateRecord` (latest in the past week), `SleepSessionRecord` (start and end only, never stages). It also asks for background read access so the daily job can run.
- **Why 72 hours every time:** Samsung Health writes to Health Connect late (older watches especially), so each upload re-reads three days and the server replaces what it had for that stretch. Nothing doubles.
- **Daily upload:** WorkManager job at the hour the nurse picks (default 20:00); Android may shift it to save battery. "Upload now" runs it on demand.
- **Clock-in/out:** the nurse enters the date and times in the app or on the website; a clock-out earlier than the clock-in means past midnight. The server builds the shift from minutes already uploaded.
- **Status:** the app connects to the server and Health Connect; the first real upload returned no heart-rate readings (Samsung Health had not synced; the test watch is old and slow to sync). A real-watch shift has **not** been built end to end yet.
- **Deployment form factor:** upper-arm optical HR band, mid-bicep under the scrub sleeve, wipeable strap, IPC sign-off. **(verify)** which arm bands write continuous HR to Health Connect.
- **Secondary:** Fitbit Air → Google Health app **(verify)** Health Connect support.
- Health Connect has **no raw accelerometer** and **no beat-to-beat intervals**.
- **30-day history import:** the endpoint exists (`POST /onboarding/history`) but the app does not send history yet **(not built in the app)**.
- **Demo day:** a **simulated** 12-hour shift (`backend/scripts/make_replay_day.py` → `data/replay/recorded_day.json`): brisk walks, a stationary-effort block, standing still with raised heart rate, two breaks (the first 5 h 40 min in), 40 minutes watch-off, and sleep the night before. Replace with a real recording when one exists.
- **Future:** Wear OS app on the Samsung Health Sensor SDK (25 Hz accelerometer + inter-beat intervals on Galaxy Watch4+; needs Samsung Partner Program approval beyond developer mode).

### 5.2 Training and evaluation data (none downloaded yet)
- **Model (a), expected HR given activity (primary, no labels):** crowd-sourced Fitbit minute data (Zenodo 53894, CC BY 4.0, ~45 MB) + **PMData** (OSF; licence CC BY-NC 4.0 per paper vs CC BY 4.0 per page **(verify)**; evaluation-only if NC) + **LifeSnaps** (Zenodo login; licence and HR interval **(verify)**, optional). Per-nurse calibration from the nurse's own Health Connect history.
- **Residual and classifier tests:** **Hongn et al. 2025**, PhysioNet "Wearable Device Dataset from Induced Stress and Structured Exercise Sessions" (Empatica E4; stress / aerobic cycling / anaerobic sprints; 36/30/31 participants; ODC-By; 247 MB). Cycling = high HR with almost no steps — WARD's hardest case. Check subject overlap across sessions **(verify)**. **Stress-Predict** (E4, 35 people, CC BY 4.0) for mental vs rest. **WESAD** (non-commercial) evaluation only.
- **Step-proxy calibration:** **PPG-DaLiA** (E4 + chest ECG, CC BY 4.0).
- **Field transfer test:** Hosseini et al. 15 ER nurses, E4 — [paper](https://pmc.ncbi.nlm.nih.gov/articles/PMC9159985/) · [Dryad](https://datadryad.org/dataset/doi:10.5061/dryad.5hqbzkh6f). Licence: CC0 on Zenodo vs CC-BY 4.0 recorded for Dryad **(verify Dryad page)**. Caveats: labels RF-seeded then nurse-confirmed; 15 women, one ER, COVID.
- **Stretch:** **TILES-2018** (212 hospital workers, 113 RNs; Fitbit Charge 2 HR + steps/min; daily stress, anxiety, PANAS; shift type; ~100 GB), DUA required. **Never** in the repo, demo replay or synthetic generator.
- **Rejected:** K-EmoPhone, GLOBEM, All of Us, MMASH, BROWNIE and firefighter studies, Kaggle Sleep Health and Lifestyle.
- **Licence rule:** the shipped model prior is trained on permissively licensed data only. Non-commercial datasets are for evaluation only.

### 5.3 Synthetic unit cohort
Needed because multi-nurse real data can't exist yet. Spec in §9. Always badged SYNTHETIC.

---

## 6. Data model (Tiger Cloud)

`db/schema.sql` plus migrations `db/migrations/001_sleep.sql` and `002_user_roles.sql` (both applied to the cloud database).

### Core schema (trustee side)
| Table | Type | Key columns |
|---|---|---|
| `units` | table | `unit_id`, `name`, `hospital` (4west, 5east, icu2, er) |
| `nurse_identity` | table, `app_rw` only | `firebase_uid`, `nurse_pid`, `display_name` |
| `nurses` | table | `nurse_pid`, `unit_id`, `birth_year`, `hr_rest`, `hr_steps_model_json`, `baseline_status` (provisional/ready), `rotation_json`, `opted_in_at`, `paused_until`, `withdrawn_at`, `is_synthetic` |
| `minutes` | hypertable on `ts`; raw, deleted at finalization or after 7 days if unclaimed | `ts`, `nurse_pid`, `hr_sum`, `hr_n`, `steps` |
| `windows` | hypertable on `ts`; deleted at finalization | `ts`, `nurse_pid`, `shift_id`, `hr_mean`, `steps`, `valid_minutes`, `pct_hrr`, `hr_expected`, `hr_excess`, `unexplained` (bool) |
| `sleep_sessions` | table; deleted with the shift that uses them, or after 7 days | `nurse_pid`, `start_ts`, `end_ts`, `source_device` |
| `shifts` | **hypertable** on `start_ts` | `shift_id`, `nurse_pid`, `unit_id`, `start_ts`, `end_ts`, `planned_end_ts`, `shift_type`, `data_mode` (live/recorded/replay/synthetic), `source_device`, `finalized`, `time_on_feet_min`, `longest_on_feet_min`, `mean_pct_hrr`, `min_above_30_hrr`, `longest_no_break_min`, `n_breaks_confirmed`, `breaks_uncertain`, `unexplained_hr_min`, `coverage_pct`, `max_gap_min`, `sleep_before_min`, `phys_band`, `recovery_band`, `band` (green/amber/red/insufficient), `ratio_status`, `drained_rating`, `is_synthetic` |
| `break_events` | table | `break_id`, `shift_id`, `start_ts`, `end_ts`, `source` (suggested/manual), `status` (confirmed/rejected/unanswered) |
| `report_counts` | table, **no nurse id** | `unit_id`, `week_start`, `reports_sent` |
| `manager_actions` | table | `action_id`, `unit_id`, `week_start`, `action_type`, `note`, `created_at` |
| `relief_requests`, `relief_counts` | tables, **unused since v5** | kept for now; remove in cleanup |

### Audit schema
| Table | Key columns |
|---|---|
| `access_log` (append-only) | `ts`, `service`, `role`, `endpoint`, `params_hash` |
| `user_roles` | `firebase_uid`, `email`, `role` (NULL until assigned), `unit_id` and `display_name` (nurses), `created_at` |

### Internal aggregates (release role only)
- Weekly and daily unit aggregates over `shifts`: `n_shifts`, `pct_red`, `pct_insufficient`, `pct_no_break_5h`, `pct_ratio_met_and_breaks`, median `time_on_feet_min`, mean `mean_pct_hrr`, mean `unexplained_hr_min`, mean `coverage_pct`, `red_shifts`.
- Distinct nurses and cohort sets are computed in plain queries (continuous aggregates don't support `COUNT(DISTINCT ...)` **(verify)**).

### Published schema (manager-readable)
| Table | Key columns |
|---|---|
| `published_unit_weekly` | `unit_id`, `week_start`, `shift_type`, `suppressed` (bool + reason), `participation_pct`, `coverage_pct`, `pct_red_low`, `pct_red_high`, `pct_insufficient`, `pct_no_break_5h`, `pct_ratio_met_and_breaks`, `phys_load_band`, `red_shifts_noised`, `reports_sent_noised` — proportions rounded to 10%, counts Laplace-noised. Built for participation scenarios 20–100% (demo slider). |
| `published_flags` | `unit_id`, `week_start`, `shift_type`, `metric`, `direction`, `ratio_rounded` ("about 3× usual") |
| `released_cohorts` | `unit_id`, `week_start`, `shift_type`, `cohort_hash_set` |
| `weekly_reports` | `unit_id`, `week_start`, `payload_json` (published values only), `narrative`, `generated_at` |
| `manager_actions` (view) | read/write for manager service |

### DB roles
- `app_rw` — nurse API; core schema.
- `release` — reads core, writes `published`; runs release + anomaly jobs.
- `published_ro` — manager service; SELECT on `published` (+ insert on `manager_actions`, insert on the access log). Nothing else.

### Reporting gap
`red_shifts` vs `reports_sent` → "About 120 red shifts, about 20 reported" over 12 weeks (noised/rounded in the published release; synthetic in the demo).

---

## 7. ML pipeline (expected-HR model and stress indicator)

**Status:** the code runs on a **hand-set, untrained prior** (`backend/shiftload/expected_hr.py`: expected excess HR = 5 bpm + 0.30 × mean steps/min over 3 min, capped at 70, with per-nurse intercept and slope). It has no measured accuracy and the API reports it as `untrained prior`. Steps 1–11 below are the plan.

| Step | Spec |
|---|---|
| 1. Load | Fitbit pool (Zenodo 53894 + PMData + optional LifeSnaps). Resample HR to 1-min means; steps per minute. **Drop sleep minutes.** Randomly drop minutes to match measured Health Connect sparsity. |
| 2. Target | HR − HRrest. |
| 3. Features **(defaults)** | steps_t; summed steps over last 1/3/5/10/20 min; minutes since last ≥ 20-step bout; hour of day. |
| 4. Model | **LightGBM regressor**, monotone-increasing in step features, vs a **linear-in-lags baseline**. |
| 5. Evaluate (a) | **Leave-one-subject-out MAE (bpm)** vs a "resting HR only" baseline. Leave-one-dataset-out. |
| 6. Residual | residual = HR − predicted. A minute counts toward the stress indicator if residual > threshold **(prototype: 12 bpm placeholder; plan: 95th percentile of LOSO residuals in awake low-step minutes)** **and** %HRR < 30% **and** steps/min < 5 **(default)**. A 5-min window counts if ≥ 3 of 5 minutes qualify **(default)**. |
| 7. Transfer tests | **Hongn**: AUROC of residual for stress-task vs rest; **cycling false-flag rate with and without the %HRR gate**. **Stress-Predict:** mental vs rest AUROC. **Nurse set:** AUROC vs confirmed labels, next to the "HR − baseline > X bpm" rule. |
| 8. Optional (b) | 3-class rest / mental / physical on Hongn. **Ship only if it beats step 6 on the transfer tests.** First thing cut. |
| 9. Personalisation | Per-nurse intercept + slope from the nurse's own Health Connect history. Badge "baseline: provisional" until enough data. |
| 10. Report | One slide: MAE; residual AUROC on Hongn; cycling false-flag rate before/after gate; nurse-set result vs the rule. **Never random splits.** |
| 11. Export | `expected_hr_model.joblib`, residual threshold, feature list, training-data manifest with licences. |

**Honest accuracy to expect:** physical-vs-mental separation within a person ~0.31 precision / 0.32 recall even with an accelerometer (Psychophysiology 2025, N = 197); free-living momentary stress across subjects ~0.52 macro-F1 (K-EmoPhone); daily anxiety from watch HR on TILES ~59% balanced accuracy; lab models drop from ~0.95 to ~0.72 AUROC across devices.

---

## 8. Metrics and banding

### %HRR (physical load)
`%HRR = (HR − HRrest) / (HRmax − HRrest)`; **HRmax = 208 − 0.7 × age** (Tanaka; birth year at onboarding). **HRrest** = the resting heart rate from the first upload that includes one (median of `RestingHeartRateRecord` values), else the lowest 5-min HR in the shift.

### Coverage rules (defaults)
- A minute is valid only with ≥ 1 HR sample. Steps = 0 with no HR = non-wear, not rest.
- A 5-min window is scored only if ≥ 4 of its minutes are valid.
- Shift is **insufficient** if coverage < 70% or a continuous gap > 60 min.

### Per-shift metrics
| Metric | Definition **(defaults)** |
|---|---|
| `mean_pct_hrr` | mean %HRR over valid shift minutes |
| `min_above_30_hrr` | minutes with %HRR ≥ 30% |
| `time_on_feet_min` | minutes with steps > 0 (context) |
| `longest_on_feet_min` | longest run without a ≥ 10-min sedentary gap (steps < 5/min) (context) |
| suggested breaks | ≥ 20 sedentary minutes with mean %HRR < 20%; the nurse confirms them |
| `longest_no_break_min` | longest interval between shift start / confirmed break end and next confirmed break start / shift end |
| `breaks_uncertain` | true if the nurse skipped the questions |
| `unexplained_hr_min` | stress indicator: 5 × windows flagged (context only — **never sets the band**) |
| `sleep_before_min` | total sleep in the 24 h before shift start, from Health Connect sessions (context only) |
| `ratio_status` | nurse-entered at shift end: met / not met / unknown |
| `drained_rating` | optional 1–10 tap — **criterion, not input** |
| `post_shift_recovery` | next sleep's resting HR vs baseline — **(not built)** |

### Two-domain banding
- **Physical domain** (`phys_band`): `mean_pct_hrr` **amber ≥ 24.5%**, **red ≥ 33%**.
- **Recovery-opportunity domain** (`recovery_band`): `longest_no_break_min` **red ≥ 300**; **amber ≥ 80th percentile** of the nurse's own history (240 min at cold start **(default)**), labelled provisional. If `breaks_uncertain` and no red trigger → grey.
- **Hard red overrides:** `longest_no_break_min` ≥ 300 or shift length > 12.5 h **(default)** — apply even when coverage is insufficient.
- **Shift band = worse of the two domains**; insufficient coverage turns a would-be green/amber into grey, never into green.
- **Validation:** Spearman correlation of domain scores vs `drained_rating` on whatever real shifts exist; state the tiny n.
- **Never rank individual nurses.**

### What the nurse sees on a shift
- Chart: physical load line, orange stress points, violet break bands, dashed "watch off" boxes; tap a highlight to light up its stretch.
- Highlights, one short sentence each: "Heart working hard at 09:30" (≥ 30% for ≥ 10 min), "Stress was high at 10:50", "You slept 5 h 50 min before this shift" (under 6 h), "No break for 5 h 40 min" (≥ 5 h).
- Break ring: time since the last break out of 5 hours (amber from 4 h, red from 5 h); it refills each time it scrolls back into view.
- Tiles: average load, stress minutes, sleep before, recorded %.

---

## 9. Synthetic unit cohort

- 4 units ("4 West Med-Surg", "5 East Med-Surg", "ICU 2", "ER"), ~30 nurses each, **participation as a slider (default 60%, scenarios 20–100%)**, **≥ 60 days**, day + night shifts.
- Seed walking distances from Hendrich 2008 (scaled to 12 h) and the unit ranking **ER > ICU > surgical > medical** from Chang & Cho 2022. Nights carry higher no-break probability. 4 West has a worse last month.
- **Seeded random anomaly planting** with an answer key the detector never reads, plus a **null cohort** with nothing planted.
- Small cells and cohort churn so suppression and the membership rule visibly fire.
- Every row `is_synthetic = true`; SYNTHETIC badge in UI.

---

## 10. AI layer

### 10.1 Anomaly detection (trustee side, exact daily data)
- **Series:** per (`unit_id`, `shift_type`), daily `pct_red`, `pct_no_break_5h`, mean `mean_pct_hrr`, mean `unexplained_hr_min`, `pct_insufficient`.
- **Method:** robust z vs previous 28 days: `(value − median) / (1.4826 × MAD)`. Flag `|z| ≥ 3` **(default)**; only cells with ≥ 14 days history, n ≥ 5, coverage ≥ 50%; skip if MAD = 0.
- **Managers see weekly flags only**, ratio rounded ("nights: about 3× usual").
- **Blind evaluation (run; `backend/scripts/eval_anomaly.py` → `data/eval/anomaly_eval.json`), 50 seeds, 60% participation, synthetic data:**
  - recall: **large 54%** (38/70), **moderate 36%** (21/59), **small 20%** (14/71);
  - **6.8 false alarms per 100 unit-days** on the null cohort (1,098 of 16,069);
  - 200 further planted anomalies fell in cells below n = 5 and could not be flagged by design.
  - These show method behaviour on assumed data shapes, not real units. The false-alarm rate is high; raising the threshold or requiring two consecutive days is the next tuning step.

### 10.2 Weekly summary (merged with the weekly report)
- One artifact per unit per week.
- Payload builder (code, from `published`): top changes vs previous week, flags, actions logged, data quality. Each item becomes a **placeholder key + metric name + direction enum + size enum**. **No values go to Gemini.**
- Gemini returns structured JSON `{headline, changes[], flags[], actions[]}` using placeholders; code substitutes rounded published values after validation and always writes the data note itself.
- Retries only on a 503 (busy); on any failure or rejection the template text is used. Today the free-tier daily limit is used up, so summaries show the template.
- Wording: describe what changed, never why. Green week = "no evidence of overload in recorded shifts (coverage X%, participation Y%)".

### 10.3 Ask your unit
- **Preset comparisons (built):** "This week vs last", "Nights vs days", "This month vs last" (4 whole weeks), "vs {another unit}" with a unit picker — each builds a `ComparisonRequest` (`POST /manager/compare`), no Gemini.

```
ComparisonRequest {
  compare_by:  "period" | "unit" | "shift_type"
  units:       [unit_id]            // 1, or 2 when compare_by = "unit"
  shift_type:  "day" | "night" | "all"
  metrics:     [metric_enum] | "all"
  period_a:    {week_start, n_weeks}
  period_b:    {week_start, n_weeks} | null
}
```
- **Free text (not built).**
- Runs only against `published`. Membership rule applies to both sides; max 13 weeks.
- **Split view:** A | B bars per metric with "A is N points lower/higher", an interpretation sentence written **by code**, warnings (suppressed, not representative, coverage mismatch > 20 points).

### 10.4 Gemini rules
- One shared client + validator. Validator rejects any **digit**, any **placeholder not in the payload**, any **causal word** ("because", "caused", "due to", "led to") → template fallback.
- **Validator demo built:** manager page → "How the written summary is kept honest" → "Try it with a bad draft" shows a canned bad draft, the rejection reason, the template used instead, and exactly what the AI would have been sent.
- Honest pitch sentence: "Nurse data stays with the trustee; the only thing sent to Gemini is number-free text about metric names."

---

## 11. Flows

### Onboarding (nurse)
1. Create an account on the website (email + password), confirm the email link, sign in once.
2. An administrator assigns the role and unit: `python scripts/set_role.py <email> nurse --unit 4west --name "Name"`.
3. Website: consent + purpose limit → birth year + shift pattern (two steps).
4. Phone: install the WARD app, sign in with the server address and the same email/password, allow Health Connect access (including background), pick the daily upload hour.

### During the shift
Nothing. The watch records as usual; nothing is streamed.

### After the shift
1. The daily upload (or "Upload now") sends the last 72 hours of watch data.
2. The nurse enters clock-in and clock-out (app or website). The server builds a RECORDED shift from the uploaded minutes; it refuses if no heart rate was uploaded for that time yet, if the shift hasn't finished, or if it isn't 1–16 hours long. Entering the times again replaces an unfinished attempt.
3. The nurse reviews the shift (chart, highlights, ring) and taps **Review and finish**: confirm each suggested break → ratio met? → how drained (optional) — or skip all questions.
4. Shift finalized: metrics, two domain bands, coverage, sleep → **raw data deleted**.
5. If **red**, a **template** workload report appears, labelled as an attachment for the **BCNU Professional Responsibility Process (Appendix KK)** / Article 32 committee (verify current article numbers). "Copy text"; the nurse sends it themselves and taps "I sent this report", which increments `report_counts` only.
6. The shift appears in My shifts (All / Red).

### Demo login (judging)
- Nurse demo login (Alex R.) on the site and the app. "Play a recorded day" / "Play it fast" replays the simulated day through the real ingest path (REPLAY · SIMULATED).
- On a demo login, "Save this shift" always fills the entered clock-in/out with the simulated day (stretched to fit) and labels it simulated; saving the same times again replaces the earlier demo shift. Real accounts only ever use real watch data.

### Weekly release (Trustee button)
1. Release job: weekly aggregates → k = 5 + membership rule → rounding + Laplace noise → `published_unit_weekly`, `released_cohorts`.
2. Anomaly job → `published_flags`.
3. Weekly report + summary (Gemini under §10.4).

### Manager
- Weekly summary card; four measure cards (Red shifts, 5 hours no break, Ratio met + breaks, Unknown) for days and nights with change vs last week.
- 12-week heatmap (this unit or all units) with flags (red dot = unusual week), held-back cells (dashed) with the reason on hover; "Why are some weeks empty?" (too few nurses, group changed, low participation, low coverage).
- Compare presets → split view; unusual weeks list; action log (`float_for_breaks`, `called_in_staff`, `reassigned_patients`, `none` + note).
- Demo-only participation slider; validator demo.
- Good-news metric: **% shifts with ratio met and breaks taken**. Rule-based suggestions R1–R3 cut; R4 is a gate.

### Joint committee
Reporting gap (headline + bar), week by week, weekly report, purpose limit, access log (latest requests; nobody can change or delete a row).

---

## 12. API contract

### Nurse API service (`app_rw`) — `https://ward-nurse-api.onrender.com`
| Method & path | Role | Purpose |
|---|---|---|
| `GET /health` | — | health check |
| `POST /session` | any signed-in account | records the account on first sign-in, returns its role; creates the nurse's pseudonymous record the first time a nurse role signs in |
| `GET /me` | nurse | profile, onboarding state, purpose limit |
| `POST /onboarding` | nurse | birth year, rotation |
| `POST /onboarding/history` | nurse device | 30-day history import (app doesn't call it yet) |
| `POST /me/settings` | nurse | pause recording (days) |
| `POST /me/withdraw` | nurse | delete all this nurse's data |
| `POST /ingest` | nurse device | `{source_device, window_start?, window_end?, samples:[{ts, type: "hr"\|"steps"\|"resting_hr", value}], sleep:[{start_ts, end_ts}]}`; a window replaces stored minutes for that stretch; purges unclaimed raw data older than 7 days; refused while paused |
| `POST /shifts/clock` | nurse | `{start_ts, end_ts}` → builds a recorded shift from uploaded minutes (demo logins: simulated day) |
| `POST /shifts/start` · `POST /shifts/{id}/correct` | nurse | live-mode leftovers (unused by the UI) |
| `GET /me/shift/current` | nurse | the open shift: windows, metrics, suggested breaks, time since last break, sleep before |
| `POST /shifts/{id}/propose` | nurse | suggested breaks to confirm |
| `POST /shifts/{id}/end` | nurse | `{breaks:[{id, status}], skipped, ratio_status, drained_rating?}` → finalize |
| `GET /me/shifts` | nurse | own finalized shifts |
| `GET /me/reports/{shift_id}/draft` · `POST /me/reports/{shift_id}/sent` | nurse | template report; increment counter |
| `POST /replay/start` | nurse (demo) | replay the simulated day `{speed}` |
| `POST /jobs/release/run` · `POST /jobs/anomalies/run` | admin (trustee) | weekly release (also rebuilds flags) |
| `/relief*` | — | unused since v5 |

### Manager service (`published_ro` only) — `https://ward-manager-api-zwo9.onrender.com`
| Method & path | Role | Purpose |
|---|---|---|
| `GET /health`, `GET /meta` | manager, committee | units, weeks, participation scenarios |
| `GET /manager/weekly?scenario=` | manager | published weekly cells |
| `GET /manager/flags?scenario=` | manager | weekly flags |
| `GET /manager/summary` | manager | weekly summary |
| `POST /manager/compare` | manager | `ComparisonRequest` → split view |
| `GET /manager/actions` · `POST /manager/actions` | manager | action log |
| `POST /manager/validator-demo` | manager | canned bad draft → rejection → template |
| `GET /reports/weekly/{unit}/{week}` | manager, joint_committee | weekly report |
| `GET /committee/gap` | joint_committee | reporting gap |
| `GET /committee/access-log` | joint_committee | access log |

Every request writes the access log (service, role, endpoint, params hash, ts). Auth: Firebase ID token (verified server-side, email must be verified) with the role looked up in `audit.user_roles`; or a demo token while `AUTH_MODE` allows it.

---

## 13. Frontend views

### Website (Next.js on Vercel)
- **Sign-in:** email/password sign in, create account, email verification, demo logins (Nurse, Manager, Joint committee, Trustee).
- **Nurse:** My shift (Add a shift + Demo panel when nothing is open; otherwise the chart, highlights, break ring, tiles, Review and finish / End shift), finishing questions (one per screen), shift card + workload report, My shifts (All / Red), Settings & privacy (pause, your data, purpose limit, withdraw and delete).
- **Manager**, **Joint committee**, **Trustee:** as in §11.
- **Every panel:** LIVE / RECORDED / REPLAY / SYNTHETIC badge; footer disclaimer. Light and dark theme.
- **Design:** soft rounded cards, teal + navy, Manrope, icon rail, animated chart (no play bar), big plain sentences instead of small explanatory text. Design notes in `PRODUCT.md` and `DESIGN.md`.

### Android app (`android/`, APK at `android/WARD.apk`, git-ignored)
- Sign in (server address, email, password) or **Demo login (no password)**; default server `https://ward-nurse-api.onrender.com`.
- Tabs: **My shift** (the same chart, stress points, breaks, watch-off box, highlights, ring and tiles as the site; End shift → the three questions → shift card; with no shift open: Add a shift + Demo), **My shifts** (All / Red, each opens the card and red-shift workload report with Copy text and "I sent this report"), **Upload** (Health Connect access, daily upload hour, Upload now, sign out).
- Not in the app: first-time setup (done once on the website), settings, chart hover tooltips.

---

## 14. Framing, governance and business model

- **Custody:** trustee (BCNU or a university lab) holds the database; health authority has no credentials. FIPPA allows employer collection of employee information only when "necessary for managing or terminating an employee relationship"; nurse-initiated, trustee-held collection is more likely under PIPA — an inference that needs a lawyer — [OIPC BC](https://oipc.bc.ca/guidance-documents/2098). Model for the future: Population Data BC-style stewardship. Precedent for worker-held data: UNI Global Union's WeClock.
- **Governance:** the **JRIC** (six core members split equally between BCNU and the health authority) governs the tool; draft **joint terms of reference** (k = 5, no individual data, purpose limit, aggregates may not be cited to deny a workload report or grievance) — [BC Gov JRICs](https://www2.gov.bc.ca/gov/content/health/practitioner-professional-resources/mnpr/mnpr-governance/joint-regional-implementation-committees).
- **Who pays:** Stage 1 WorkSafeBC Innovation Grant (Proof of Principle and Prototyping stream) with an SFU academic lead → Stage 2 single-unit JRIC/OHS pilot → Stage 3 per-unit licence from health-authority retention/mNPR budgets (agency/overtime avoidance; turnover cost ~$17k–$40k CAD per RN in 2025 dollars, from pre-2010 studies).
- **Competitors:** Kinetic REFLEX (employer-bought posture sensor, logistics), Oura for Business (opt-in, anonymized aggregates, sleep/readiness, 200+ orgs), Whoop clinician discount. **Edge:** trustee custody, nurse-specific metrics (no-break stretch, %HRR over 12-h shifts), outputs mapped to BC processes (PRP, reporting gap, JRIC).
- **Watch rules:** Fraser Health policy (April 2018 version) bans wrist jewellery including watches for direct care **(verify current)**; Island Health (Sept 2023) allows wrist accessories that push up; provincial 2013 communiqué only "strongly recommends" removal. → **watch = prototype, upper-arm band = product.**
- **Regulatory:** staff workload tool, no individual health claims → clear of Health Canada SaMD.
- **Residency (prototype is not in Canada yet):** Render free services run in Render's default region (Oregon, US) **(verify in the Render dashboard)**; Vercel serves globally; Tiger Cloud region **(verify)**; Firebase Auth user store **(verify)**; Gemini offers no residency guarantee, hence number-free prompts. A pilot needs Canadian hosting for the servers and database.
- **Entry route:** university research / QI study with ethics approval and a health-authority research partner.

---

## 15. Build status (2026-10-04)

### Done
- Database schemas, roles, migrations; seed with the synthetic cohort; release job (k = 5, membership rule, rounding, Laplace noise, participation scenarios); anomaly detection + blind evaluation.
- Nurse API and manager service; 45 backend tests passing (`backend/.venv/Scripts/python -m pytest backend/tests`).
- Website: all four roles, sign-in with Firebase + demo logins, nurse flow end to end, manager/committee/trustee views, redesign.
- Daily upload + clock-in/out (backend, site form, app); sleep; 7-day purge; repeat uploads replace rather than double.
- Android app with the full nurse experience and demo login.
- Hosting: Vercel + Render (`render.yaml`) + Tiger Cloud, CORS set for the Vercel site.
- Demo video (2:27, voiceover + captions) in `demo-video/` (git-ignored).

### Not done / next
- [ ] Real watch shift end to end (needs Samsung Health → Health Connect sync; the test watch syncs slowly)
- [ ] Train the expected-HR model and run the transfer tests (datasets not downloaded)
- [ ] Gemini paid key (free tier used up → template summaries)
- [ ] 30-day history import from the app; free-text "ask your unit"; post-shift recovery
- [ ] Canadian hosting; verify regions
- [ ] Remove relief leftovers (endpoints, tables, `charge_nurse` role); update the stale README
- [ ] Fix: after "Finish shift" the site briefly shows the empty shift screen before the card
- [ ] Fix three ESLint "setState in effect" errors; minor design leftovers (axis label overlap, hover lift on non-clickable cards)
- [ ] Turn off demo logins before any real data; consider removing Google Analytics from the Firebase project
- [ ] Tune the anomaly detector's false-alarm rate

---

## 16. Demo script (2:30 video; same order works live)

| Time | Show | Say (short) |
|---|---|---|
| 0:00–0:13 | Title card: twelve-hour bar, first break at hour six | "Twelve-hour shift. First break at hour six. The only record is how tired you feel — not enough to file a workload report." |
| 0:13–0:23 | WARD title; watch → Health Connect → WARD app (daily upload) | "WARD turns the watch a nurse already wears into a workload record. Once a day the phone pulls heart rate, steps and sleep." |
| 0:23–0:28 | Site: Add a shift (yesterday 07:00–19:00) → Save | "Enter clock-in and clock-out, and WARD builds the shift." |
| 0:28–1:00 | Shift view (REPLAY · SIMULATED): load line, stress points, breaks, watch-off box, tap "Stress was high at 10:50", tiles, ring | "Missing data never counts as a break, and never makes a shift look better." |
| 1:00–1:25 | End shift → breaks → ratio not met → drained 8 → red card → workload report → Copy text | "Red: over five hours without a break. WARD drafts the report; nothing is sent for you; raw data is deleted." |
| 1:25–1:56 | Manager (SYNTHETIC): summary, measure cards, heatmap, held-back cell + reason, flag, Nights vs days, bad-draft demo | "Weekly unit totals only, groups of five or more, rounded, with noise. The AI never sees a number or a name." |
| 1:56–2:11 | Joint committee: reporting gap, purpose limit, access log | "Red shifts versus reports actually sent, and a log of who looked at what." |
| 2:11–2:28 | Settings & privacy "Your data", footer, end card | "A trustee holds the data. Not a medical device. The next report comes with proof." |

Live demo extras: install the app on a phone, demo login, Save this shift; drag the participation slider on the manager page; run the weekly release on the Trustee page. Open the site a minute early so the Render servers are awake.

Numbers slide: anomaly recall by size and false alarms per 100 unit-days (§10.1, synthetic). Expected-HR model numbers only once trained.

---

## 17. Known limitations (state them, don't hide them)
- HR + steps cannot separate psychological stress from stationary physical effort (~0.3 precision even with an accelerometer).
- The expected-HR model is an **untrained hand-set prior**; the stress indicator threshold is a placeholder.
- No real-watch shift has been processed end to end yet; Samsung Health can take hours to pass data to Health Connect.
- Shifts exist only if the nurse enters clock-in/out, so skipped entries could bias unit numbers (participation per shift is unknown).
- The daily upload carries off-shift heart rate and sleep; unclaimed raw data is kept up to 7 days, a change from "shift data only".
- Unit-level views run on synthetic data; the anomaly evaluation shows method behaviour on assumed data shapes, with a high false-alarm rate (6.8 per 100 unit-days).
- Missing-not-at-random non-wear is visible but uncorrected.
- Small units force a privacy/utility trade-off: noise on a 10–20 nurse unit is ~7–14 percentage points, so managers get weekly, not daily.
- No evidence that workload displays change staffing; no case of wearable data in a Canadian nurse grievance.
- %HRR anchors come from 8-h industrial/older studies cited second-hand; wrist/arm PPG is noisier during arm-heavy work.
- Prototype hosting is outside Canada, on free plans that sleep; Gemini runs on a free key; demo logins are open.
- Wrist devices may be banned in direct care; arm bands unvalidated in nurses.

## 18. Open items
1. Real-watch upload test (sync delay, HR interval walking vs still, resting HR, sleep sessions)
2. Download training datasets (yes/no) and train the expected-HR model
3. Gemini billing
4. Render, Tiger Cloud and Firebase regions; move to Canada for a pilot
5. Current Fraser Health hand hygiene policy
6. Current NBA/BCNU collective agreement (Appendix KK, Article 32, Article 30, Appendix RR)
7. PMData licence (OSF); nurse dataset licence (Dryad); LifeSnaps licence + HR interval; Hongn subject overlap
8. TILES-2018 DUA
9. Which arm bands write continuous HR to Health Connect
10. Nurse conversation (clock-in/out burden, break confirmation, arm band acceptability)
11. Firebase authorized domain for the Vercel site (needed for real sign-in there) **(verify done)**

---

## 19. Judge answers (one line each)

| Attack | Answer |
|---|---|
| "They already know" | Staffing processes run on dated, unit-specific records, and two-thirds of nurses fear filing them. We make the record automatic and measure the reporting gap — a number nobody in BC has. |
| "Standing still isn't resting" | Agreed. Effort is heart-rate reserve, which rises when you turn a patient with zero steps. Heart rate that is high while stationary and below that effort level is our stress indicator; it does not set the band. |
| "Is it live?" | Deliberately not. Documentation doesn't need streaming: the phone uploads once a day, the nurse enters clock-in and clock-out, and the shift is built from real watch data. The demo shift is a badged replay; the unit view is badged synthetic. |
| "Is your model trained?" | Not yet — it's a labelled hand-set prior. The plan is consumer Fitbit minute data, tested on a dataset we never train on, against a simple rule. |
| "Who holds the data?" | A trustee, not the health authority. The hospital side only has a credential for a weekly release table; raw HR is deleted at shift end; every query is logged for the union. |
| "Data leaves Canada via Gemini" | Gemini gets placeholder keys and metric names — never a number or a name. Nurse-facing text is templates. (The prototype servers are not in Canada yet; a pilot would be.) |
| "You found your planted anomaly" | On 50 random seeds it never saw the key for, it caught 54% of large, 36% of moderate and 20% of small anomalies, with 6.8 false alarms per 100 unit-days. The data is synthetic and badged, and the false-alarm rate is the next thing to tune. |
| Burden / participation | Nothing during the shift. After it: clock-in, clock-out, and one batch of break questions (skippable). Every view shows participation so a thin unit says so. |
| "Who pays?" | WorkSafeBC prototyping grant → JRIC pilot → retention budget. BC spent $508M on agency nurses in two years. |
| "Why would a hospital allow it?" | It's a JRIC tool — half BCNU, half health authority — telling the hospital whether ratios are met without nurses skipping breaks. |
| "Data cuts both ways" | Missing data is never green; green weeks say "no evidence of overload at X% coverage"; the ToR bars using aggregates to deny a report. |
| Watch ban | The watch is the prototype; the pipeline takes HR + steps from any Health Connect device; the product is an upper-arm band. |
| Differencing | Fixed weeks, rounded, noised, and any cell differing from a neighbour by fewer than five nurses is suppressed. Daily detail stays with the trustee. |
| Function creep | Raw HR is gone at shift end (and within 7 days if never used), the hospital has no credential for individual rows, queries are logged; in deployment misuse is a grievable breach. |
| "Why sleep?" | Short sleep before a 12-hour shift is part of the workload story. We keep only how long, never stages, and it never sets the band. |
| Arbitrary thresholds | Anchored to occupational heart-rate-reserve limits and a five-hour no-break rule; the rest is a labelled percentile; the drained rating is what we validate against. |
| Thin evidence | Nobody has shown dashboards change staffing; we feed the documentation processes that have, and the action log is built to measure it. |
| Cold start | %HRR needs age and resting HR; resting HR arrives with the first upload. |
| "Too much for one hackathon" | Shift in, card out, report drafted, weekly release published — on a phone app, a hosted site and two hosted services — and everything on screen works. |
| "Why AI?" | An anomaly detector with measured recall and false-alarm rates, and (next) a tested expected-HR model. Gemini only writes sentences around numbers we computed — here's the validator rejecting it. |
| "Wearables exist" | Oura for Business does anonymous sleep scores bought by employers. We measure the shift, a trustee holds the data, and every output feeds a BC process that already exists. |
