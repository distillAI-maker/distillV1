# Distill design identity (draft 1, from the Figma Make build)

Status: first draft, written from the Figma Make export (`distill-brand/onboarding`, files `src/App.tsx` and `src/index.css`) before any change. It gets rewritten from what ships at the hand-off step. Line references are to those two files as exported. "Extrapolated" marks a value the Figma code does not state, with the line it was derived from.

## 1. Direction

Dark, warm, editorial. The build reads like a private letter set in a good serif, held in low light: a near-black ground (`--night #100f0b`), a bronze dusk for the screens where you write (`index.css` 314-321, 582-588), cream "paper" for text and for the few light panels (4-6), one brass accent (14), square corners (209, 558, 1278) and hairline rules everywhere (`border-bottom: 1px solid rgba(255,255,255,.1)` on chips and answers, 452, 707). Display type is Cormorant Garamond at large sizes with tight leading (107-113); UI is Manrope, light weights, small tracked caps for labels (99-105).

The light/dark default is dark. Paper surfaces exist only as inverse panels (`.membership-value` 1193, `.report-preview` 1347) and as the primary button (`.action-light` 226). So both targets default to dark, and paper is the inverse panel.

## 2. Layers

**Layer 1, deliberate (the identity):** the night and dusk grounds; paper-light text; brass for selection, progress and money on dark; Cormorant for titles, money and anything the person writes (the textareas are set in the serif, 367, 608); Manrope 300 for running text; tracked caps eyebrows; square buttons with a trailing arrow and uppercase label (207-219, `Action` in App 92-109); list rows rather than pills for chips (a hairline row with a brass left marker when selected, 448-482); the folio details ("Prepared for you · Private · 01", 863-872); the eight-point mark (App 83-90, 201-205); the 2px brass rule (874-879, 844-846); old-style figures in the serif.

**Layer 2, defaults that came along:** Tailwind v4 is imported (2) but no utility class is used anywhere; there is no shadcn and no `src/components/ui`. Body has no size set (16px browser default). The prompt's assumption of a shadcn token layer does not apply to this export.

**Layer 3, Figma Make artifacts:** fixed heights (`.question-content` min-height 700, 672; `.invitation-hero` 790, 1136; `.report-preview` 650, 1353; `.arrival-glow` 420px, 249-254); inline width math for the progress line (App 132, `screen / 9`, which also counts the two Essentials stages and five questions as one step each); a lost space in "Distill your life." (App 157-158: the leading space of an inline-block span collapses, so it renders "Distillyour"); one-off colour values that should be one token (`#d6b078` 786 and `#d3b47f` 1112 are the same idea; `#575752` 978 has no name); the unused `src/assets/david-reference.jpg` (no import anywhere); the `.paper` class (91) that nothing uses.

## 3. Type

Two families, both on Google Fonts, as the build loads them (1): Cormorant Garamond 400, 500, 600 and 500 italic; Manrope 300, 400, 500, 600.

Proposed scale. The build uses 25 distinct sizes from 7px to 78px; this collapses them onto ten steps. Anything the build set below 11px moves up to 11 (accessibility floor; the 7-10px labels at 38-55% white fail contrast or legibility).

| Name | Family | Size / line height | Tracking | Weight | Used for | From |
| --- | --- | --- | --- | --- | --- | --- |
| figure | Cormorant | 72 / 1 | -0.02em | 400 | money that comes back, price | `.saving strong` 78 (1115), `.pay-price` 58 (1258), extrapolated midpoint |
| display-xl | Cormorant | 60 / 0.95 | -0.025em | 500 | arrival line, the reveal lines | `.arrival-copy` 60 (269), reveal 48/51 (781, 787) |
| display | Cormorant | clamp(42px, 11vw, 58px) / 0.92 | -0.02em | 500 | every screen title | `.display-title` (107-113), unchanged |
| heading | Cormorant | 28 / 1.3 | 0 | 500 | letter paragraphs, group and item titles | 27-28 (834, 883, 994, 1060) |
| lead | Cormorant | 22 / 1.35 | 0 | 500 | what the person writes, asides, short lines | 20-25 (368, 432, 609, 659, 931) |
| body | Manrope | 16 / 1.55 | 0 | 300 | subheads, paragraphs, every input | `.subhead` 15 (117), raised to 16 so iOS doesn't zoom inputs |
| ui | Manrope | 14 / 1.4 | 0 | 400 | chips, answers, list rows | 14 (456, 709) |
| label | Manrope | 13 / 1 | 0.06em, uppercase | 500 | buttons | `.action` (211-217) |
| caption | Manrope | 12 / 1.5 | 0 | 400 | notes, prices in rows, meta | 10-11 (411, 467, 1240), raised |
| eyebrow | Manrope | 11 / 1.2 | 0.2em, uppercase | 600 | eyebrows, category labels, folio | 9-10 at 0.14-0.22em (100-104, 422-426, 866-868), raised |

Numbers: Cormorant's default figures are old-style, which is part of the look ("14 things", "$750"). Its `tnum` feature keeps them old-style and makes them equal width (checked in the font: `one` maps to `one.tosf`), so every number that can change gets `font-variant-numeric: tabular-nums` without losing the classical figures. Manrope numbers (prices in rows) also get `tabular-nums`. Money is set as figure plus a lighter unit: "$114" in the figure style, "a month, back." in lead (1111-1125 already does this); "$79 / mo" in rows becomes "$79 a month" in caption, unit at weight 300.

Wordmark: the build sets it two ways and both are kept. Small: "DISTILL" in Cormorant caps at 13px, tracking 0.18em (`.mini-wordmark` 154-159). Large: "Distill" in Cormorant 500, sentence case, tracking -0.025em (269-271). The landing page already has a Cormorant-caps wordmark class (`wm-w1`); it moves to the build's exact tracking. The eight-point mark sits beside it only on the arrival and the invitation, as in the build.

## 4. Colour

Proposed tokens. Hex values are the build's except where marked; changed values exist only to pass contrast or to remove red.

| Token | Value | Role | From |
| --- | --- | --- | --- |
| `--bg` | `#100f0b` | ground (night) | `--night` (16) |
| `--dusk` | `linear-gradient(158deg, #1a1508 0%, #4a2814 62%, #6a3a1c 100%)` | ground for screens where you write | 316-319, 585-586; lightest stop darkened from `#8a5030` (see contrast) and the two radial glows removed |
| `--surface` | `rgba(245, 237, 215, 0.09)` | field and panel on dark | 357, 597 |
| `--paper` | `#ede3cc` | inverse panel ground | `--paper` (5) |
| `--paper-light` | `#f5edd7` | text on dark, primary button, inverse surface | (6) |
| `--ink` | `#131009` | text on paper | (7) |
| `--ink-soft` | `#3a3628` | secondary text on paper | (8) |
| `--muted` | `#a7a292` | secondary text on dark (was 55-72% white) | extrapolated: paper-light at 66% on night |
| `--faint` | `#959081` | meta on dark, the lowest text allowed (was 38-45% white) | extrapolated: paper-light at 58% on night |
| `--muted-ink` | `#67604f` | secondary text on paper | `--muted #7a7264` (10) darkened to pass |
| `--rule` | `rgba(245, 237, 215, 0.14)` | hairline on dark | 452, 707 (0.1-0.2) |
| `--rule-strong` | `rgba(245, 237, 215, 0.26)` | field borders, open group | 358, 1020 |
| `--rule-ink` | `rgba(19, 16, 9, 0.14)` | hairline on paper | `--line` (10) |
| `--accent` | `#b89552` | brass, on dark only | `--brass` (15) |
| `--accent-light` | `#d6b078` | money figures on dark | 786; `#d3b47f` (1112) merged into it |
| `--accent-ink` | `#7d6029` | brass on paper (checks, rules, focus) | extrapolated: brass darkened until it passes on paper |
| `--on-accent` | `#100f0b` | text or check on brass | 735 |

Where the accent is allowed: the selected row marker and the selected answer check; the progress fill; the focus ring; the money figure on the reveal and on the saving ("$750 a month", "$114"); the 2px rule; the mark on arrival and invitation. Nowhere else. The primary button is paper-light, not brass, as in the build.

Nothing is red. The build has two reds: `--oxblood #6b1f1a` and `--deep-red #3d1210` (11-12). They appear on the "Ready to let go" group (973-975), the 2px rule on paper (876), the membership checks (1222), the selected source chip's text (531) and the custom-row Add button (573), and as a red glow behind the invitation (1141-1149). All of them go: rules and checks to `--accent-ink`, text to `--ink`, the glow removed. Errors are a plain sentence in `--paper-light` (or `--ink` on paper) with the field outlined in `--rule-strong`. "Dropped" is the same type and colour as "kept" and "inconclusive".

The four group colours (`--sage #5e6d58`, `--clay #a86848`, `#575752`, oxblood; 13-14, 965-979) are an open question in the brief.

### Contrast (WCAG ratio)

| Pair | Ratio | Passes |
| --- | --- | --- |
| paper-light on bg | 16.41 | text |
| muted `#a7a292` on bg | 7.51 | text |
| faint `#959081` on bg | 6.01 | text |
| accent on bg | 6.81 | text |
| accent-light on bg | 9.44 | text |
| paper-light on dusk, lightest stop `#6a3a1c` | 8.04 | text |
| paper-light at 72% on dusk lightest | 5.04 | text |
| accent on dusk lightest | 3.34 | large text and strokes only |
| ink on paper-light | 16.26 | text |
| muted-ink `#67604f` on paper-light | 5.35 | text |
| muted-ink on paper | 4.89 | text |
| accent-ink `#7d6029` on paper-light | 5.03 | text |
| on-accent on accent | 6.81 | text |
| *Before:* 38% white on night (folio meta) | 3.55 | fails |
| *Before:* 55% white on the dusk's lightest corner | 2.96 | fails |
| *Before:* 72% white on the dusk's lightest corner | 3.91 | fails |
| *Before:* `#7a7264` on paper-light | 4.07 | fails |
| *Before:* brass on paper-light | 2.41 | fails, even as a stroke |

## 5. Space, radius, borders

Spacing scale on 4: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 96, 120. The page gutter is 24 (96). The top of content is 120 (was 118, 96). Odd values in the build (13, 14, 17, 22, 25, 27, 35) round to the nearest step.

Radius: 0 for everything (buttons 209, inputs 558, Apple Pay 1278, cards). One exception the build already has: small tag chips (the "where did this come from" options) are fully round (522), token `--r-pill: 999px`.

Borders: 1px hairlines in `--rule` / `--rule-ink`; 2px for the brass rule and the selected-row marker (453). No shadows on anything inside the app (the only shadow, 63, frames the prototype on desktop and is not part of the UI).

## 6. Components

- **Button (Action, App 92-109):** full width, 62px min height (215), square, label style, trailing 20px arrow. Primary: paper-light ground, ink text (226-229). Secondary: transparent with a 1px paper-light border (231-234). Text link: caption, underlined, 4px offset (394-401). Hover: background to paper (extrapolated). Active: 98% scale is out (nothing bounces); background to `--paper` and arrow moves 2px right in 150ms. Focus: 2px accent outline, 3px offset. Disabled: 40% opacity, no arrow.
- **Row chip (448-482):** a list row, not a pill. Ui type, 52px high (raised to 56 so the + and × targets reach 44), hairline under, 2px brass left marker and `--surface` tint when selected, price in caption at the right, tabular.
- **Tag chip (519-532):** pill, caption, 1px `--rule-strong`; selected is paper-light fill with ink text (was deep red text).
- **Answer row (703-736):** ui type, 59px (to 60), hairline under, 20px square check at right; selected check is brass fill with on-accent tick.
- **Input and textarea (356-376, 596-617):** `--surface` with a 1px `--rule-strong` border, square; what the person writes is in the lead serif; placeholders in `--faint`. Focus: border to `--accent`. Inputs at 16px minimum.
- **Progress:** the 1px rule with a 2px fill (167-184), in `--accent` (was the text colour), counted against the real number of steps. The step counter "02" stays.
- **Panel (inverse):** paper ground, ink text, ruled lines every 24px as in `.report-preview` (1348-1351).
- **Verdict line:** not in the build. Extrapolated from `.best-line` (917-934): an eyebrow word ("Kept", "Dropped", "Inconclusive", all one style), the sentence in lead, the number in figure or heading with tabular figures.
- **Money:** figure plus a lighter unit (1111-1125). Never a strike-through, never coloured to mean good or bad.

## 7. Motion

| Token | Value | From |
| --- | --- | --- |
| `--ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` | 73, 278, 961 |
| `--ease-in` | `cubic-bezier(0.64, 0, 0.78, 0)` | extrapolated mirror of ease-out, for leaving |
| `--dur-ui` | 200ms | chip and answer transitions 200-250 (461, 714) |
| `--dur-panel` | 300ms | group expand (961, was 700), progress (183, was 700) |
| `--dur-screen` | 280ms | the one screen transition (`settle`, 71-74 and 1456-1465, was 700ms with a scale) |

The one screen transition: opacity 0 to 1 and 8px up to 0, ease-out, 280ms, no scale. It restarts cleanly if the screen changes mid-way (keyed remount).

Long motion kept only where it is the moment: the arrival (wordmark slides 58px and the sentence completes, 275-297) and the reveal (names gather and dissolve, then three lines arrive over about 6 seconds, 750-807). Both skip straight to their end state under reduced motion.

Removed: the mark's 180° spin on arrival (264, 1478-1494; it fades instead), the endlessly orbiting ring on the invitation (1159-1166, 1528-1532), the breathing microphone (640-642; listening becomes a steady brass dot and the word "Listening").

Reduced motion: the build's global rule (1541-1550) stays, and the arrival and reveal show their final state immediately.

## 8. Iconography

Inline line icons on a 24 grid, stroke 1.5, round caps and joins, `currentColor`, shown at 20px (186-195; the build uses 19). The landing page's icon set is already stroke 1.5 with round caps and joins (`.ic`, index.html line 55), so only its colour and size change. The mark is the eight-point asterisk with a centre circle at stroke 0.7 (App 83-90); it is the only decorative glyph.

## 9. Voice

The Tone Guide and Emotional Positioning sheets are the rules: describe the night, not the person; nothing red; name the cause and skip the comment; effort before the verdict; the choice at the end; a lapse is data; verdicts on a fortnight; the scoreboard goes down. No exclamation marks, second person, under 60 words, no health claims, money as a plain figure and a plain "back".

The build passes the banned-word list (one hit, "what we missed", is about the app's list, not a lapse). It breaks the "about the person" rule in several places; those are listed in the brief with rewrites.

## 10. Don'ts

Red. Grades, scores, rings, streaks, badges, confetti. Gradient blobs and glows. Glass or blur (the build's only blur is the locked reasons on screen 8, an open question). Exclamation marks. Emoji. Rounded buttons. Text under 11px. Secondary text made by lowering white's opacity below the `--faint` level. Anything that spins or pulses forever.

## 11. Extrapolations

Every value above marked "extrapolated": `--muted`, `--faint`, `--muted-ink`, `--accent-ink`, the darker dusk stop, `--ease-in`, the hover and disabled states, the type steps "figure" and the raised small sizes, the verdict line, the 4-based spacing, the focus ring. Each names its source line where it appears.

## 12. Token mapping for apps/web

Filled in at hand-off (`docs/brand/tokens.css`).
