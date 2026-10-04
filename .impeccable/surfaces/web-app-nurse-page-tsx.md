---
version: 1
slug: "web-app-nurse-page-tsx"
primary_target: "web/app/nurse/page.tsx"
related_targets: ["web/app/manager/page.tsx","web/app/committee/page.tsx","web/app/relief/page.tsx","web/app/trustee/page.tsx","web/app/page.tsx"]
---

# Surface brief: WARD application shell and role views

Scope: every signed-in view (nurse shift, history, settings; relief; manager weekly; committee; trustee) and the sign-in page. Visitor mode: Operate.

Audience and job: nurses glancing mid-shift, managers and committee reading weekly unit numbers, judges following a short demo. Each screen must be understood in seconds; identity is wanted but clarity wins ties (user, 2026-10-04).

Constraints kept: teal and navy stay; sidebar and page structure stay unless something badly needs changing; no cold-clinical feel, no corporate-bland feel; brief plain statements instead of small print; every panel keeps its LIVE / REPLAY / SYNTHETIC badge and every page the not-a-medical-device footer.

Memorable moment: the shift drawn as a ruled roster row, with a highlighter mark landing on the stretch a sentence talks about.

Unresolved: phone and watch notification surfaces are not designed.

## Direction contract

THESIS: A shift is a row on the ward roster. WARD is that paper roster made exact: hours as ruled columns, load as filled cells, a highlighter over what matters. It refuses the health-dashboard arrangement of floating metric cards, rings and line charts.

OWN-WORLD: Cool roster paper ground, white sheets with one-pixel navy rules and near-square corners, a committed navy shell. Three highlighters with jobs: teal for load, amber for stress, violet for sleep. Red is the pen: circles and strikes for alerts only. Archivo set narrow in caps for column heads and wide for figures; Atkinson Hyperlegible for sentences. Missing data is a struck empty cell, never a colour.

STORY: The visitor sees where the shift was heavy and whether a break happened, believes it because the marked cells sit under the sentence, and acts: ask for relief, confirm breaks, or pick a unit-week.

FIRST VIEWPORT: Navy sidebar left. Heading "My shift" with date, elapsed time and data badge on one ruled line. Below, the roster row across the full sheet: hour columns 07 to 19, a load row of 144 five-minute cells, a stress row, a break row. Under it, two or three highlight sentences, each with its phrase marked. Right column: break tally of five hour-boxes and the Request relief button.

FORM: Shift roster, position 1 on the grounded list, chosen by the user over the assigned direction. Seed key e6480850. Raises: every claim sits beside its proof (monochrome marketing); changes stay lit until handled (gate board); state carried in form as well as hue (emission rail); rank by weight, case and rule on a short scale (timetable); one shared cell module (Crouwel).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
