---
name: Distill
description: A members' locker wall in a dark club locker room, where every lit locker is something you pay rent on.
colors:
  ground: "#0b0c0e"
  ground-glass: "#101215"
  seam: "#050607"
  well: "#07080a"
  input-well: "#090a0c"
  steel-0: "#15181b"
  steel-1: "#1b1e22"
  steel-2: "#24282d"
  steel-3: "#30353b"
  rule: "#2b3036"
  ink: "#eceef0"
  ink-2: "#b1b7be"
  ink-3: "#868d95"
  plate-steel: "#b4bac0"
  plate-ink: "#14171a"
  label-paper: "#d9d6cf"
  label-ink: "#16191c"
  label-ink-2: "#4a5057"
  card-paper: "#e9e7e2"
  key-face: "#e1e4e7"
  key-face-hover: "#eef0f2"
  key-well: "#121417"
  led-amber: "#f2a93b"
  led-jade: "#47c79c"
  led-ice: "#8ec2f0"
  led-white: "#e6ebf1"
  led-idle: "#f1ece2"
  led-off: "#2a2e33"
typography:
  display:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.05rem, 2.6vw + 1rem, 4.3rem)"
    fontWeight: 620
    lineHeight: 1.02
    letterSpacing: "-0.028em"
    fontVariation: "'wdth' 116"
    fontFeature: "'tnum' 1"
  headline:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.75rem, 1.9vw + 0.9rem, 2.85rem)"
    fontWeight: 620
    lineHeight: 1.04
    letterSpacing: "-0.028em"
    fontVariation: "'wdth' 116"
    fontFeature: "'tnum' 1"
  title:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.45rem, 1.2vw + 0.9rem, 2.1rem)"
    fontWeight: 620
    lineHeight: 1.08
    letterSpacing: "-0.022em"
    fontVariation: "'wdth' 116"
    fontFeature: "'tnum' 1"
  numeral:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.9rem, 2.3vw + 0.6rem, 3.1rem)"
    fontWeight: 640
    lineHeight: 1
    letterSpacing: "-0.02em"
    fontVariation: "'wdth' 120"
    fontFeature: "'tnum' 1"
  lede:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1rem, 0.35vw + 0.9rem, 1.2rem)"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "'tnum' 1"
  body:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "'tnum' 1"
  label-tag:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 640
    lineHeight: 1.15
    letterSpacing: "-0.005em"
    fontFeature: "'tnum' 1"
  label-stamped:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "0.14em"
    fontVariation: "'wdth' 112"
    fontFeature: "'tnum' 1"
  plate:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 760
    lineHeight: 1
    letterSpacing: "0.2em"
    fontVariation: "'wdth' 125"
    fontFeature: "'tnum' 1"
  stamp:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 760
    lineHeight: 1
    letterSpacing: "0.14em"
    fontVariation: "'wdth' 125"
    fontFeature: "'tnum' 1"
rounded:
  plate: "2px"
  cell: "3px"
  wall: "4px"
  card: "6px"
  control: "8px"
  key: "10px"
  keycard: "16px"
spacing:
  seam: "6px"
  seam-phone: "5px"
  gutter: "clamp(12px, 1.6vw, 24px)"
  nav: "64px"
  section: "clamp(20px, 2.6vw, 40px)"
  panel: "clamp(18px, 2.4vw, 36px)"
  max-width: "1440px"
components:
  button-key:
    backgroundColor: "{colors.key-face}"
    textColor: "{colors.ground-glass}"
    typography: "{typography.body}"
    rounded: "{rounded.key}"
    height: "48px"
    padding: "0 7px 0 18px"
  button-key-hover:
    backgroundColor: "{colors.key-face-hover}"
  button-key-sm:
    backgroundColor: "{colors.key-face}"
    textColor: "{colors.ground-glass}"
    rounded: "{rounded.key}"
    height: "38px"
    padding: "0 7px 0 14px"
  button-text:
    textColor: "{colors.ink-2}"
    padding: "6px 2px"
  chip-wear:
    backgroundColor: "{colors.steel-1}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.control}"
    height: "32px"
    padding: "0 12px"
  chip-wear-selected:
    backgroundColor: "{colors.card-paper}"
    textColor: "{colors.label-ink}"
  input-field:
    backgroundColor: "{colors.input-well}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "48px"
    padding: "0 14px"
  locker-door:
    backgroundColor: "{colors.steel-1}"
    textColor: "{colors.ink}"
    rounded: "{rounded.cell}"
    padding: "9px 10px 10px"
  name-label:
    backgroundColor: "{colors.label-paper}"
    textColor: "{colors.label-ink}"
    typography: "{typography.label-tag}"
    rounded: "{rounded.plate}"
    padding: "6px 8px"
  number-plate:
    backgroundColor: "{colors.plate-steel}"
    textColor: "{colors.plate-ink}"
    rounded: "{rounded.plate}"
    padding: "3px 5px 2px"
  tally-plate:
    backgroundColor: "{colors.well}"
    textColor: "{colors.ink}"
    typography: "{typography.numeral}"
    rounded: "{rounded.wall}"
    padding: "14px 16px"
  verdict-card:
    backgroundColor: "{colors.steel-1}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.control}"
    padding: "20px 22px 22px"
  verdict-stamp:
    textColor: "{colors.ink}"
    typography: "{typography.stamp}"
    rounded: "{rounded.cell}"
    padding: "7px 12px 6px"
  faq-row:
    backgroundColor: "{colors.steel-0}"
    textColor: "{colors.ink}"
    rounded: "{rounded.cell}"
    padding: "16px 18px"
---

# Design System: Distill

## Overview

**Creative North Star: "The Members' Locker Wall"**

Distill is a premium club locker room after a late session: low warm downlights over dark brushed steel, a wall of numbered lockers, and one small LED on every door. Each locker is one thing the visitor pays for. The page does not decorate that wall; it is the wall, and every surface on it is a locker door, a stamped plate, a paper name label, a keycard, or a dark recessed well. Density is high and deliberate: cells butt against each other across thin black seams, and empty ground is rare.

The system has one material (brushed graphite steel with fine vertical brushing and a soft top highlight), one family (Archivo, widened for anything stamped), and one source of color (the LED). Color never decorates. Amber, jade, ice and white each mean a lane, and an unlit diode means cleared. State is told through depth and brightness: a door steps forward, dims back, or swings open on its hinge to an empty interior. Nothing reshuffles to show change.

Motion is physical and limited to four verbs: doors hinge, labels unfurl in their holders, diodes switch (fast on, slow decay), and digits roll on reels. A pointer downlight drifts across the steel. Reduced motion renders end states, with words carrying every lane.

**Key Characteristics:**
- Edge to edge cell grids divided by 6px black seams, not by white space.
- Brushed graphite steel as the only surface material; paper only for labels and the selected state.
- LED color as the only color, always meaning a lane; no red anywhere.
- Archivo throughout, widened (116% to 125%) for display and stamped lettering; tabular figures everywhere.
- State as depth and brightness: step forward, dim, swing open, go dark.
- Odometer reels for every count and money figure.

## Colors

A graphite and steel neutral world lit by four small diode colors, each bound to one meaning.

### Primary
- **Locker Jade** (led-jade): keep, back in your pocket, success. Kept verdict word, the "$767 back" figures, the open FAQ diode, the reader LED on a sent signup, the day-60 track mark, text caret and selection tint.

### Secondary
- **Testing Amber** (led-amber): testing on you. The pulsing LED and door wash of lockers under test, on-night bars and holes in the nights card, the coffee-night readout figure, the reader LED while sending.

### Tertiary
- **Your Call Ice** (led-ice): your call, inconclusive, and focus. Your-call LEDs and washes, the Inconclusive verdict word and stamp, the normal-swing band, and every focus ring.
- **Yours White** (led-white): yours, protected, and watching. The protected locker's ringed LED, the baseline week diodes, off-night marks.

### Neutral
- **Locker Room Graphite** (ground): page ground and theme color.
- **Seam Black** (seam): the hairline seams and frame behind every wall of cells.
- **Recessed Well** (well) and **Input Well** (input-well): sunk readouts (tally plate, nights readout) and text fields; always carry an inset shadow.
- **Steel 0 to 3** (steel-0, steel-1, steel-2, steel-3): panels and FAQ rows (0), locker doors and cards (1), the reader and dropdowns (2), scrollbar, current-night cell and track rest days (3).
- **Rule** (rule): 1px dividers inside cards and the footer.
- **Ink, Ink 2, Ink 3** (ink, ink-2, ink-3): primary text, secondary text and ledes, quiet captions and stamped labels.
- **Plate Steel** (plate-steel) on **Plate Ink** (plate-ink): number plates and the wordmark plate.
- **Label Paper** (label-paper) with **Label Ink** (label-ink, label-ink-2): the name label in its holder on every door.
- **Card Paper** (card-paper): selected chips and tabs, the read-out sentence on the try wall, the skip link.
- **Key Face** (key-face, key-face-hover, key-well): the keycard button and its dark arrow well.
- **Idle Diode** (led-idle) and **Dead Diode** (led-off): every locker is lit warm white before the sort; dead diode means cleared or unavailable.

### Named Rules
**The LED Means Lane Rule.** Amber, jade, ice and white appear only where they mean their lane: diodes, door washes at 12% to 20% alpha, data marks (bars, cost bar, track), verdict words and the figures they qualify. If a colored mark does not mean testing, keep, your call or yours, it is ink.

**The No Red Rule.** No red, product wide. A drop is good news and wears ink or jade.

**The Two Papers Rule.** Light surfaces are reserved: label paper on doors, card paper for the selected state and read-outs, key face for the action. Everything else is graphite steel.

## Typography

**Display Font:** Archivo variable (self-hosted, width 62% to 125%, weight 100 to 900), with ui-sans-serif and system-ui fallback
**Body Font:** Archivo at normal width
**Label/Mono Font:** Archivo widened; no separate mono, tabular figures do the work

**Character:** One grotesque stretched like a stamping die. Headlines run wide and tight, plates and stamps run widest with open tracking, and running text sits at normal width so it stays quiet.

### Hierarchy
- **Display** (620, clamp(2.05rem, 2.6vw + 1rem, 4.3rem), 1.02, width 116%): hero and closing headline; the close scales up to 5rem. Balanced wrap, max about 15.5em.
- **Headline** (620, clamp(1.75rem, 1.9vw + 0.9rem, 2.85rem), 1.04): section headlines.
- **Title** (620, clamp(1.45rem, 1.2vw + 0.9rem, 2.1rem), 1.08): quieter section heads (devices, FAQ).
- **Numeral** (640, clamp(1.9rem, 2.3vw + 0.6rem, 3.1rem), 1, width 120%): tally counts and money on reels; the nights counter runs larger (up to 6rem, line height 0.9).
- **Lede** (400, clamp(1rem, 0.35vw + 0.9rem, 1.2rem), 1.45, ink-2): one line under a headline, max 44ch.
- **Body** (400, 16px, 1.5): FAQ answers (15px, max 62ch), card copy (14 to 15px).
- **Label Tag** (640, 12.5px, 1.15): item names on paper labels; cost line 11.5px 520.
- **Label Stamped** (600, 11px, 0.14em, uppercase, width 112%): the Example tag, card column heads, interior reasons on open doors.
- **Plate** (760, 13px, 0.2em, uppercase, width 125%): the wordmark plate; number plates use 720 at 11px, 0.1em.
- **Stamp** (760, 15px, 0.14em, uppercase, width 125%): verdict stamps with a 2px currentColor border; verdict words on cards run up to 2rem at 740.

### Named Rules
**The Stamped Width Rule.** Width carries hierarchy. Display 116%, numerals 120%, plates and stamps 125%. Running text and controls stay near 100% to 106%.

**The Tabular Everywhere Rule.** Tabular figures are set on the body and inherited by everything, so reels, costs and nights never jitter.

## Layout

The wall is an 8 column grid on desktop with half-height rows (row unit computed so the hero wall fills one viewport, minimum 60px), 6 at 1023px and below (66px rows), and 3 full-height lockers per row on phones under 640px (58px rows, 5px seams). Full lockers span two rows, half lockers one; `grid-auto-flow: row dense` packs them. The headline panel and the keycard reader are wall cells themselves, spanning five columns. Cells sit on a seam-black frame with a 6px gap and 6px padding, so seams, not space, divide the content.

Sections below the hero sit in a 1440px max container with a fluid gutter (12px to 24px) and compact section padding (20px to 40px). Two-column stages (nights, devices, try, deal, FAQ, close) use asymmetric fractions such as 0.9fr / 1.25fr and collapse to one column at 1023px. The nav is a fixed 64px bar (58px under 1024px) that hides on scroll down. A fixed tally plate appears bottom left after the hero on tablet and desktop. Short laptop screens (1024px and up, 780px tall or less) tighten the hero by viewport height so the wall still fits its cells.

### Named Rules
**The Seam Rule.** Inside any wall, cells are separated by the seam (6px of seam black) and nothing else. No empty band over 96px anywhere on the page.

## Elevation & Depth

Depth is physical and mostly inset. Steel surfaces carry a 1px inner top highlight and 1px inner bottom shade, a soft top-to-bottom gradient, and 1px by 3px vertical brushing. Wells are recessed with a heavy inset shadow. Outer shadows are soft, black and ambient, used only on objects that sit off the wall: the keycard button, cards, the fixed tally, the keycard, name labels. Atmosphere comes from three warm overhead downlight pools on the wall, a pointer-following downlight (lerp 0.12, fine pointers only), a fixed film grain layer at 5.5% and a lens vignette.

### Shadow Vocabulary
- **Steel edge** (`box-shadow: inset 0 1px rgb(255 255 255 / .09), inset 0 -1px rgb(0 0 0 / .6)`): every door, panel and plate at rest.
- **Recessed well** (`box-shadow: inset 0 2px 8px rgb(0 0 0 / .9), inset 0 0 0 1px rgb(255 255 255 / .05)`): tally plate and readout; inputs use `inset 0 2px 5px rgb(0 0 0 / .8)`.
- **Step forward** (`box-shadow: 0 12px 26px rgb(0 0 0 / .65), 0 0 0 1px` amber at 22%): a locker under test, with translateZ(10px).
- **Key lift** (`box-shadow: 0 10px 26px rgb(0 0 0 / .45)`, hover `0 14px 32px rgb(0 0 0 / .55)`): the keycard button.
- **Card float** (`box-shadow: 0 30px 70px rgb(0 0 0 / .6)`): the nights card and verdict cards (verdict cards add a 1px black ring).
- **Diode glow** (`box-shadow: 0 0 0 1px rgb(0 0 0 / .6), 0 0 9px 1px` lane color at 55%): every LED.

### Named Rules
**The Depth Not Reshuffle Rule.** State changes depth and brightness, never position. Testing steps forward and pulses, your call dims to 72% brightness, keep holds, cleared swings open (rotateY to -74deg on the hinge edge) and goes dark. Only after the clear may cleared cells fold away.

**The Unlit Means Cleared Rule.** Every locker starts lit warm white. A dark diode always means cleared or unavailable, and is always paired with words.

## Shapes

Square steel with barely softened corners. Cells, doors, panels and FAQ rows use 3px; plates, labels and stamps 1.5px to 2px; the wall frame and recessed plates 4px; cards 6px to 8px; controls 8px; the keycard button 10px with a 7px arrow well; the keycard 16px at a 1.586 card ratio. Diodes and the hinge knuckles on each locker's left edge are the only round and cylindrical forms. Recurring hardware on doors: louvre vents (hidden below 1024px), a vertical handle, a number plate top left, an LED top right, and a paper label in a dark holder ring at the bottom.

## Components

### Buttons
- **Shape:** keycard, softly rounded (10px), 48px tall (38px small), with a dark square arrow well inset on the right.
- **Primary:** key face with ground-glass text at 650 weight, width 106%, 15px; a diagonal arrow drawn as an SVG mask.
- **Hover / Focus:** face lightens to key-face-hover and the shadow deepens; the arrow exits up-right as a fresh one slides in (350ms ease-out). Press scales to 0.97. Focus is a 2px ice outline at 3px offset. Disabled desaturates to 55% brightness with no shadow.
- **Text button:** ink-2, underlined in rule color, for secondary actions (start over, motion toggle).

### Chips
- **Style:** wearable chips and verdict tabs are 32px to 36px quiet steel (white at 4% to 4.5%, 1px inner white ring at 7%), ink-2 text, 7px to 8px radius.
- **State:** selected flips to card paper with label ink and no ring. Press scales to 0.97.

### Cards / Containers
- **Corner Style:** 6px (nights card), 8px (verdict cards).
- **Background:** brushed steel-1.
- **Shadow Strategy:** card float (see Elevation).
- **Border:** none; inner top highlight only. Internal dividers are 1px rule.
- **Internal Padding:** clamp(14px, 1.8vw, 26px); verdict cards 20px 22px 22px.

### Inputs / Fields
- **Style:** 48px recessed input well, 8px radius, inset shadow plus a 1px white ring at 7%; label above at 12.5px 600 ink-2.
- **Focus:** the inner ring turns ice; no outer glow.
- **Status:** the keycard reader's slot LED blinks amber while sending, turns jade with a drawn check on success; messages are text, never red.

### Navigation
- **Style:** fixed 64px glass bar over ground (blur 10px), wordmark as a stamped plate, three ink-2 links at 14px 520 that brighten to ink on hover, and the small keycard button. Links hide under 1024px. The bar slides away on scroll down (220ms ease-in) and back on scroll up (320ms ease-out).

### Locker (signature)
A door on a frame, the unit the whole system is built from. Full lockers span two rows, half lockers one. The door carries a number plate, LED, vents, handle, and a paper name label with the item and monthly cost. Hover, focus or tap unfurls the label to its day-one sentence (grid rows, 320ms ease-out); on half lockers the sentence rises above the cell as its own paper card. Lane sets the LED, a soft corner wash and depth. Cleared doors swing open on the hinge (perspective 1100px, ease-door) to a dark interior with a stamped uppercase reason and the jade amount back. The tone of each door varies by 3% to 7% so no two are quite the same steel.

### Tally Plate (signature)
A recessed well holding count and money on odometer reels (each digit a stacked column in a dark window, 600ms ease-out), with an Example stamp rotated -2deg and a jade "back" figure that fades in after the clear. A compact glass version follows on screen after the hero.

### Verdict Stamp (signature)
Uppercase widest Archivo inside a 2px currentColor box; lands with a scale from 1.45 and a -4deg settle. Ink for Dropped, ice for Inconclusive, jade for Kept words.

## Do's and Don'ts

### Do:
- **Do** build every new surface out of the wall's parts: steel cells on seam black, plates, paper labels, wells and diodes.
- **Do** bind every colored mark to a lane: amber testing, jade keep, ice your call, white yours, dark cleared.
- **Do** pair every lane color with a word, so nothing is carried by color alone.
- **Do** show change as depth and brightness (step forward, dim to 72%, swing open on the hinge, go dark) rather than moving items around.
- **Do** put every count and money figure on odometer reels with tabular figures.
- **Do** widen Archivo for display (116%), numerals (120%) and stamps (125%), and keep running text at normal width.
- **Do** use cubic-bezier(.16, 1, .3, 1) for arrivals, cubic-bezier(.55, 0, 1, .45) for faster exits, cubic-bezier(.2, .75, .25, 1) for hinges, and linear only for scroll scrub.
- **Do** keep the reduced-motion path: end states shown, reels at final values, downlight and pulses off.

### Don't:
- **Don't** use red, or any color outside the four lane diodes, ink, steel and paper.
- **Don't** tint whole panels or text blocks with a lane color; washes stay at or under 20% alpha on the door they belong to.
- **Don't** round a steel cell past 3px or a control past 10px; only the keycard reaches 16px.
- **Don't** open space between cells; seams divide a wall, and no empty band exceeds 96px.
- **Don't** set an uppercase stamped label above a headline as a kicker; stamped uppercase belongs on plates, stamps, column heads, interior reasons and the Example tag.
- **Don't** use hard offset shadows; outer shadows are soft, black and ambient.
- **Don't** swap Archivo for a system display face or add a second family.
