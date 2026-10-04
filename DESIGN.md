---
name: WARD
description: The ward's paper shift roster made exact, for workload and rest records.
colors:
  teal: "#0f766d"
  teal-tint: "#e2f1ee"
  on-teal: "#ffffff"
  navy: "#173248"
  navy-2: "#24465f"
  navy-rule: "#36566d"
  navy-ink: "#e9f0f5"
  navy-muted: "#a9bccb"
  paper: "#e9eef2"
  sheet: "#fcfdfd"
  tint: "#f2f6f8"
  rule: "#c3cfd8"
  rule-soft: "#dfe7ec"
  ink: "#14283a"
  ink-2: "#3c5163"
  muted: "#586d7e"
  pen: "#b23c3a"
  pen-tint: "#fbeceb"
  hl-load: "rgba(22, 160, 145, 0.38)"
  hl-stress: "rgba(240, 176, 32, 0.46)"
  hl-sleep: "rgba(140, 108, 214, 0.3)"
  hl-alert: "rgba(214, 72, 68, 0.24)"
  good: "#2c8550"
  warning: "#b07a12"
  critical: "#b23c3a"
  nodata: "#a9b7c2"
  stress: "#c98a12"
  sleep: "#6f55b5"
  load-1: "#d6ebe7"
  load-2: "#a6d6cd"
  load-3: "#63b7a9"
  load-4: "#1b7d72"
  load-5: "#0a5a52"
  on-load-light: "#14283a"
  on-load-dark: "#ffffff"
  live-bg: "#dff0e4"
  live-ink: "#25693d"
  replay-bg: "#e3e9ee"
  replay-ink: "#3c5163"
  synthetic-bg: "#e9e3f7"
  synthetic-ink: "#5a3f97"
  dark-teal: "#56cbb9"
  dark-teal-tint: "#13302d"
  dark-on-teal: "#04211d"
  dark-navy: "#0a141d"
  dark-navy-2: "#172838"
  dark-navy-rule: "#25384a"
  dark-navy-ink: "#edf2f6"
  dark-navy-muted: "#94a6b4"
  dark-paper: "#0b1015"
  dark-sheet: "#121920"
  dark-tint: "#18212a"
  dark-rule: "#2c3945"
  dark-rule-soft: "#1f2a34"
  dark-ink: "#edf2f6"
  dark-ink-2: "#c2cfd9"
  dark-muted: "#94a6b4"
  dark-pen: "#f0908c"
  dark-pen-tint: "#32191a"
  dark-hl-load: "rgba(86, 203, 185, 0.3)"
  dark-hl-stress: "rgba(240, 186, 70, 0.34)"
  dark-hl-sleep: "rgba(170, 146, 240, 0.32)"
  dark-hl-alert: "rgba(240, 120, 116, 0.28)"
  dark-good: "#6ccf8d"
  dark-warning: "#e3b55a"
  dark-critical: "#f0908c"
  dark-nodata: "#4a5966"
  dark-stress: "#e3b55a"
  dark-sleep: "#b3a0ef"
  dark-load-1: "#15302d"
  dark-load-2: "#1c4b45"
  dark-load-3: "#257266"
  dark-load-4: "#3ba392"
  dark-load-5: "#74dcc9"
  dark-on-load-light: "#edf2f6"
  dark-on-load-dark: "#04211d"
  dark-live-bg: "#15301f"
  dark-live-ink: "#8ed9a6"
  dark-replay-bg: "#1d2832"
  dark-replay-ink: "#c2cfd9"
  dark-synthetic-bg: "#241d38"
  dark-synthetic-ink: "#c5b3f3"
typography:
  display:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "2.125rem"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.02em"
    fontVariation: "'wdth' 108"
    fontFeature: "'tnum'"
  headline:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.02em"
    fontVariation: "'wdth' 96"
  title:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1.3125rem"
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: "-0.012em"
  statement:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 650
    lineHeight: 1.3
    letterSpacing: "-0.012em"
  figure:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1.1875rem"
    fontWeight: 650
    fontVariation: "'wdth' 108"
    fontFeature: "'tnum'"
  body:
    fontFamily: "Atkinson Hyperlegible Next, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  body-small:
    fontFamily: "Atkinson Hyperlegible Next, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 650
    letterSpacing: "0.07em"
    fontVariation: "'wdth' 78"
  wordmark:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 800
    letterSpacing: "0.02em"
    fontVariation: "'wdth' 118"
rounded:
  mark: "2px"
  sheet: "3px"
  toggle: "30px"
spacing:
  xs: "6px"
  sm: "10px"
  md: "12px"
  gutter: "16px"
  sheet: "20px"
  page: "36px"
  sidebar: "248px"
components:
  button:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sheet}"
    padding: "0 16px"
    height: "44px"
  button-hover:
    backgroundColor: "{colors.tint}"
  button-active:
    backgroundColor: "{colors.rule-soft}"
  button-primary:
    backgroundColor: "{colors.teal}"
    textColor: "{colors.on-teal}"
    rounded: "{rounded.sheet}"
    padding: "0 16px"
    height: "44px"
  button-primary-big:
    backgroundColor: "{colors.teal}"
    textColor: "{colors.on-teal}"
    rounded: "{rounded.sheet}"
    height: "52px"
    width: "100%"
  button-danger:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.pen}"
    rounded: "{rounded.sheet}"
  button-danger-hover:
    backgroundColor: "{colors.pen-tint}"
  button-pressed:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.sheet}"
  panel:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sheet}"
    padding: "20px"
  panel-head:
    backgroundColor: "{colors.tint}"
    textColor: "{colors.ink-2}"
    typography: "{typography.label}"
    padding: "11px 20px"
  badge-replay:
    backgroundColor: "{colors.replay-bg}"
    textColor: "{colors.replay-ink}"
    rounded: "{rounded.mark}"
    padding: "3px 8px"
  badge-live:
    backgroundColor: "{colors.live-bg}"
    textColor: "{colors.live-ink}"
    rounded: "{rounded.mark}"
    padding: "3px 8px"
  badge-synthetic:
    backgroundColor: "{colors.synthetic-bg}"
    textColor: "{colors.synthetic-ink}"
    rounded: "{rounded.mark}"
    padding: "3px 8px"
  nav-item:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.navy-muted}"
    typography: "{typography.body}"
    padding: "0 22px"
    height: "46px"
  nav-item-hover:
    backgroundColor: "{colors.navy-2}"
    textColor: "{colors.navy-ink}"
  nav-item-active:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
  input:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sheet}"
    padding: "10px 12px"
    height: "46px"
  tab:
    textColor: "{colors.ink-2}"
    rounded: "{rounded.sheet}"
    padding: "0 14px"
    height: "40px"
  tab-on:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.sheet}"
  week-cell:
    typography: "{typography.body-small}"
    width: "62px"
    height: "44px"
  tooltip:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.sheet}"
    padding: "9px 11px"
---

# Design System: WARD

## Overview

**Creative North Star: "The Shift Roster"**

A shift is a row on the ward roster. WARD is that paper roster made exact: hours are ruled columns, load is filled cells, and a highlighter lands on the stretch a sentence is talking about. The ground is cool roster paper, the working surfaces are white ruled sheets with near-square corners, and a committed navy shell holds the navigation. Nothing floats; everything sits on a rule.

The system is built for a glance. Each screen leads with a plain statement in a heading face ("Stress was high at 10:50"), and the proof sits directly beside or beneath it as marked cells. Density is moderate: one main sheet, a narrow side column, large touch targets (44px and up) for nurses. Light and dark themes both ship; dark is the same roster on a night desk, set by a `dark` class on the root element.

The user pinned teal and navy and the sidebar and page structure, and rejected two feelings outright: cold and clinical, and corporate and bland. Warmth comes from the handmade devices (highlighter marks with uneven corners, a red pen ring drawn slightly off-true), not from decoration.

**Key Characteristics:**
- Cool paper ground, white sheets, one-pixel rules, 3px corners.
- Navy shell with an active item that turns into the paper it opens.
- Three highlighters with fixed jobs (teal load, amber stress, violet sleep) and a red pen for alerts.
- One shared cell module: five-minute cells in the shift row, week cells in the manager grid, hour boxes in the break tally.
- Missing data is a struck empty box, never a colour.
- Statements in Archivo, sentences in Atkinson Hyperlegible Next; rank by weight, width, case and rule on a short scale.

## Colors

A cool blue-grey paper palette with one committed teal, a navy shell, and translucent highlighter inks. Light values are the canonical tokens; every token has a `dark-` counterpart in the frontmatter with the same role.

### Primary
- **Roster Teal** (`teal`): the one action colour. Primary buttons, links, focus rings, the "on" state of toggles and yes answers, the range accent. In dark it lightens (`dark-teal`) and its text flips to near-black (`dark-on-teal`).
- **Teal Wash** (`teal-tint`): the picked row in a sheet table and the ground of notices.
- **Load Ramp** (`load-1` to `load-5`): five teal steps, lighter to heavier. Fills five-minute load cells and manager week cells. In dark the ramp inverts in lightness so heavier is brighter.

### Secondary
- **Shell Navy** (`navy`, `navy-2`, `navy-rule`, `navy-ink`, `navy-muted`): the sidebar and the mobile app bar only. `navy-2` is the hover step; `navy-rule` divides shell sections; the hatched comparison bar ("B") is `navy` striped with `navy-2`.

### Tertiary
- **Highlighters** (`hl-load`, `hl-stress`, `hl-sleep`, `hl-alert`): translucent inks laid over a phrase or over a stretch of the roster. Teal marks load, amber marks stress, violet marks sleep, pale red marks an alert such as a long stretch without a break.
- **Red Pen** (`pen`, `pen-tint`): the hand-drawn ring around an unusual week, the danger button outline, the bad banner and the workload report card.
- **State** (`good`, `warning`, `critical`, `nodata`): band squares (green, amber, red) and error text. Always shown with a text label.
- **Stress Amber** (`stress`) and **Sleep Violet** (`sleep`): solid companions to the amber and violet highlighters; `stress` fills the stress row cells.
- **Provenance** (`live-*`, `replay-*`, `synthetic-*`): the three data badges. Green-tinted for LIVE, paper-grey for REPLAY, violet-tinted for SYNTHETIC.

### Neutral
- **Roster Paper** (`paper`): page ground, and the active sidebar item.
- **Sheet** (`sheet`): panels, inputs, default buttons, empty tracks.
- **Sheet Tint** (`tint`): panel head band, hover ground, report block.
- **Rule** (`rule`) and **Soft Rule** (`rule-soft`): sheet borders and hour ticks; row dividers inside a sheet.
- **Ink** (`ink`): text, the heavy rule under a page heading, the leading edge of every track, break spans, pressed and selected states, tooltips.
- **Second Ink** (`ink-2`): sub lines, label caps, legends.
- **Muted** (`muted`): the footer disclaimer, placeholders, inactive steps.

### Named Rules
**The Three Highlighters Rule.** Teal is load, amber is stress, violet is sleep. A highlighter never changes jobs and never decorates.

**The Red Pen Rule.** Red appears only where something needs attention: a ring, a strike, a red band, an error. It is never a fill for ordinary data.

**The Struck Box Rule.** Missing or held-back data is an empty box with one diagonal stroke in `nodata`. It never takes a colour from the load ramp or the band set, and never reads as green.

## Typography

**Display Font:** Archivo, variable with the width axis (fallback system-ui, sans-serif)
**Body Font:** Atkinson Hyperlegible Next (fallback system-ui, sans-serif)
**Label Font:** Archivo set narrow (width 78%), uppercase

**Character:** One grotesque does three voices by changing width: narrow caps for column heads, near-normal for headings and statements, wide for figures. Atkinson Hyperlegible carries every sentence so text stays readable at a glance.

### Hierarchy
- **Display** (700, 2.125rem, 1.05, width 108%, tabular): the one large figure on a sheet, such as time since the last break. Its unit sits beside it in body face at 1rem / 500.
- **Headline** (700, 1.75rem, 1.15, width 96%, -0.02em): the page heading, one per page, sitting on a 2px ink rule. Also the verdict line on a shift summary.
- **Title** (650, 1.3125rem, 1.25, -0.012em): section headings outside a panel.
- **Statement** (650, 1.25rem, 1.3, -0.012em): highlight sentences under the roster; names in relief requests.
- **Figure** (650, 1.1875rem, width 108%, tabular): values in sheet tables. Week cells use the same voice at 0.875rem, width 100%.
- **Body** (400, 1rem, 1.5): sentences, capped at 70ch. Row heads and button text are body at 700.
- **Body small** (400, 0.875rem): legends, keys, deltas, the footer.
- **Label** (650, 0.8125rem, 0.07em, uppercase, width 78%): panel heads, table column heads, roster row labels, hour numbers, step markers. Badges use the same voice at 0.75rem / 700 / 0.09em.
- **Wordmark** (800, 1.5rem, width 118%, 0.02em): "WARD" in the shell; 2.5rem on sign-in.

### Named Rules
**The Width Is The Voice Rule.** Narrow caps name a column, wide tabular digits state a quantity, normal width makes a statement. Do not introduce a second display family; change the width.

**The Statement First Rule.** A panel says its finding as one plain sentence in the Statement or Headline role. Explanations go behind a collapsed "more" section, not into small print under the figure.

## Layout

A fixed navy sidebar (248px) on the left; the workspace beside it holds a single column capped at 1160px with 36px side gutters and 30px top padding. Every page opens with a page heading: title and sub line on the left, actions on the right, closed by a 2px ink rule with 20px beneath it.

Sheets stack with 16px between them. The nurse shift page splits into a fluid main column and a 300px side column; two-up grids are equal halves with a 16px gap. Inside a sheet the padding is 20px, with a full-bleed head band. Narrow reading pages (onboarding, history, relief, settings) cap at 620 to 720px.

Responsive behaviour, as built:
- Below 1100px the side column moves above the main column.
- Below 1000px the sidebar becomes an off-canvas drawer opened from a 56px sticky navy app bar; gutters drop to 16px.
- Below 860px two-up grids collapse to one column and table cell padding tightens.
- Below 620px the sign-in rows restack with the description under the role name.
- Wide tables and the week grid scroll sideways inside their sheet rather than shrinking.

The roster row is a two-column grid: a 62px label column and one track divided into 144 equal cells, with twelve hour columns ruled over it.

## Elevation & Depth

Flat. Depth is paper on paper: `sheet` on `paper`, a `tint` head band on a sheet, and rules. Stacking is expressed by border weight, from soft rule (row) to rule (sheet edge) to ink (the leading edge of a track, table head, page heading).

### Shadow Vocabulary
- **Tooltip lift** (`box-shadow: 0 6px 18px rgba(8, 18, 28, 0.25)`): the hover readout over a roster or week cell, which truly floats above the sheet.
- **Drawer edge** (`box-shadow: 14px 0 34px rgba(8, 18, 28, 0.3)`): the sidebar when it slides over content on small screens, with a `rgba(8, 18, 28, 0.55)` backdrop.
- **Cell hover ring** (`box-shadow: inset 0 0 0 2px` of ink at 45%): a week cell under the pointer.

### Named Rules
**The Flat Sheet Rule.** Sheets, buttons and inputs carry no shadow at rest or on hover. Only things that leave the page (tooltip, drawer) cast one.

## Shapes

Near-square. Sheets, buttons, inputs, banners and tooltips share one 3px radius; badges and band squares take 2px; cells, tracks, tally boxes, the 1-to-10 scale and list rows are fully square. The only round forms are the toggle (30px pill with a circular thumb) and the two hand-drawn devices: the highlighter mark, with deliberately uneven corners (`2px 7px 3px 6px` on a phrase, `3px 9px 4px 8px` on the roster), and the red pen ring, an irregular ellipse rotated -4deg.

Borders are one pixel. Ink-weight borders mark edges that carry meaning: the left edge of every track, the outline of the tally and scale, the default button. The struck box is a single diagonal hairline from bottom-left to top-right.

## Components

### Buttons
- **Shape:** near-square (3px), 44px tall minimum, 16px side padding, body face at 700 / 0.9375rem, optional 16 to 18px line icon after the label.
- **Default:** sheet ground, ink text, 1px ink border. Hover moves the ground to tint, active to soft rule.
- **Primary:** teal ground, on-teal text. Hover mixes 12% ink into the teal. The big variant is 52px tall and full width (Request relief, Confirm breaks).
- **Danger:** pen border and text on sheet; hover fills pen tint.
- **Pressed:** ink ground with sheet text, for a chosen option.
- **Link:** teal underlined text (1px, 3px offset), thickening to 2px on hover.
- **Focus:** 2px teal outline, 2px offset, on every interactive element.
- **Disabled:** 50% opacity.

### Chips and badges
- **Provenance badge:** narrow caps (0.75rem, 700, 0.09em) on a tinted ground, 2px radius. LIVE, REPLAY or SYNTHETIC, with an optional note after a middle dot. Sits at the right end of every panel head.
- **Band chip:** an 11px square (2px radius) plus a bold text label. Green, amber and red are solid; "Not enough data" is an outlined struck box.

### Cards / Containers
- **Sheet (panel):** sheet ground, 1px rule border, 3px radius, 20px padding, no shadow. The head is a full-bleed tint band with a bottom rule, holding the title in label caps, then any actions, then the provenance badge.
- **More:** a sheet that is collapsed by default; bold summary line with a small chevron that turns when open.
- **List:** a sheet of full-width rows divided by soft rules; rows that act hover to tint.
- **Banner / notice:** rule border on sheet; the bad banner and report card switch to pen border on pen tint; the notice sits on teal wash with a teal icon.

### Inputs / Fields
- **Style:** sheet ground, 1px rule border with an ink bottom edge (a form line), 3px radius, 46px tall. Field labels are bold body text above the control.
- **Toggle:** 52 by 30px pill, ink outline and ink thumb when off; teal ground with on-teal thumb when on; thumb slides 22px in 0.18s.
- **Yes / no and 1-to-10 scale:** joined square segments inside one ink outline. Yes fills teal, No fills ink.
- **Stepper:** two 40px square buttons either side of a bold date label.

### Navigation
- **Sidebar:** navy, 248px. Wide wordmark, a "Signed in as" block, then items 46px tall with a 19px line icon and body text at 500 in navy-muted. Hover lifts to navy-2. The active item takes the paper ground and ink text at 700, so it reads as the tab of the page it opens. Theme and role switches sit at the foot above a rule.
- **Tabs:** roster index tabs along a 1px ink rule; the selected tab is ink with sheet text, the rest are plain text that hover to tint.
- **Mobile:** 56px sticky navy bar with a menu button and the wordmark; the sidebar slides in over a dark backdrop (0.22s, `cubic-bezier(0.16, 1, 0.3, 1)`).

### Shift roster (signature)
Twelve hour columns headed in narrow tabular caps. Three tracks share them: a 46px load track of 144 five-minute cells filled from the load ramp, an 18px stress track with stress-amber cells, and an 18px break track with ink spans. Each track has an ink left edge and hour rules drawn over the cells. A watch-off stretch is one struck empty box. Choosing a highlight sentence lays a highlighter swipe across that stretch of all three tracks; it wipes in from the left in 0.42s and blends by multiply in light and screen in dark. Hovering shows a 1px ink cursor and a tooltip with the five-minute window. A key beneath names every fill in plain words.

### Highlight sentences
A ruled list of one to four statements under the roster. Each is a full-width button in the Statement role with one phrase under a highlighter mark in the colour of its subject. The mark covers the lower 78% of the line and never the whole sentence.

### Week grid
The same cell at 62 by 44px, holding a rounded range in tabular digits on a load-ramp fill. Units start on a 2px ink rule; the selected cell takes a 2px inset ink outline; an unusual week is circled with the red pen ring; a held-back week is a struck box. The legend repeats every device.

### Break tally
Five joined hour boxes inside an ink outline, filling left to right, with a narrow-caps scale beneath and the Display figure above.

### Paired bars
Comparison rows on a soft rule: bar A in `load-4`, bar B in hatched navy, each starting from an ink edge with its value in tabular digits at the right.

## Do's and Don'ts

### Do:
- **Do** put every claim beside its proof: a statement, then the marked cells it refers to.
- **Do** keep each highlighter to its job (teal load, amber stress, violet sleep) and red to alerts.
- **Do** draw missing or held-back data as a struck empty box, with a text label wherever a state is named.
- **Do** build new data displays from the shared cell on ruled tracks with an ink leading edge.
- **Do** give every panel a provenance badge and keep the footer disclaimer on every page.
- **Do** set quantities in wide tabular Archivo and column heads in narrow caps; write sentences in Atkinson Hyperlegible Next.
- **Do** ship every new surface in both themes by using the tokens, never a literal colour.
- **Do** keep nurse-facing controls at 44px or taller.

### Don't:
- **Don't** make it cold and clinical or corporate and bland (both rejected by the user).
- **Don't** replace a plain statement with small explanatory text; say it briefly or put it behind "more".
- **Don't** change the teal and navy pairing or the sidebar and page structure; both are pinned by the user.
- **Don't** fall back to the health-dashboard arrangement of floating metric cards, rings and line charts.
- **Don't** add shadows to sheets, buttons or inputs, or round corners past 3px outside the toggle.
- **Don't** show a gap as a break, or missing data in green.
- **Don't** use a highlighter or the pen ring as decoration; each mark must point at something.
