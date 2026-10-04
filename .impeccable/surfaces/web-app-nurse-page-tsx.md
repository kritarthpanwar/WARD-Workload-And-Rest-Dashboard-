# Surface brief: WARD application shell and role views

Scope: every signed-in view (nurse shift, history, settings; relief; manager weekly; committee; trustee) and the sign-in page. Visitor mode: Operate.

Audience and job: nurses glancing mid-shift, managers and committee reading weekly unit numbers, judges following a short demo. Each screen must be understood in seconds.

Constraints kept: teal and navy; brief plain statements instead of small print; every data panel or page carries its LIVE / REPLAY / SYNTHETIC badge; the not-a-medical-device footer on every page.

History: the "shift roster" direction (seed key e6480850) was built and then rejected by the user as old and bland. The user approved a style sample instead and asked for it across the whole site, without a play bar, and with the break ring refilling each time it scrolls back into view. That pinned direction replaces the roll.

## Direction contract

THESIS: A modern, interactive health-style dashboard: the shift is a living chart you can explore, not a static report.

OWN-WORLD: Pale blue-grey ground, white cards with 22px corners and soft neutral shadows, a slim navy icon rail, Manrope throughout. Teal for load and primary actions, amber for stress, violet for sleep and breaks, red for alerts. Missing data is a hollow dashed shape, never a colour.

STORY: The visitor sees how hard the shift is right now, taps a highlight to see where it happened on the chart, and asks for relief from a prominent card.

FIRST VIEWPORT: Icon rail left. Heading with shift details, data badge and End shift. A large chart card with the current load figure and an area chart that draws itself in. Highlight chips below it. Four stat cards with meters. Right column: the break ring and a teal gradient relief card.

FORM: User-pinned from an approved sample (web/public/sample.html, since removed). Signature interactions: chart draw-in and hover tooltip, highlight chips that light a stretch of the chart, the ring refilling on re-entry, cards lifting on hover.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
