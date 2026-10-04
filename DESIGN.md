---
name: WARD
description: A modern, interactive workload and rest dashboard where the shift is a living chart.
colors:
  teal: "#0b7f73"
  teal-bright: "#0e9485"
  teal-deep: "#085a51"
  teal-tint: "#e3f4f1"
  on-teal: "#ffffff"
  on-teal-soft: "#e2f4f1"
  navy: "#12283b"
  navy-2: "#1d3b54"
  navy-muted: "#9fb4c7"
  rail-active-bg: "rgba(79, 214, 196, 0.18)"
  rail-active-ink: "#5fe0cf"
  rail-hover-bg: "rgba(255, 255, 255, 0.09)"
  paper: "#f3f6fb"
  sheet: "#ffffff"
  tint: "#f1f5fa"
  rule: "#e4eaf1"
  ink: "#0f2233"
  ink-2: "#4a5f73"
  muted: "#5d7186"
  nodata: "#b6c3cf"
  stress: "#f2a93b"
  sleep: "#8b6fe8"
  good: "#1f9254"
  warning: "#d18a12"
  critical: "#d2453c"
  pen: "#c9433b"
  pen-tint: "#fdecea"
  hl-load: "rgba(14, 148, 133, 0.16)"
  hl-stress: "rgba(242, 169, 59, 0.26)"
  hl-alert: "rgba(229, 88, 79, 0.16)"
  load-1: "#e4f5f2"
  load-2: "#b9e5de"
  load-3: "#7cccc0"
  load-4: "#17877b"
  load-5: "#075a51"
  on-load-light: "#0f2233"
  on-load-dark: "#ffffff"
  live-bg: "#e0f3e7"
  live-ink: "#1c6b3d"
  replay-bg: "#e8edf3"
  replay-ink: "#41566a"
  synthetic-bg: "#ece6fb"
  synthetic-ink: "#4b2fb0"
  dark-teal: "#4fd6c4"
  dark-teal-bright: "#4fd6c4"
  dark-teal-tint: "#123330"
  dark-on-teal: "#04211d"
  dark-navy: "#0d1823"
  dark-navy-2: "#1a2c3e"
  dark-navy-muted: "#8fa6ba"
  dark-paper: "#0a121b"
  dark-sheet: "#111d2a"
  dark-tint: "#172636"
  dark-rule: "#1e2f40"
  dark-ink: "#eef4f9"
  dark-ink-2: "#b3c4d3"
  dark-muted: "#9bb0c3"
  dark-nodata: "#44566a"
  dark-stress: "#f0b95a"
  dark-sleep: "#b3a0ef"
  dark-good: "#6ccf8d"
  dark-warning: "#f0b95a"
  dark-critical: "#f28b84"
  dark-pen: "#f28b84"
  dark-pen-tint: "#33191a"
  dark-hl-load: "rgba(79, 214, 196, 0.18)"
  dark-hl-stress: "rgba(242, 186, 90, 0.22)"
  dark-hl-alert: "rgba(242, 139, 132, 0.2)"
  dark-load-1: "#14302d"
  dark-load-2: "#1b4a44"
  dark-load-3: "#227064"
  dark-load-4: "#3fb09e"
  dark-load-5: "#7de3d0"
  dark-on-load-light: "#eef4f9"
  dark-on-load-dark: "#04211d"
  dark-live-bg: "#14301f"
  dark-live-ink: "#8ed9a6"
  dark-replay-bg: "#1c2a39"
  dark-replay-ink: "#b3c4d3"
  dark-synthetic-bg: "#251d3a"
  dark-synthetic-ink: "#c8b6f6"
typography:
  display:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "2.875rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.04em"
    fontFeature: "'tnum'"
  hero:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "2.125rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.03em"
  figure:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.03em"
    fontFeature: "'tnum'"
  title:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  card-title:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  statement:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.5
  body:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  control:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 700
  body-small:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 800
    letterSpacing: "0.05em"
rounded:
  mark: "8px"
  cell: "12px"
  segment: "13px"
  control: "14px"
  tile: "15px"
  chip: "17px"
  track: "18px"
  card: "22px"
  pill: "99px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  gap: "20px"
  card: "22px"
  page-top: "30px"
  page-x: "34px"
  rail: "84px"
  side-column: "340px"
  page-max: "1240px"
components:
  button:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "0 18px"
    height: "46px"
  button-primary:
    backgroundColor: "{colors.teal}"
    textColor: "{colors.on-teal}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "0 18px"
    height: "46px"
  button-primary-big:
    backgroundColor: "{colors.teal}"
    textColor: "{colors.on-teal}"
    rounded: "{rounded.control}"
    height: "54px"
    width: "100%"
  button-danger:
    backgroundColor: "{colors.pen-tint}"
    textColor: "{colors.pen}"
    rounded: "{rounded.control}"
    padding: "0 18px"
    height: "46px"
  button-pressed:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.control}"
  panel:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "22px"
  stat-card:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.figure}"
    rounded: "{rounded.card}"
    padding: "20px"
  relief-card:
    backgroundColor: "{colors.teal}"
    textColor: "{colors.on-teal}"
    rounded: "{rounded.card}"
    padding: "22px"
  relief-card-button:
    backgroundColor: "{colors.on-teal}"
    textColor: "{colors.teal-deep}"
    rounded: "{rounded.control}"
    height: "54px"
    width: "100%"
  highlight-chip:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.statement}"
    rounded: "{rounded.chip}"
    padding: "0 18px"
    height: "50px"
  badge-replay:
    backgroundColor: "{colors.replay-bg}"
    textColor: "{colors.replay-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "5px 11px"
  badge-live:
    backgroundColor: "{colors.live-bg}"
    textColor: "{colors.live-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "5px 11px"
  badge-synthetic:
    backgroundColor: "{colors.synthetic-bg}"
    textColor: "{colors.synthetic-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "5px 11px"
  band-chip:
    backgroundColor: "{colors.tint}"
    textColor: "{colors.ink}"
    typography: "{typography.body-small}"
    rounded: "{rounded.pill}"
    padding: "4px 11px 4px 9px"
  nav-item:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.navy-muted}"
    rounded: "{rounded.tile}"
    size: "50px"
  nav-item-hover:
    backgroundColor: "{colors.rail-hover-bg}"
    textColor: "{colors.on-teal}"
  nav-item-active:
    backgroundColor: "{colors.rail-active-bg}"
    textColor: "{colors.rail-active-ink}"
  input:
    backgroundColor: "{colors.tint}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 14px"
    height: "48px"
  segmented:
    backgroundColor: "{colors.sheet}"
    rounded: "{rounded.track}"
    padding: "5px"
  segment:
    textColor: "{colors.ink-2}"
    rounded: "{rounded.segment}"
    padding: "0 15px"
    height: "40px"
  segment-on:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.on-teal}"
    rounded: "{rounded.segment}"
  toggle:
    backgroundColor: "{colors.nodata}"
    rounded: "{rounded.pill}"
    width: "52px"
    height: "30px"
  toggle-on:
    backgroundColor: "{colors.teal-bright}"
  week-cell:
    backgroundColor: "{colors.load-3}"
    textColor: "{colors.on-load-light}"
    typography: "{typography.body-small}"
    rounded: "{rounded.cell}"
    width: "64px"
    height: "46px"
  tooltip:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.on-teal}"
    typography: "{typography.body-small}"
    rounded: "{rounded.segment}"
    padding: "10px 13px"
---

# Design System: WARD

## Overview

**Creative North Star: "The Living Shift Chart"**

The shift is a chart you can explore, not a static report. WARD opens on one large card where the load line draws itself across twelve hours, a pulsing dot marks now, and plain statements beneath it light up the stretch they talk about. Everything else is a soft white card on a pale blue-grey ground: generous 22px corners, a neutral shadow that deepens when something can be pressed, and a slim navy icon rail holding the frame.

The system is built for a glance and for touch. Each surface leads with a figure or a short sentence ("Stress was high at 10:50", "On track", "Need a break?") set heavy in Manrope; supporting text is one line in second ink, and longer explanation sits behind a collapsed card. Controls are large (46px and up) and respond: buttons rise, cards lift, meters and bars grow from the left, the break ring refills every time it comes back into view. Light and dark both ship from the same tokens, switched by a `dark` class on the root element; dark is deep navy with brighter teal, not an inverted light theme.

The user pinned teal and navy, and rejected looks that are old, bland, cold-clinical or corporate. The earlier ruled-sheet "shift roster" direction was built and rejected on those grounds. Warmth here comes from softness, colour with a job, and motion that answers the hand.

**Key Characteristics:**
- Pale blue-grey ground, white cards with 22px corners and soft neutral shadows; no card borders.
- A slim 84px navy icon rail; the active item glows teal.
- One family, Manrope, with rank carried by weight (800 for figures and headings).
- Colour has fixed jobs: teal load and actions, amber stress, violet sleep and breaks, red alerts.
- Missing or held-back data is a hollow dashed shape, never a colour.
- Motion is part of the reading: chart draw-in, ring refill on re-entry, lift on hover, bars that grow.
- Every data panel or page carries a LIVE, REPLAY or SYNTHETIC badge.

## Colors

A cool, light palette anchored by one committed teal and a deep navy, with amber, violet and red reserved for meaning. Light values are canonical; each has a `dark-` counterpart in the frontmatter with the same role.

### Primary
- **Ward Teal** (`teal`): the action colour. Primary buttons, links, the "yes" answer, the icon in a notice, the role avatars on sign-in. In dark it brightens (`dark-teal`) and its text flips to near-black (`dark-on-teal`).
- **Bright Teal** (`teal-bright`): the data and focus colour. The load line and its fading area fill, the now-dot, load meters, the break ring while on track, toggles when on, range and checkbox accents, the focus outline and the selected-card outline.
- **Deep Teal** (`teal-deep`): the far end of the 135 to 145 degree teal gradient on the logo tile and the relief card, and the text of the white button on that card. Text on the gradient is white with `on-teal-soft` for the supporting line. The gradient is the same in both themes.
- **Teal Wash** (`teal-tint`): the ground of notices and sign-in avatars.
- **Load Ramp** (`load-1` to `load-5`): five teal steps, lighter to heavier, filling the manager week cells; steps 1 to 3 take dark text, 4 and 5 take light. In dark the ramp inverts in lightness so heavier is brighter.

### Secondary
- **Rail Navy** (`navy`): the icon rail, the selected segment of a segmented control, and tooltips. `navy-muted` is the resting icon colour; hover is a faint white wash (`rail-hover-bg`); the active item takes `rail-active-bg` with `rail-active-ink`.
- **Navy Step** (`navy-2`): bar B in paired comparison bars.

### Tertiary
- **Stress Amber** (`stress`): stress points on the chart, the stress stat dot and meter.
- **Sleep Violet** (`sleep`): sleep stats and break bands on the chart (drawn at 16% opacity).
- **Band colours** (`good`, `warning`, `critical`): the green, amber and red dots of a shift band, always beside a text label. `warning` and `critical` also colour the break ring as it nears and passes five hours, and `critical` sets error text and the unusual-week dot.
- **Alert Red** (`pen`, `pen-tint`): the danger button, the bad banner and the workload report card.
- **Highlights** (`hl-load`, `hl-stress`, `hl-alert`): translucent washes that light a stretch of the chart when a highlight chip is chosen, and sit behind a marked phrase. Also the text selection colour (`hl-load`).
- **Provenance** (`live-*`, `replay-*`, `synthetic-*`): green-tinted LIVE, grey REPLAY, violet-tinted SYNTHETIC badges.

### Neutral
- **Ground** (`paper`): the page.
- **Card** (`sheet`): cards, default buttons, segmented tracks, the ring around a chart point.
- **Tint** (`tint`): input grounds, chips, quiet buttons inside a card, bar tracks, row hover.
- **Rule** (`rule`): chart gridlines, row dividers inside a card, meter and ring tracks, input borders. Never a card outline.
- **Ink** (`ink`), **Second Ink** (`ink-2`), **Muted** (`muted`): text, supporting lines and legends, and footer, axis and placeholder text in that order. Ink is also the pressed-option fill.
- **No Data** (`nodata`): the dashed stroke of a gap or held-back cell, the off state of a toggle, the hover guide on the chart.

### Named Rules
**The One Job Rule.** Teal is load and action, amber is stress, violet is sleep and breaks, red is an alert. A colour never takes a second meaning and never appears as decoration.

**The Hollow Dash Rule.** Missing, watch-off or held-back data is an empty shape with a 2px dashed outline in `nodata` (or `muted` for the band dot). It never takes a fill from the load ramp or the band set, and never reads as green.

**The Label Beside The Colour Rule.** A band, a legend swatch and a chart series always sit next to their name in text. Colour alone never carries a state.

## Typography

**Display Font:** Manrope (variable, loaded with next/font; fallback system-ui, sans-serif)
**Body Font:** Manrope

**Character:** One rounded geometric sans does everything. Rank comes from weight and tight tracking: 800 with negative tracking for figures and headings, 700 for labels and controls, 400 to 600 for sentences. Digits that change or line up use tabular figures.

### Hierarchy
- **Display** (800, 2.875rem, line-height 1, -0.04em, tabular): the one live figure on the chart card. Its unit follows at 1.0625rem / 600 in second ink.
- **Hero** (800, 2.125rem, 1.2, -0.03em): the single statement on the committee reporting-gap card; the same size and weight sets the time inside the break ring.
- **Headline** (800, 1.875rem, 1.15, -0.03em): the page heading, one per page, with a one-line sub in second ink beneath it.
- **Figure** (800, 1.875rem, 1.15, -0.03em, tabular): values on stat cards, with units at 0.9375rem / 600.
- **Title** (800, 1.25rem, 1.25, -0.02em): headings inside a card and section titles between cards. The shift verdict raises it to 1.75rem, the relief card to 1.375rem.
- **Card title** (800, 1.0625rem): the heading in a card's head row, beside its badge.
- **Statement** (700, 1rem): highlight chips; names in lists.
- **Body** (400, 1rem, 1.5): sentences, capped at 70ch.
- **Control** (700, 0.9375rem): buttons and field labels; unselected segments drop to 600.
- **Body small** (0.875rem, 400 to 700): legends, deltas, stat names (700), chips (700), the footer.
- **Label** (800, 0.75rem, 0.05em, uppercase): provenance badges only.

### Named Rules
**The One Family Rule.** Manrope everywhere. Do not add a second display or body face; change the weight.

**The Statement First Rule.** A card says its finding as a figure or one short plain sentence. Explanation is one supporting line at most, or goes behind a collapsed "more" card; it never becomes small print under the figure.

**The Badge Is The Only Caps Rule.** Uppercase, letterspaced text exists only in the LIVE / REPLAY / SYNTHETIC badge. Headings, stat names and card titles are sentence case.

## Layout

A fixed navy icon rail (84px) sits on the left; the workspace beside it holds one column capped at 1240px with 34px side padding and 30px above. A page opens with its heading on the left (title, one sub line) and its actions and badge on the right, 22px above the first card. The sign-in page drops the rail and centres a 920px column.

Cards stack 20px apart with 22px inside. The nurse shift page splits into a fluid main column and a 340px side column for the break ring and relief card. Stat cards sit four across with 16px gaps; two-up grids are equal halves with a 20px gap. Reading and form pages (onboarding, end of shift, history, relief, trustee) cap at 620 to 720px. Wide tables and the week grid scroll sideways inside their card.

Responsive behaviour, as built:
- Below 1100px the side column moves above the main column.
- Below 860px two-up grids become one column and the four stat cards become two across.
- Below 760px the rail becomes a sticky top bar: logo, icons in a row at 44px, theme and role switches pushed to the right; page padding drops to 20px 16px.

## Elevation & Depth

Lifted. Cards have no border; they separate from the ground by a soft two-layer neutral shadow, and anything pressable answers the pointer by rising onto a deeper one. In dark, the shadow is a single wide dark blur and separation relies mostly on the card being lighter than the ground.

### Shadow Vocabulary
- **Rest** (`box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05), 0 12px 32px -12px rgba(0, 0, 0, 0.16)`; dark `0 16px 40px -18px rgba(0, 0, 0, 0.7)`): cards, stat cards, lists, collapsed sections, banners, default buttons, and segmented or stepper tracks that sit on the ground.
- **Lift** (`box-shadow: 0 2px 4px rgba(0, 0, 0, 0.06), 0 20px 40px -14px rgba(0, 0, 0, 0.22)`; dark `0 22px 48px -18px rgba(0, 0, 0, 0.85)`): hover on buttons (with a 2px rise), stat cards (3px), sign-in role cards (4px) and week cells (scale 1.08).
- **Tooltip** (`box-shadow: 0 12px 26px -10px rgba(0, 0, 0, 0.55)`): the navy readout over the chart and week cells.

### Named Rules
**The Lift On Touch Rule.** Things on the ground rest on the Rest shadow and rise to Lift on hover; pressing scales a button to 0.97. Things nested inside a card (segments, list rows, option and scale buttons, tinted notices) are flat and change ground or fill instead.

## Shapes

Soft and round. Cards take 22px corners; buttons, inputs, banners and notices take 14px; highlight chips 17px; segmented and stepper tracks 18px with 13px segments; the logo, rail items and avatars are 15px rounded tiles; week cells 12px; a marked phrase 8px. Badges, band chips, meters, bars and the toggle are full pills, and every dot is a circle. The break ring is a 196px circle with a 15px round-capped stroke.

There are almost no lines. Borders appear only as 1px `rule` dividers between rows inside a card, the 1.5px input edge, and the 2px dashed outline of missing data. Selection is drawn as a 2.5px outline hugging the shape (teal for a chosen stat card or chip, ink for a chosen week cell), not as a border.

## Components

### Buttons
- **Shape:** softly rounded (14px), 46px tall minimum, 18px side padding, 700 at 0.9375rem, optional 16 to 18px line icon.
- **Default:** card-white on the Rest shadow, no border. Hover rises 2px onto Lift; active scales to 0.97 (0.18s on the shared ease).
- **Primary:** Ward Teal with on-teal text. The big variant is 54px tall, full width, 1.0625rem (Request relief, Confirm breaks, Finish shift).
- **Danger:** pen text on pen tint, no shadow.
- **Pressed:** ink ground with card-white text, for a chosen option. Option and scale buttons rest on tint without a shadow.
- **Link:** underlined teal text with a 3px offset, no ground.
- **Focus:** 3px Bright Teal outline, 2px offset, on every interactive element. **Disabled:** 50% opacity.

### Chips and badges
- **Provenance badge:** pill, 800 at 0.75rem, 0.05em, uppercase. LIVE, REPLAY or SYNTHETIC with an optional note after a middle dot. Sits at the right of a card head or in the page heading.
- **Band chip:** tint pill with a 10px dot and a bold label. Green, amber and red dots are solid; "Not enough data" is a hollow dashed dot.
- **Highlight chip:** a 50px card-white button (17px corners) with a 10px coloured dot and one plain sentence. Choosing it draws a 2.5px Bright Teal outline and washes the matching stretch of the chart in that subject's highlight colour; choosing it again clears it.
- **Mark:** a phrase on a highlight wash with 8px corners, for the one phrase that needs attention ("Relief requested", an unusual week).

### Cards / Containers
- **Card (panel):** card-white, 22px corners, Rest shadow, 22px padding, no border. An optional head row holds the card title, then actions, then the provenance badge.
- **Stat card:** a card with a dot and name (0.875rem / 700, second ink), a Figure value, and a 7px pill meter in the subject's colour that grows from the left (0.5s). Hover lifts 3px. On the manager view the same card is a button holding day and night values with a delta line, outlined in teal when chosen.
- **More:** a card collapsed by default; a bold summary with a chevron that turns when open (0.22s).
- **List:** one card of full-width rows divided by rules; rows that act hover to tint.
- **Banner and notice:** a 14px card-white banner on Rest; the bad banner and report card sit on pen tint with no shadow; a notice sits on teal wash with a teal icon.
- **Empty state:** a centred card with a title, one line, and the next action.

### Inputs / Fields
- **Style:** tint ground, 1.5px rule edge, 14px corners, 48px tall. The label is bold text above the control. Focus turns the edge Bright Teal and adds the focus outline.
- **Toggle:** a 52 by 30px pill, `nodata` grey when off and Bright Teal when on, with a white 22px thumb that slides 22px in 0.22s.
- **Segmented control:** a card-white 18px track on Rest (tint and flat when inside a card) holding 40px segments; the chosen segment is navy with white text.
- **Yes / no:** two segments in a tint track; Yes fills teal, No fills ink. **Scale:** five across, tint buttons, ink when pressed.
- **Stepper:** two 40px arrow buttons either side of a bold date in a card-white track.
- **Steps:** a row of labels each under a 4px bar, Bright Teal for the current step.

### Navigation
- **Icon rail:** navy, 84px wide, fixed. A 46px teal-gradient logo tile at the top, then 50px rounded tiles each holding a 22px line icon with its name as the tooltip and accessible label. Resting icons are `navy-muted`; hover adds a faint white wash and a 1px rise; the active tile is a teal glow with a bright teal icon. Theme and role switches sit at the foot.
- **Mobile:** the rail turns into a sticky top bar below 760px.

### Shift chart (signature)
A 280px area chart on a card with no inner padding. Above it, a label, the Display figure for load right now, and a dot legend. The load line is Bright Teal at 3.5px with round joins over a fill that fades from 36% to nothing; gridlines are `rule` with small muted labels. On arrival the line draws itself in over 1.6s and the fill fades up after it; the latest point pulses. Stress points are amber dots ringed in card-white; breaks are violet bands with 10px corners; a watch-off stretch is a hollow dashed box that breaks the line. Hovering shows a dashed guide, a ringed point and a navy tooltip with the time and effort.

### Break ring (signature)
A 196px ring on a `rule` track with the elapsed time at Hero size in the middle and one statement beneath ("On track"). The arc is Bright Teal, turns `warning` at four hours and `critical` at five. It empties when it leaves the screen and fills again over 1.1s each time at least 35% of it scrolls back into view. This refill was asked for by the user; keep it on any ring.

### Relief card (signature)
The one saturated card: a 145 degree teal gradient with a faint translucent circle in the top corner, a white title ("Need a break?"), one line, and a white full-width button with deep teal text. It is the prominent action on the nurse view and appears once per page.

### Week grid
Cells of 64 by 46px with 12px corners and 5px gaps, each holding a rounded range in tabular digits on a load-ramp fill. Hover scales the cell onto Lift; the selected cell takes a 2.5px ink outline; an unusual week carries a small red dot at its top-right corner; a held-back week is a hollow dashed cell. The legend beneath names every fill and mark.

### Paired bars
Comparison rows divided by rules: bar A in Bright Teal and bar B in Navy Step on 12px tint tracks, growing from the left (0.6s), with tabular values on the right. In dark, bar B is drawn in the violet token because navy disappears against the dark tint; treat that as a local compromise, not a second job for violet.

### Motion
One ease, `cubic-bezier(0.16, 1, 0.3, 1)`, for everything that moves; colour and shadow changes take 0.2 to 0.3s. New items pop in (8px rise, 0.35s). All animation and transition is removed under `prefers-reduced-motion`, with the chart shown complete.

## Do's and Don'ts

### Do:
- **Do** lead every card with a figure or a short plain sentence, heavy in Manrope, with at most one supporting line.
- **Do** keep each colour to its job: teal load and action, amber stress, violet sleep and breaks, red alerts.
- **Do** draw missing, watch-off or held-back data as a hollow dashed shape, and name every state in text.
- **Do** build surfaces from borderless card-white cards (22px corners, Rest shadow) on the pale ground, and let pressable things rise on hover.
- **Do** give data a way to arrive and respond: draw the line in, grow bars and meters from the left, refill the ring on re-entry, and remove all of it under reduced motion.
- **Do** give every data panel or page a LIVE, REPLAY or SYNTHETIC badge and keep the footer disclaimer on every page.
- **Do** ship every surface in light and dark by using the tokens.
- **Do** keep controls at 46px or taller, with the 3px teal focus outline.

### Don't:
- **Don't** make it look old, bland, cold-clinical or corporate (all rejected by the user). The ruled-sheet roster look, with square corners, hairline borders and flat sheets, is the rejected direction.
- **Don't** replace a plain statement with small explanatory text; say it briefly or put it behind "more".
- **Don't** change the teal and navy pairing; it is pinned by the user.
- **Don't** outline cards or stack shadows on things nested inside a card.
- **Don't** add a second typeface, or uppercase letterspaced labels anywhere but the provenance badge.
- **Don't** show a gap as a break, or missing data in green or any other fill.
- **Don't** use a second saturated gradient card on a page; the relief card is the single loud surface.
- **Don't** show a state by colour alone.
