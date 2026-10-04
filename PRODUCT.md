# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Three audiences carry equal weight; no one of them wins design trade-offs by default (confirmed 2026-10-04).

- **Nurses on shift** in BC hospital units, working 12-hour day or night shifts. They are busy and often cannot look at a screen. The intended contact is notifications on the phone and watch, plus brief phone glances when they are able. Their jobs: know how long since a break, ask for relief, confirm breaks at end of shift, keep their own red-shift history, and decide whether to send a workload report.
- **Managers and the joint committee** (both union and health-authority sides). They read weekly unit-level numbers to see where workload is heavy, compare units and periods, log actions, and see the gap between overloaded shifts and filed reports. They never see an individual.
- **Hackathon judges** (StormHack). They see a 3–4 minute walkthrough and need to understand each screen at once.

Also present: the **relief recipient** (charge nurse, break buddy or float nurse), who sees a name-only relief request, and the **trustee admin**, who publishes the weekly release.

## Product Purpose

WARD (Workload And Rest Dashboard) turns every opted-in nurse shift into an automatic, dated, unit-specific record of physical load and recovery opportunity, and measures how many overloaded shifts never become a workload report. The records feed processes that already exist in BC: break relief during the shift, the BCNU Professional Responsibility Process and joint OHS committee after it, and the Joint Regional Implementation Committees that oversee nurse-to-patient ratios.

Success: a nurse gets relief or a usable record without extra effort, and a unit's workload pattern is visible without exposing any individual.

## Positioning

- A trustee (union or university lab) holds the data, not the health authority. The hospital side can read only a weekly published release.
- Measures the shift itself: longest stretch without a break and heart-rate-reserve physical load over 12 hours.
- An in-shift action (request relief), not only after-the-fact reporting.
- Every output maps to an existing BC process.

## Operating Context

- Data comes from a wearable (watch for the prototype, upper-arm band for deployment) through the phone. Live data was dropped as not feasible (user, 2026-10-04): the Android app reads a finished shift from Health Connect and uploads it in one go, and the nurse reviews it on the site afterwards. The site can also replay a simulated recorded day.
- Because nothing arrives during the shift, there is no automatic five-hour break alert. Requesting relief is a manual button.
- Nurses confirm breaks once, at end of shift. Shift times default from their rotation.
- Managers get fixed calendar weeks only. A trustee runs the weekly release.
- The demo runs on a synthetic cohort of four units over twelve weeks.

## Capabilities and Constraints

Built: nurse live shift view with an animated load chart, break ring, relief request and recipient view, end-of-shift questions, shift summary with green / amber / red / not-enough-data band, workload report draft, shift history, settings and withdrawal, sleep before the shift when the watch provides it, manager weekly view with heatmap, flags, comparisons and action log, committee reporting gap and access log, trustee release.

Hard constraints from the spec (`CONTEXT_storm`, v4):
- Missing data is never green. A gap never counts as a break.
- Managers never see individuals, single shifts or daily data. Cells with fewer than five nurses are suppressed; proportions are rounded to 10%; counts are noised.
- Every panel carries a LIVE, REPLAY or SYNTHETIC badge.
- Every page carries the footer "Workload documentation tool — not a medical device."
- No diagnosis and no causal claims. High heart rate while stationary is shown as the stress indicator (team decision, 2026-10-04); it never sets the band.
- The language model never receives or writes a number. No model on the nurse path.
- No report is sent in a nurse's name; the nurse chooses.

Terminology: band (green / amber / red / not enough data), physical load, recovery opportunity, relief request, weekly release, reporting gap, red shift.

Not built or undecided:
- Phone and watch notifications: dropped along with live data.
- Real sign-in (a demo role picker stands in).
- The trained expected-heart-rate model (a hand-set formula stands in).
- Deployment.

## Brand Commitments

- Product name: **WARD** (Workload And Rest Dashboard). Screens say WARD; internal code names (package, storage keys) still say "shiftload".
- Teal and navy are kept from the team's Figma export, along with the sidebar and page structure (user, 2026-10-04). The user rejected the "shift roster" look as old and bland (2026-10-04) and approved a modern, interactive style: soft rounded cards, a slim icon rail, animated charts and the break ring. DESIGN.md records it.
- Wording stays brief and plain. The user asked for short, simple statements such as "Stress was high at 10:50" in place of explanatory small print.

## Evidence on Hand

- Pitch facts with sources are in `CONTEXT_storm` section 1 (CFNU 2025 survey, BC 58-hospital study, Southlake IAC report, BC agency spending).
- Anomaly-detection evaluation on synthetic data: `data/eval/anomaly_eval.json` and the README table.
- No real nurse data, no real watch recording, no model accuracy numbers, no testimonials and no pilot results exist. Future work must not present any.

## Product Principles

1. Document workload; never diagnose a person.
2. Protect the individual first: unit-level, weekly, suppressed when small.
3. Ask almost nothing of a nurse during a shift.
4. Say plainly what is missing, simulated or synthetic.
5. Feed processes that already exist rather than inventing new ones.

## Accessibility & Inclusion

No formal standard has been set. Known needs: status is never shown by colour alone (band colours carry a text label), text must be readable at a glance, and nurse-facing controls need large touch targets.
