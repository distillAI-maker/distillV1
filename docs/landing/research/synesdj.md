# SynesDJ landing page teardown (synesdj.vercel.app)

Fetched 2026-10-09 (server date 2026-10-10 02:28 GMT). Raw files are in `research/synesdj/`: `index.html` (87,760 bytes, etag `a257d1d65516e11e5bcd847a62626ac1`, re-fetched with a cache-buster and byte-identical), `fonts-*.css`, `assets/` (images, posters, logo, icons). Videos were probed with HEAD only (filter-key.mp4 945 KB, mood-dance.mp4 2.55 MB, filter-genre-guitar.mp4 1.95 MB).

---

## Stack

**There is no framework and no library.** The whole site is one hand-authored `index.html`: about 34.5 KB of inline `<style>`, about 30.6 KB of inline `<script>` (one IIFE, `'use strict'`) and about 21 KB of markup. The page loads no external JS at all.

- No build markers: no `_next/`, no `__NEXT_DATA__`, no `data-framer`, no Webflow `w-` classes, no Vite hashes, no `<meta name="generator">`. Every asset path is plain (`assets/dp-hero.jpg`).
- Hosting: Vercel static (`server: Vercel`, `x-vercel-cache: HIT`). One serverless route, `/api/waitlist` (GET returns `{"error":"method_not_allowed"}`; the page POSTs `{email, plan, placement, _honey}`). The fallback is `formsubmit.co/ajax/thesynesdj@gmail.com`.
- Grep results across the whole file: **0** hits for gsap, ScrollTrigger, SplitText, lenis, locomotive, framer-motion/motion, three, r3f, drei, ogl, pixi, curtains, Rive, Lottie, Spline, matter, cannon, howler, tone, AudioContext, `gl_FragColor`, `uniform`, `animation-timeline`, `startViewTransition`. Hits: IntersectionObserver (11), requestAnimationFrame (11), mask-image (12), mix-blend-mode (8), clip-path (2), backdrop-filter (1), canvas `getContext('2d')` (1), SMIL `<animateMotion>` (2).
- **No audio.** Nothing on this DJ product's page makes sound. Music is only implied: a metronome ticks at an exact 128 BPM, the scroll bar reads as a track timeline, and the entrance is a "needle drop".
- Icons: Lucide (`<!-- @license lucide-static v1.45.0 - ISC -->`), loaded as `<img>` and recoloured with `filter: invert(1)`.
- Fonts: DM Sans from Google Fonts and Clash Display from Fontshare (details under Tokens).
- Native platform features stand in for libraries:
  - `<dialog>` with `showModal()` for signup and privacy.
  - `<details>` plus `::details-content` with `interpolate-size: allow-keywords` animates accordion height.
  - CSS scroll-snap does the section paging.
  - `scroll-behavior: smooth` does anchor scrolling; there is no Lenis.
  - SVG SMIL moves dots along paths.
  - SVG `feTurbulence` makes the grain.
  - Plain Canvas 2D draws the waveform.
- Fairly new CSS in use: `color-mix(in srgb, …)` (about 12 times), `text-wrap: balance/pretty`, `overflow: clip`, `100svh`, `content-visibility: auto` (mobile), `mask-composite: intersect`, `transition-behavior allow-discrete`, `::details-content`, and `interpolate-size`.
- Analytics hooks with no vendor attached: `track()` dispatches a `synesdj:analytics` CustomEvent and pushes to `window.dataLayer` if one exists, but GTM is not loaded. Events: `signup_open/attempt/success/error`, `section_view` (IO at 0.4), `deck_card_view`.

### Meta, positioning and authorship
- `<title>`: "SynesDJ | Build a better ear for mixing."
- Description (paraphrased): music discovery, colour-guided recommendations and a pocket DJ controller.
- OG description: "Discover your next favorite song. See what fits. Make it your mix."
- `og:image` = `assets/dp-hero.jpg`, `twitter:card` = summary_large_image, `theme-color` `#08080a`, `color-scheme: dark`.
- Positioning: a listener-first, theory-free DJ and discovery app. Synesthesia (key → colour) is the hook. Prices: $0 for 7 days, $4.99 a month, $70 lifetime. It is a waitlist: "nothing is charged on this page".
- **No designer, studio or template credit anywhere.** The only HTML comments are section labels (`<!-- HERO -->`, `<!-- PAIN POINTS -->` …). The contact is a Gmail address (thesynesdj@gmail.com). The JS comments read like iterative, agent-assisted development: "signup / dialogs (unchanged flow)", "unified scroll pipeline: every scroll-linked effect registers a task here, so one passive listener and one rAF drive them all", "Each ring is its own <svg> so the blur rasterizes once and the CSS spin runs on the compositor". This is probably a student or founder build refined over many passes, not agency work. The premium feel comes from design decisions, not from a studio pipeline.
- **IP flag:** the hero and OG image (`dp-hero.jpg`, 1200×1630, apparently a scanned print) is a photo of a chrome Daft Punk-style robot helmet with a rainbow lens flare on the earcup. The alt text calls it "A robot-helmeted artist in profile". Do not emulate that: commission or generate original hero art. `dj-hero.jpg` looks like a stock photo (purple-lit hand over a DJ controller). `color-vinyl.jpg` (1400², rainbow-lit record) looks like a render or generated image. The card videos are stock vertical clips (orange abstract, guitar, vocal, drums, a dancer silhouetted on red).

---

## Tokens

### Fonts
| Role | Family | Source / foundry | Weights loaded | Weights used |
|---|---|---|---|---|
| Display (`--display`) | **Clash Display** | Fontshare, by Indian Type Foundry (ITF). Free for commercial use | 500, 600, 700 | 500 for every headline; 600 for brand wordmark, plan names, ticker, footer watermark |
| Body / UI (`--font`) | **DM Sans** | Google Fonts (Colophon Foundry for Google; variable). Fallbacks: `-apple-system, BlinkMacSystemFont, sans-serif` | 400, 450, 500, 550, 600, 650, 700 | 400 body; 450 price sub-line; 550 FAQ summary; 600 strong/labels; **650** buttons, plan price, step numbers, dot tooltips; 700 card tags and badges |

- Using the variable axis for in-between weights (450, 550, 650) is a quiet craft signal. Buttons sit at 650, not 600 or 700.
- Headlines use the display face at **500, not bold**. Big, light-medium display type reads more editorial than heavy display type.
- Note: the Fontshare CSS response also includes 4 unused `Switzer` @font-face rules.
- Global reset: `*{letter-spacing:0}`; `h1,h2,h3{text-wrap:balance}`; the hero sub uses `text-wrap:pretty`.

### Colour
Everything is **violet-tinted near-black**. In OKLCH, all neutrals sit at hue about 286–301 with chroma 0.004–0.016, so the greys are faintly cool-violet instead of dead grey.

| Token | Value | OKLCH | Use |
|---|---|---|---|
| `--bg` | `#08080a` | 0.135 0.005 286 | page ground, band fades |
| hero ground | `#030305` | 0.099 0.008 285 | hero only (darker than the page so the portrait glows) |
| `--surface` | `#101013` | 0.174 0.006 286 | plan cards (`linear-gradient(155deg,#17151c,#101013 55%)`) |
| ticker ground | `#0a0a0d` | | ticker and scrollbar track |
| `--ink` | `#f6f5f8` | 0.972 0.004 301 | text; **primary button fill** (light pill on dark) |
| `--muted` | `#a6a4af` | 0.724 0.016 294 | body copy |
| hero sub | `#c3c0cb` | | brighter than muted, hero only |
| fine print | `#8d8996` | | footer, plan fine print, track time |
| `--line` | `#29282f` | 0.281 | hairlines, plan borders |
| rules | `#45404e`, `#3b3644`, `#34333c` | | step rules, ghost-button border, wavy hairline stroke |
| `--violet` | `#8b5cf6` | 0.606 0.219 293 | **main accent, 14 uses** (this is Tailwind violet-500) |
| `--lavender` | `#bba2ff` | 0.770 0.132 295 | "DJ" in the wordmark, hero accent words, focus ring, links |
| `--blue` | `#4f7dff` | | pain-point rule, BPM card, section light |
| `--teal` | `#2dd4bf` | | Genre card (Tailwind teal-400) |
| `--orange` | `#ff8a2a` | 0.749 0.173 54 | **the one warm counter-accent**: step dots, ticker bullets, Lifetime plan, FAQ squiggle |
| pink | `#d976a8`, card `#d946a1`→`#81245e` | | Melody card, shimmer end, section light |

**The 12-key wheel palette** (`WHEEL_COLORS`, which carries the brand idea):
`#a58aff #777ff1 #538cdc #50afb5 #60b398 #9abd7f #d1bc76 #da9b67 #d88083 #d976a8 #bd76cf #a775e8`

- In OKLCH these hold **L 0.64–0.80 and C 0.09–0.17**: a desaturated, near-equal-lightness rainbow, not an RGB rainbow. That is why the spectrum looks like a premium print and not a gaming UI.
- The palette appears on the progress bar, the canvas waveform, the key-wheel blobs, the vinyl conic overlay, the success-burst dots and the scrollbar gradient.

**Per-section ambient lights.** Each section's `::before` paints two radial lights from `--light-a` and `--light-b`:
- Base, at 14% 54% and 88% 36%: `#8b5cf624` / `#4f7dff12`
- Section 2: `#d976a814` / `#8b5cf624`
- Section 3: `#4f7dff25` / `#2dd4bf10`
- Section 5: `#bba2ff12` / `#ff8a2a18`
- Deck: `#2dd4bf18` / `#ff8a2a12`
- Plans: `#8b5cf61b` / `#ff8a2a10`
- FAQ: `#ff8a2a12` / `#d976a80f`

Alphas run from 6–15%. The page gets **colour temperature per section without a single coloured background**.

**Section hue (`--cg`)** drives the cursor glow, the cursor ring, the selection colour and the dialog backdrop tint, in order: `#8b5cf6, #d976a8, #4f7dff, #2dd4bf, #bba2ff, #8b5cf6, #ff8a2a`.

### Type scale (all values from the CSS)
| Element | Size | Line height | Tracking | Weight |
|---|---|---|---|---|
| H1 (hero) | `clamp(56px,7.5vw,96px)`; mobile `clamp(42px,12vw,52px)` | 1.0 | 0 | 500 Clash |
| Footer watermark | `clamp(88px,16.5vw,232px)` | .8 | -.01em | 600 Clash |
| Section title H2 | `clamp(38px,4.4vw,58px)` | 1.08 | animates .035em → 0 | 500 Clash |
| Card H3 | `clamp(34px,4vw,52px)`; mobile 31px | 1.03 | 0 | 500 Clash |
| Plan name | 36px | 1.1 | | 600 Clash |
| Pain H3 | `clamp(24px,2.3vw,31px)` | 1.2 | | 500 Clash |
| Dialog H2 | 31px | 1.15 | | 500 Clash |
| Ticker | `clamp(20px,2.3vw,29px)`, uppercase | 1.2 | .14em | 600 Clash, outline only |
| Step H3 | 24px | | | 500 Clash |
| Wordmark | 20px / footer 19px | 1 | | 600 Clash |
| Hero sub | `clamp(17px,1.55vw,20px)` | 1.55 | | 400 |
| Card tag | `clamp(15px,1.5vw,19px)`, uppercase | | .08em | 700 |
| Body | 16px | 1.65 | | 400 |
| Secondary copy | 15px (9 uses: the workhorse) | | | 400 |
| Button | 15px / small 13px | 1.4 | | 650 |
| Step number | 12px | | .14em | 650 |
| Fine print | 11.5px, 10.5px (tabular-nums) | 1.5 | .08em (track time) | |

- The display-to-body ratio is roughly 6:1 in the hero (96/16). Headlines are always **two short lines with a turn** set by `<br>`.

### Radii
- `999px`: buttons (pill).
- `18px`: deck cards and dialogs.
- `16px`: plan cards.
- `10px`: input.
- `8px` / `7px`: logo, badges, tooltips, and the dot tooltip at 7px.
- `50%`: 13 uses (dots, wheel, cursor).
- Hierarchy: big objects about 16–18px, controls are pills, chips about 7px.

### Shadows (exact recipes)
- Primary button rest: `0 10px 30px #0005`. Hover: `0 14px 34px #0008, 0 0 28px #bba2ff45` (dark drop plus lavender glow).
- Deck card: `0 35px 90px #000e, 0 0 0 1px #000, inset 0 1px #ffffff29`. This is a huge soft drop, a 1px black outline that separates the card from the dark ground, and a **1px inner top highlight** (the "lit top edge" glass trick).
- Plan rest: `0 20px 55px #0005`. Hover: `0 30px 70px #0008, 0 0 44px color-mix(in srgb,var(--pc) 15%,transparent)`. Featured: `0 0 60px color-mix(… 16% …)`.
- Vinyl: an inset element with `box-shadow: 0 36px 70px #000` sits behind the round mask, so the shadow belongs to the disc and not to the square image.
- Glowing points: `0 0 10px var(--orange), 0 0 3px #fff9` (step dot, a hot white core plus a coloured bloom); ticker bullets use `text-shadow:0 0 14px var(--orange)`.
- **Chromatic-aberration text shadow** on H1 words, section titles and card H3s: `text-shadow: 2px 0 0 #ff3d5e24, -2px 0 0 #3d7bff28` (red right, blue left, about 15% alpha).

### Gradients and blurs
- Squiggle light streaks: SVG `feGaussianBlur stdDeviation="50"` on a 135px-wide stroke.
- Key-wheel blobs: `stdDeviation 7`.
- Entrance sweep: `filter: blur(30px)`.
- Metronome contact shadow: `blur(13px)`.
- Dialog backdrop: `backdrop-filter: blur(4px)`. This is the only backdrop-filter on the page; there is **no glassmorphism**.
- Hero mask and scrims: image `mask-image: linear-gradient(90deg, transparent, #000 26%)` plus overlay `linear-gradient(90deg,#030305 0%,#030305 31%,#030305e8 43%,transparent 70%)` and `linear-gradient(0deg,#030305 0%,transparent 24%,transparent 78%,#03030599 100%)`.
- Vignette: `body::after{radial-gradient(ellipse at 50% 50%, transparent 60%, #00000055 100%)}`, fixed, z 24.

### Easing and durations
| Curve | Uses | Where |
|---|---|---|
| `cubic-bezier(.2,.7,.2,1)` | **8 (house ease)** | reveals, hero words, letter-spacing settle, plan hover, FAQ nudge, logo spin. A strong ease-out ("expo-ish out") |
| `cubic-bezier(.16,.8,.22,1)` | 1 | deck card spread, .7s |
| `cubic-bezier(.2,.8,.25,1)` | 1 | dialog in, .32s |
| `cubic-bezier(.15,.6,.35,1)` | 1 | success burst, .75s |
| `cubic-bezier(.6,.1,.3,.9)` | 1 | needle-drop sweep, .85s (ease-in-out, accelerates through) |
| `cubic-bezier(.45,.03,.55,.97)` | 1 | metronome (easeInOutSine-like, so the arm dwells at each end like a real pendulum) |

- **Durations:**
  - Hovers .2s.
  - Press .08s (`scale(.955)`).
  - Tooltips .18s.
  - FAQ .35s.
  - Dialog .32s with backdrop .4s.
  - Reveals .7s; letter-spacing .9s.
  - Card spread .7s.
  - Genre video crossfade .7s / scale .9s.
  - Plan sheen .85s.
  - Logo spin .7s.
- **Ambient loops:**
  - Shimmer 8s.
  - Squiggle drift 17s and 23s.
  - Vinyl 34s, with the conic overlay at 18s in reverse.
  - Key wheel 52s and 74s in reverse.
  - Melody paths 4.8s, 5.6s and 6.4s with negative delays.
  - Ticker 30s (CSS fallback).
  - Metronome **.46875s = 60/128, i.e. 128 BPM**.
- **Staggers:**
  - Hero words .05 / .13 / .21 / .29s, then the accent line at .42s (80ms steps).
  - Generic `.d1/.d2/.d3` = .08 / .16 / .24s.
- **Lerp factors (JS springs):**
  - Cursor glow 0.13.
  - Cursor ring 0.42.
  - Trail dots 0.3, chained.
  - Waveform hover swell 0.08.
  - Squiggle velocity decay 0.9 per frame.
  - Ticker fling decay 0.94 per frame.

---

## Page structure (section by section)

Fixed chrome sits over everything:
- The logo plus "Synes**DJ**" wordmark is fixed top-left, and the logo spins 360° on hover.
- A small "Get started" pill is fixed top-right.
- **There is no nav bar and no menu links.**
- A 3px rainbow progress bar runs along the bottom edge, with a "0:00 / 4:08" time readout at the bottom right.
- Layers: grain over everything, a vignette, and the cursor light.
- Sections snap (`scroll-snap-type: y proximity`, `.snap{scroll-snap-align:center; scroll-snap-stop:always}`).

| # | Section | Headline (exact) | What's in it | Visual / interaction |
|---|---|---|---|---|
| 0 | Load | n/a | n/a | "Needle-drop" blurred rainbow bar sweeps across the screen once (.85s) |
| 1 | **Hero** (100svh, `#030305`) | "Build a better ear / *for mixing.*" | Sub paragraph (about 26 words), **one** CTA "Get started ↗" | Right-anchored full-height portrait (chrome helmet, rainbow flare on the earcup) masked into black from the left. Per-word staggered rise; "for mixing." in lavender with a moving shimmer gradient. Magnetic CTA. 34 words total |
| 2 | **Pain points** | "The song is right there. / The next one isn't." | 3 columns. Each H3 is **a quoted user question** ("Why is mixing so complicated?"), then one muted sentence. Kicker: "SynesDJ was built for these reasons." | Each column has a 2px top rule in its own colour (violet, blue, orange). A blurred violet light streak drifts top-right. 76 words |
| 3 | **Waveform band** (between sections) | none | none | Full-width canvas of 17 rainbow ribbons drawn additively. It overlaps neighbouring sections by -44px, is faded top and bottom, and swells where the cursor is |
| 4 | **Colour system** | "Less theory, / More feeling." | One paragraph on synesthesia (key → colour) | Large rainbow vinyl spinning (34s) with a counter-rotating conic colour sheen, a specular hotspot that follows the cursor, and a contact shadow. Partly bleeds off the right edge (`margin-right:-5vw`). 38 words |
| 5 | **Filter deck** | "Find what fits." | 5 cards, each: tag "Filter 0N: …", H3, one sentence. "Hear the colors." (Key+Color), "Marry the leads." (Melody), "A shared heartbeat." (BPM), "Identify similar styles." (Genre), "Match the vibes." (Mood) | Fanned, draggable 3D card stack. Each card has a **live mini-visual**: rotating blurred key wheel over a hue-shifted video; SVG melody lines with dots riding them; a CSS-built metronome at 128 BPM; 3 genre videos crossfading every 4s; a dancer video. Coloured dots with hover tooltips; keyboard tabs. About 20 words visible at a time |
| 6 | **Steps** | "From a song you love / to a mix you made." | 01 "Start with your song." 02 "Find its other half." 03 "Make the transition." (Lucide headphones, compass, sliders) | Full-bleed-left photo (DJ hand on decks) with a violet duotone plus halftone dot screen and feathered edges; steps stacked on the right with orange glowing dots. 77 words |
| 7 | **Ticker** | none | "KEY · MELODY · BPM · GENRE · MOOD" | Outlined uppercase type, orange glowing bullets, draggable with momentum |
| 8 | **Plans** | "Big possibilities. / Small price." | Free trial ($0 for 7 days, badge), Monthly $4.99 (featured), Lifetime $70. 3 checks each | Cards lift and glow in their own colour on hover; diagonal sheen sweep; vinyl-groove ring texture. 108 words |
| 9 | **FAQ** | "Good questions." + "Have another? Let's talk." | 5 `<details>` (32 visible words; 331 hidden in answers) | Height-animated accordion, chevron flips, summary nudges 8px right on hover; wavy hand-drawn-looking hairline separators |
| 10 | **Footer** | none | Giant "SynesDJ" watermark (gradient-clipped, 232px max), then a slim footer row (©, Privacy, "Say hello ↗") | Wavy hairline top rule |
| — | **Dialogs** | "Make room for / your next mix." / "You're on the list." | Email-only form, honeypot, privacy line | Dialog springs in; backdrop tinted with the current section hue; on success 12 dots in the key colours burst outward |
| — | Mobile | "Make your next mix." | Sticky bottom CTA bar | Slides up after the hero leaves the viewport (IO), `inert` when hidden |

---

## Effects catalog

Each entry gives the name, how it is implemented, the exact values, and why it reads as premium or non-AI.

### 1. Needle-drop entrance sweep
- **Implementation:** a fixed `#needle-sweep` div, 22vw wide, `skewX(-12deg)`, a vertical gradient of 6 key colours, `filter: blur(30px)`. The class `.go` runs once on load and the element is then removed.
- **Values:** `@keyframes needle {0% translateX(0) opacity 0; 18% opacity .45; 100% translateX(190vw) opacity 0}`, `.85s cubic-bezier(.6,.1,.3,.9)`, z 60.
- **Why:** an entrance with a meaning (a stylus dropping onto the record), not a generic fade-up. It plays once and costs nothing afterwards.

### 2. Per-word staggered rise + shimmer accent (hero H1)
- **Implementation:** each word is wrapped in `<span class="hw">`. IO adds `.in-view` at threshold 0.2.
- **Values:** words go from `opacity 0, translateY(.5em)` to rest with `opacity .55s ease`, `transform .65s cubic-bezier(.2,.7,.2,1)`, and delays .05 / .13 / .21 / .29s. The accent line follows at .42s. The shimmer is `linear-gradient(100deg, lavender 0%, #efe8ff 24%, violet 46%, lavender 68%, #d976a8 88%, lavender 100%)`, `background-size:240% 100%`, `background-clip:text`, looping 8s linear to `background-position:-240% 0`.
- **Why:** the words land in reading rhythm (80ms apart) and the payoff phrase arrives last. The shimmer is slow (8s) and confined to two words, so it reads as lacquer, not a loading skeleton. Note this is a translate-and-fade, not a mask/clip reveal.

### 3. Letter-spacing settle reveal (all H2s)
- **Implementation:** a CSS transition on `.section-title.reveal`.
- **Values:** `letter-spacing: .035em → 0` over `.9s cubic-bezier(.2,.7,.2,1)`, plus `translateY(26px) → 0` and opacity over .7s.
- **Why:** the headline appears to tighten into focus, as if a typesetter were kerning it. Few sites do it, so it does not register as a stock animation.

### 4. Chromatic-aberration headline edges
- **Implementation:** a static text-shadow.
- **Values:** `text-shadow: 2px 0 0 #ff3d5e24, -2px 0 0 #3d7bff28` on H1 words, section titles and card H3s.
- **Why:** a sub-perceptual analog lens or print-misregistration fringe. It makes flat vector type feel photographed. At 14–16% alpha you feel it more than you see it.

### 5. Film grain overlay
- **Implementation:** fixed `body::before` at z 50 (above everything), `pointer-events:none`. The noise is an inline SVG data-URI `feTurbulence type='fractalNoise' baseFrequency='.82' numOctaves='3' stitchTiles='stitch'` on a 180×180 tile at opacity .7. The element has `opacity:.05` and `mix-blend-mode: screen`. Deck cards repeat it inside: `opacity:.06; mix-blend-mode: overlay`.
- **Why:** it kills banding in the huge dark radial gradients and adds a physical "paper or film" tooth. A static texture is cheap; there is no animated noise.

### 6. Vignette
- **Values:** fixed `body::after`, `radial-gradient(ellipse at 50% 50%, transparent 60%, #00000055 100%)`, z 24.
- **Why:** it frames every viewport like a lens and pulls the eye to the centre.

### 7. Per-section ambient lights
- **Implementation:** each section's `::before` holds two `radial-gradient(ellipse …)` lights at 14% 54% and 88% 36%, coloured by `--light-a` / `--light-b` (values under Tokens).
- **Why:** the backgrounds are *lit*, not *filled*, and each chapter gets a slightly different temperature while the ground stays black. That avoids the AI tell of full-bleed purple gradient blocks.

### 8. Blurred "squiggle" light streaks with scroll-velocity skew
- **Implementation:** an absolutely positioned SVG `path` (an S-curve cubic) with `stroke-width:135`, `stroke-linecap:round` and `filter: feGaussianBlur(50)`, sized 48–58vw at opacity .3–.48. One sits in each section, in that section's colour.
- **Layer 1, CSS drift:** `@keyframes sq-drift` from `translate3d(-26px,-10px,0) rotate(-1.6deg)` to `translate3d(26px,14px,0) rotate(1.4deg)`, 17s ease-in-out infinite alternate. A 23s alternate-reverse `.s2` variant is defined in the CSS, but no element uses it.
- **Layer 2, JS parallax:** `delta = (elementCenterY - viewportCenterY) * data-speed`, with speeds .035–.06 and signs alternating per section.
- **Layer 3, velocity jelly:** `vel += dy*0.18` per scroll and `vel *= 0.9` per frame; `skewY = clamp(vel*0.045, ±2.4deg)` and `scaleY = 1 + min(.05, |vel|*.0011)`. The rAF loop stops itself when `|vel| < .08`.
- **Why:** these are not round "blob" orbs (the AI cliché) but **brushed light streaks** shaped like sound or a melody contour. The velocity skew makes the background feel like it has mass and lags behind your scroll.

### 9. Scroll-linked 3D "cube turn" between sections
- **Implementation:** every section's content wrapper is a `.cube-plane` with `transform: perspective(1400px) rotateX(var(--cube-r)) translate3d(0,var(--cube-y),0) scale(var(--cube-s)); opacity: var(--cube-o)`. JS runs on the shared scroll rAF.
- **Values:**
  ```js
  n    = clamp((sectionCenterY - innerHeight/2) / innerHeight, -1, 1)
  edge = max(0, |n| - 0.12) / 0.88        // a dead zone: flat while centred
  --cube-r = -n*edge*16 deg   --cube-y = n*edge*54 px
  --cube-s = 1 - edge*0.05    --cube-o = 1 - edge*0.28
  --cube-origin = n>0 ? '0%' : '100%'     // hinge at top when entering, bottom when leaving
  ```
- **Why:** sections hinge in and out like faces of a rotating cube or a rolodex. Because of the dead zone, content is perfectly flat while you read it and only tips at the edges. Combined with scroll-snap it feels like "turning pages". It is disabled at 700px and below and under reduced motion.

### 10. Scroll-snap paging
- **Values:** `html{scroll-snap-type:y proximity}`; `.snap{scroll-snap-align:center; scroll-snap-stop:always}`; every major section is `min-height:100svh`. Off at 700px and below.
- **Why:** each section is composed as a full-screen "slide", so every screenshot is a poster. `proximity` (not `mandatory`) keeps it from feeling hijacked.

### 11. Painterly waveform band (Canvas 2D, additive)
- **Implementation:** `<canvas width=1800 height=320>` scaled to 100% width, height `clamp(110px,12vw,155px)`, `margin-block:-44px` so it straddles two sections. Top and bottom 38% fade to `#08080a` via `::before`/`::after`.
- **Draw loop:**
  ```js
  globalCompositeOperation = 'lighter'; strokeStyle = 12-stop key-colour linear gradient across W
  for ribbon in 0..16:
    phase = ribbon*0.73 + t*(0.00018 + ribbon*0.000006)
    for x in -30..W+30 step 12:
      u = x/W
      env = sin(PI*u)^0.7 * (1 + strength*1.8*exp(-(u-mouseX)^2/0.012))
      y = mid + sin(u*10.5+phase)*(45+ribbon*3.2)*env + sin(u*27 - phase*.7)*22*env + (ribbon-8)*3.6
    width = 7 + (ribbon%5)*5
    pass 1 halo: alpha .055, lineWidth width+18     // "far cheaper than canvas shadows"
    pass 2 core: alpha .16 + (ribbon%4)*.055, lineWidth width
  ```
  Hover: `strength` lerps to 1 (rate .08) when the pointer is within 50px of the band, swelling the waves under the cursor with a Gaussian bump. IO pauses the loop off-screen.
- **Why:** 17 overlapping translucent strokes added together look like **light painting or long-exposure photography**, not a vector wave icon. The two-pass halo/core gives bloom without shaders. It is the product's colour system made into a sound wave.

### 12. Cursor light + lagging ring + comet trail + click ripple
- **Glow:** a 560px circle, `radial-gradient(circle, color-mix(in srgb, var(--cg) 20%, transparent), transparent 62%)`, `mix-blend-mode:screen`, z 40. It follows the pointer with lerp **0.13**, a slow, buttery lag. `--cg` changes with the section under the viewport midline (`transition: background 1s`).
- **Ring:** 30px, `1.5px solid var(--cg)`, lerp **0.42**. **It only appears over interactive elements** (`a, button, summary, .fcard:not(.is-active)` toggle `body.cursor-cue`).
- **Trail:** 4 dots of 5 / 4 / 3 / 2px at opacity .28 / .23 / .18 / .13, each chasing the previous one at lerp .3 (a chained spring), screen blend.
- **Click ripple:** a 16px ring scales .3 → 5.5 and fades from .75 → 0 in `.55s ease-out` on every pointerdown.
- The native cursor stays visible. The whole system is disabled on `pointer: coarse` and under reduced motion, and the rAF loop stops when total movement drops below 0.4px.
- **Why:** it is a *light source*, not a replacement cursor. Scenes are lit where you look and the light takes the section's hue. Keeping the native cursor avoids the "gimmicky custom cursor" problem.

### 13. Magnetic CTAs
- **Values:** on mousemove inside `.hero-actions` / `.chrome-cta`, `translate(dx*0.22, dy*0.3)` relative to the button centre, composed with `scale(var(--press,1))` so the press state survives; reset on leave. Hover: `translateY(-2px)`, background `#e4dafc`, lavender glow. Active: `scale(.955)` in .08s.
- **Why:** the strength is low (22–30%), so the button leans toward you rather than chasing you. The press scale is fast (80ms), so it feels tactile.

### 14. Spinning vinyl with a counter-rotating colour sheen and cursor specular
- **Implementation:**
  - The image has `mask-image: radial-gradient(circle,#000 0 69%,transparent 70%)` and spins with `vinyl-turn 34s linear infinite`.
  - `::after` sits at `inset:4%` with a `conic-gradient(from 0deg, #a58aff00, #777ff128, #538cdc00, #50afb528, …)` (alternating 0% and 16% alpha stops of the key colours), `mix-blend-mode:screen`, and spins **in reverse at 18s**.
  - `::before` is a specular hotspot: `radial-gradient(230px circle at var(--gx) var(--gy), #ffffff30, transparent 62%)` in screen blend, fading in on hover, with `--gx/--gy` set from the cursor position.
- **Why:** two rotations at different speeds and directions create moiré-like **interference shimmer**, like light on real grooves. The hotspot makes it feel like a physical object under a lamp.

### 15. Fanned, draggable 3D card deck ("filter spread")
- **Layout per card** (offset `o = i - active`, `d = |o|`):
  - `--spread-x = o*39px` (24 on mobile)
  - `--spread-y = -d*8px`
  - `--spread-r = o*1.25deg` (.9 on mobile)
  - `--spread-s = max(.88, 1-d*.025)`
  - `--spread-o = max(.68, 1-d*.065)`
  - `z = 10-d`
  - Transition `transform .7s cubic-bezier(.16,.8,.22,1), opacity .5s`. Cards more than 2 away are hidden on mobile.
- **Drag** (pointer events + pointer capture):
  - Horizontal intent only (`|dx|≥6` and `|dx|>|dy|`).
  - Rubber band at the ends: `dx*=0.35`.
  - The card follows with `--drag-r = clamp(dx*0.012, ±4deg)`.
  - Commit when `|dx| > 16%` of the deck width **or** velocity `> 0.45 px/ms`; otherwise it springs back.
  - Click the active card to advance; click a background card to jump to it.
- **Hover tilt and inner parallax** (fine pointers only, rAF-throttled):
  - Card `rotateY(nx*3.5deg) rotateX(-ny*2.5deg)`.
  - The visual layer moves `(nx*11px, ny*9px)` and the text layer moves **-0.45×** that, in the opposite direction, so there are two depth planes.
  - Hover shortens the transition to `.25s ease-out` so the tilt tracks closely.
- **Card skin:**
  - Border `2px solid color-mix(var(--c1) 55%, #fff 12%)`, radius 18.
  - Background `linear-gradient(120deg, c1 0%, c2 39%, #0b0910 79%)`.
  - Specular `::after` (`radial-gradient(circle at 15% 20%, #ffffff22, transparent 28%)` plus right-edge darkening) and a grain `::before`.
- **Accessibility:** a real `role=tablist` with arrow, Home and End keys, `aria-selected`, coloured dots (`--dc`) with `content: attr(data-label)` tooltips.
- **Performance:** videos are lazy (`<source data-src>` swapped on first activation), only the active card plays and only while the deck is 35% visible, and CSS animations on inactive cards are `animation-play-state: paused`.
- **Why:** this replaces the AI-default "6 icon feature cards in a grid" with **one object you can handle**. Each feature is a physical card with its own colour, motion and texture, and you learn the features by playing with the deck.

### 16. Live mini-visuals inside cards (instead of icons or screenshots)
- **Key wheel:** generated SVG, two rings of 12 ellipses in the key colours. Outer orbit 172, `rx58 ry46`, opacity .95; inner orbit 82, `rx32 ry26`, opacity .6. Each ellipse is rotated `i*30+18`° and blurred with `feGaussianBlur 7`, giving soft petals. The outer ring spins 52s and the inner 74s in reverse. Each ring is its own `<svg>` so the blur rasterises once and the spin stays on the compositor. Behind it, an orange stock video is recoloured with `opacity:.22; filter:saturate(.5) hue-rotate(220deg); mix-blend-mode:screen`.
- **Melody:** three cubic-bezier SVG paths with gradient strokes (`#ffb1d5→#ff5aa9`, `#ffe3bf→#ffc1e1`, plus a 2px "whisper" path at .45), each floating with `melody-float` (`translate3d(-7px,-5px)` ↔ `(8px,6px)` and `scaleY(.96↔1.04)`, 4.8 / 5.6 / 6.4s, negative delays). Two glowing circles ride the paths with SMIL `<animateMotion dur="5s">` / `5.6s begin="-2.4s"`, plus `drop-shadow(0 0 11px #ff7bbb66)`.
- **BPM metronome, built entirely in CSS:**
  - Body: `clip-path: polygon(32% 0, 68% 0, 91% 100%, 9% 100%)`, wood-tone gradient `linear-gradient(105deg,#6e6252,#d9cdb7 42%,#8c7e69 72%,#554b40)`.
  - Inner cavity: a second clip-path trapezoid.
  - Scale: `repeating-linear-gradient(0deg,#ddd 0 1px,transparent 1px 11px)`.
  - Arm: `rotate(±30deg)` at **.46875s alternate = 128 BPM**, eased `cubic-bezier(.45,.03,.55,.97)`, with a blurred elliptical contact shadow.
- **Genre:** 3 stacked videos cross-fading every 4000ms (`opacity .7s`, `scale 1.035 → 1` over .9s), one playing at a time.
- **Media treatment:** `filter: saturate(1.08) contrast(1.06) brightness(.94)`; the right edge fades out with `mask-image: linear-gradient(90deg,#000 0,#000 68%,transparent)`; a radial plus linear scrim for type contrast.
- **Why:** each feature has its own small piece of craft, and things like the 128 BPM tempo and the wood-grain metronome reward close inspection. Generated pages use a generic icon or a fake dashboard screenshot here.

### 17. Duotone + halftone photo treatment
- **Values:**
  - `.steps-photo::before{background:#8b5cf6; mix-blend-mode:color; opacity:.45}` recolours the photo into the brand hue.
  - `::after` adds a **dot screen**, `radial-gradient(#08080aa8 1px, transparent 1.4px)` at `background-size:5px 5px`, plus right and vertical fades.
  - The image is feathered on all four sides with two masks: `mask-image: linear-gradient(#0000,#000 14%,#000 86%,#0000), linear-gradient(90deg,#0000,#000 10%,#000 92%,#0000); mask-composite: intersect`.
  - The figure bleeds to the left viewport edge: `width: calc(100% + max(36px,(100vw - 1120px)/2)); margin-left: calc(-1 * max(...))`.
- **Why:** it turns a generic stock photo into an art-directed print. The halftone screen and colour wash are a print-shop vocabulary, and the full-bleed edge breaks the container grid on purpose.

### 18. Draggable outline-type ticker (marquee with momentum)
- **Values:** CSS `ticker-roll 30s` is the fallback; JS replaces it with `off += -0.55 + extra` px per frame and wraps at half of `scrollWidth`. Dragging writes `dx` directly; on release `extra = clamp(v, ±26)` and decays ×0.94 per frame. IO-gated. Type: `color:transparent; -webkit-text-stroke:1px #565060`, uppercase .14em, with orange `·` bullets glowing via `text-shadow:0 0 14px`.
- **Why:** outlined type stays quiet (a texture, not a shout). Being able to grab and fling the ticker is the DJ "scratch" gesture.

### 19. Track-timeline scroll progress + tab-title easter egg
- **Values:**
  - A fixed 3px bar at the bottom, `transform-origin:0 50%; transform:scaleX(p)`, gradient across all 12 key colours.
  - The readout `fmtTime(p*248) / 4:08` uses `font-variant-numeric: tabular-nums` at 10.5px, .08em.
  - On `visibilitychange`, the title becomes "▶ The mix is still going…".
- **Why:** reading the page is framed as listening to a 4:08 track. This is chrome that carries the metaphor, which almost no template does, and the tab title rewards people who switch tabs.

### 20. Pricing cards: groove texture, sheen sweep, colour lift
- **Values:**
  - Texture `::before`: `repeating-radial-gradient(circle at 50% 118%, #ffffff09 0 1px, transparent 1px 8px)`, concentric rings rising from below the card like vinyl grooves.
  - Sheen `::after`: `linear-gradient(115deg, transparent 42%, #ffffff12 50%, transparent 58%)`, `background-size:280% 100%`, moving from position `120% → -60%` over `.85s ease` on hover.
  - Hover: `translateY(-7px)`, border to `color-mix(var(--pc) 55%)`, and a coloured glow.
  - Each plan has its own `--pc` (lavender, violet, orange); the CTA fills with it.
- **Why:** the texture repeats the brand metaphor and the sheen is a one-pass reward, not a loop.

### 21. Native accordion with real height animation
- **Values:** `details::details-content{block-size:0; overflow:clip; transition: block-size .35s ease, content-visibility .35s allow-discrete}` with `[open]` at `block-size:auto`. This is enabled by `:root{interpolate-size:allow-keywords}`. The chevron rotates 180° in .25s. Hover nudges the summary `padding-left:8px` over .3s with the house ease. Separators are a **wavy hairline**: a tiled SVG `M0 1.5 Q22.5 0 45 1.5 T90 1.5` at 90×3, `stroke:#34333c`.
- **Why:** it is zero-JS and accessible. The wavy rule is a soundwave motif in the least expected place, and it looks hand-drawn rather than the default 1px border.

### 22. Footer watermark wordmark
- **Values:** `font-size: clamp(88px,16.5vw,232px); line-height:.8; letter-spacing:-.01em; background: linear-gradient(180deg,#2c2837,#0b0a0e 88%); background-clip:text; color:transparent`.
- **Why:** an oversized brand name fading into the ground is an editorial sign-off.

### 23. Section-hue-aware UI
- `::selection` uses `color-mix(in srgb, var(--cg) 48%, #241f33)`.
- The dialog backdrop uses `color-mix(in srgb, var(--cg) 7%, #08080a)` at .88 with `blur(4px)`.
- The cursor glow and ring use the same `--cg`.
- **Why:** the colour state follows you into micro-surfaces: highlight some text in the Genre section and it turns teal.

### 24. Dialog and success micro-moments
- **Values:** `dialog-in .32s cubic-bezier(.2,.8,.25,1)` from `translateY(16px) scale(.955)`; backdrop fades in over .4s. On success, 12 dots in the key colours (`angle = i/12·2π + rand·.4`, `radius 46–88px`) burst with `.75s cubic-bezier(.15,.6,.35,1)` to `scale(.35)`. The copy flips to "You're on the list." The submit button says "Signing up...", and there is a 15s AbortController timeout plus a mailto fallback.
- **Why:** the confetti is restrained (12 dots in brand colours, not a confetti library), and the error states are written.

### 25. Small craft details
- The logo rotates 360° on hover (.7s, house ease).
- Custom scrollbar: thumb `linear-gradient(180deg,#8b5cf6,#443466)` with an 8px radius and a 3px border in the track colour, plus `scrollbar-color:#6a4bc4 #0a0a0d`.
- Focus ring: `2px solid var(--lavender)` with a 5px offset.
- Skip link.
- `-webkit-tap-highlight-color: transparent`.
- Mobile sticky CTA uses `env(safe-area-inset-bottom)`.
- `pointer: coarse` removes all cursor effects.
- A thorough `prefers-reduced-motion` block kills all animation and transition, shows posters instead of videos, flattens the cube, removes SMIL `<animate>` elements, and drops the shimmer to solid lavender.

### 26. Performance architecture (worth copying wholesale)
- **One scroll pipeline:** a single passive `scroll`/`resize` listener queues **one** rAF that runs every registered task (squiggles, cube planes, hue sync, progress bar).
- **Every rAF loop stops itself:** cursor glide when movement is under 0.4px, squiggles when velocity is under .08, ticker and waveform when IO reports them off-screen.
- **Transforms and opacity only.** `will-change` is set on cube planes and cards (and turned off on mobile). `content-visibility:auto; contain-intrinsic-size:auto 900px` applies on mobile for section 3 onwards.
- **Media:** videos lazy-swap `data-src`, only the active one plays, and the hero image is preloaded as webp with `fetchpriority=high`.

---

## Shaders

**There is no GLSL, no WebGL and no WebGPU on this page.** No `uniform`, `varying`, `precision` or `gl_FragColor` strings exist, and no canvas requests a `webgl` context. Everything that looks "shader-like" comes from these, in plain words:

1. **Waveform band (Canvas 2D):** 17 sine ribbons, each the sum of two sine waves (frequencies 10.5 and 27 across the width) under a `sin(πu)^0.7` envelope that pinches both ends. Each is stroked twice (a wide faint halo and a thin core) with additive `lighter` compositing and a 12-colour horizontal gradient. Overlaps brighten toward white like light, and a Gaussian bump under the cursor amplifies the waves. Visually it is a **long-exposure light-painting of a sound wave in the key-colour spectrum**.
2. **Grain:** an SVG `feTurbulence` fractal-noise tile (baseFrequency .82, 3 octaves), static, at 5% in screen blend. This is **film grain** done the old-school way.
3. **Squiggle lights:** a 135px SVG stroke blurred with stdDeviation 50, giving **soft aurora or neon-tube light streaks** along an S-curve, drifting and skewing with scroll velocity.
4. **Key wheel:** 24 blurred ellipses (stdDeviation 7) arranged in two counter-rotating clocks, giving a **soft colour-petal mandala**.
5. **Vinyl sheen:** a rotating `conic-gradient` of alternating clear and 16%-alpha key colours in screen blend over a spinning photo, giving **iridescent interference shimmer**.

The lesson for us: the "premium, maybe-WebGL" feel here comes from **additive blending, blur, layered rotation at mismatched speeds, and grain**. All of it is CPU or compositor work in under 31 KB of JS.

---

## Text-to-visual ratio

| Section | Visible words | Dominant visual |
|---|---|---|
| Hero | 34 | full-height portrait, about 60% of the viewport |
| Pain points | 76 | text columns plus a light streak (the most text-heavy screen) |
| Waveform band | 0 | canvas |
| Colour system | 38 | 680px spinning vinyl, about 55% of the width |
| Filter deck | about 24 at a time (headline plus the active card's 20) | 1060×550 card stack with video and animated objects |
| Steps | 77 | 570px duotone photo, about 60% of the width |
| Ticker | 5 unique words | outline type |
| Plans | 108 | three cards |
| FAQ | 38 visible (331 more hidden in answers) | accordion |
| Footer | about 10 | 232px watermark |

- **About 400 visible words across about 9 full screens, or roughly 45 words per screen.** The heavy copy is pushed into the 3 places where people expect to read (pain points, plans, collapsed FAQ answers).
- Every "feature" section is at least 50% image or object, and **no paragraph runs past about 40 words** (`.section-copy{max-width:520px}`, `.pain p{max-width:34ch}`, card `p{max-width:42ch}`).
- Headlines do the selling and the body only confirms. Each H2 is 3–9 words on two lines with a turn: "The song is right there. / The next one isn't."
- There are **zero product screenshots or UI mockups.** The product is shown entirely through concept objects (wheel, vinyl, metronome, melody lines) and atmosphere.

---

## What makes it not look AI-generated

1. **The product's own logic is the design system.** Twelve musical keys map to twelve colours, and that exact 12-stop palette appears on the progress bar, waveform, key wheel, vinyl sheen, scrollbar and success burst. The palette is *derived*, not picked from a "vibrant gradient" preset. The colours are equal-lightness and moderately desaturated (OKLCH L .64–.80, C .09–.17), so the rainbow reads like ink on paper, not neon.
2. **Metaphor discipline across the chrome:**
   - The scroll bar is a track (0:00 / 4:08).
   - The load is a needle drop.
   - The ticker scratches.
   - Plan cards carry vinyl grooves.
   - The accordion rules are soundwaves.
   - The metronome runs at an exact 128 BPM.
   - The tab title says the mix is still playing.

   AI pages decorate; this page *commits to one idea* in places nobody asked it to.
3. **Hand-built objects instead of icon grids:** a CSS-and-clip-path metronome with wood gradients, SVG melody paths with SMIL riders, a blurred-ellipse mandala. There are no "feature cards with a Lucide icon in a rounded square" (the Lucide icons are used only at 16–19px as functional glyphs).
4. **Physics and mass:**
   - Lerped cursor light (0.13).
   - Velocity skew on the background.
   - Rubber-banded drag at 0.35.
   - Velocity-thresholded swipes (0.45 px/ms).
   - Fling momentum with 0.94 decay.
   - Magnetic pull at 22–30%.

   Things respond to input with inertia, not with instant CSS hover swaps.
5. **Analog texture stack:** grain, vignette, chromatic-aberration fringes, halftone dot screen, duotone wash, and a hero image that looks like a scanned magazine print. All of it pushes against the clean-vector, perfectly smooth AI surface.
6. **Typographic restraint:** two families; display at weight 500, not 800; tight 1.0–1.08 leading on headlines; balanced wrapping; variable-axis in-between weights (450, 550, 650). Headlines are short couplets with a turn of phrase, and pain points are written as **quoted questions in the user's own voice**.
7. **No section-template furniture:** no top nav, no "Trusted by" logo wall, no testimonials carousel, no stat counters, no bento grid, no glassmorphism, no centred gradient-blob hero. Only one CTA in the hero.
8. **Lit darkness:** the ground is violet-tinted near-black with 6–15%-alpha section lights and per-section cursor hue, never a flat colour fill.
9. **Rewards for attention:** tooltips on the deck dots, the logo spin, click ripples, the tab-title change, the colour-tinted text selection, the cursor that changes hue by chapter.
10. **Remaining tells, for honesty:**
    - Purple-on-black with `#8b5cf6` (Tailwind violet-500) as the main accent is *the* most common AI landing aesthetic.
    - DM Sans is a common default.
    - The 3-tier pricing plus FAQ block is standard.

    The page escapes those tells through items 1–6, not through its palette or layout skeleton.

---

## Ideas transferable to a premium wellness "subtraction" app (Distill)

Context checked against `distillV1/docs/DESIGN.md` (brand v4):
- Warm, dark, editorial, "a private file read by candlelight".
- Cormorant Garamond and Manrope, `--bg #100F0B`, ink `#F5EDD7`, a single brass accent `#B89552`.
- **Square corners, no shadows, verdicts and tiers never coloured, nothing red, and the identity never "moves for attention".**

So take SynesDJ's *systems* (metaphor discipline, physics, texture, performance) and leave its *surface* (rainbow, pills, glow, chromatic fringe, confetti).

1. **Derive the motif from the product's logic, as SynesDJ does with 12 keys → 12 colours.** Distill's equivalent is *the count going down*. Make subtraction the recurring visual: many become few, a total shrinks, a list gets shorter. Every decorative element should be a version of that.
2. **Chrome that carries the metaphor (track timeline → running ledger).**
   - Replace a generic scroll progress with a fixed bottom-right ledger in tabular Cormorant figures that **counts down** as you scroll, e.g. `14 things · $750/mo` → `4 things · $112/mo`. Same mechanics as SynesDJ: a `scaleX(p)` 2–3px brass line plus `font-variant-numeric: tabular-nums`.
   - Brass progress is already on DESIGN.md's allowed-accent list ("the scroll progress in the nav").
   - Tab-title easter egg in Distill's voice, along the lines of "Nothing added while you were away."
3. **Waveform band → "distillation band" (Canvas 2D, additive).** Reuse the 17-ribbon recipe but make the envelope converge: on the left, about 14 tangled strands (one per item in the sample stack); toward the right they merge into 3–4 calm parallel lines.
   - Example change: `y = mid + Σsin(...) * envelope * (1 - u)^k + laneOffset(ribbon) * u`.
   - Strokes in paper and brass at low alpha with `globalCompositeOperation='lighter'`, the halo-plus-core double pass, IO-gated, with the cursor Gaussian swell (`exp(-(u-x)^2/0.012)`, lerp .08).
   - It draws the product thesis with no words.
4. **Fanned deck → "your stack", with swipe-to-let-go.** SynesDJ's deck physics translate directly:
   - Spread `39px / 1.25° / scale -.025 / opacity -.065`, transition `.7s cubic-bezier(.16,.8,.22,1)`.
   - Commit at 16% width or 0.45 px/ms, rubber band 0.35.

   In Distill the cards are the user's products and the gesture is *removal*: a dismissed card leaves and the ledger ticks down. Re-skin to v4 with square corners, the `--surface` fill plus a `--rule-2` 1px border, no shadow, and the inner `inset 0 1px` highlight dropped. Keep the inner two-plane parallax (visual moves 1×, text −0.45×) at reduced amplitude (about 2° tilt, 6px) so it stays editorial. Never colour a card by verdict.
5. **Live mini-objects instead of icons** (SynesDJ's metronome and melody lines). For Distill, small hand-built CSS/SVG objects that *are* the data:
   - a receipt strip whose lines strike through one by one;
   - a 14-day calendar whose on-days fill in brass (on-days are on the allowed list);
   - a meter fill;
   - a fortnight timeline ("verdicts on a fortnight, not a morning").

   Animate them only when in view and pause them otherwise (`animation-play-state: paused` on inactive cards).
6. **Candlelight cursor (SynesDJ's cursor glow, warmed).** One radial light, about 480–560px, `radial-gradient(circle, rgb(184 149 82 / .10), transparent 62%)`, screen blend, lerp 0.13. This literally implements "a file read by candlelight". Skip the ring, trail and click ripples (too playful for v4). Disable on `pointer: coarse` and under reduced motion.
7. **Grain + vignette, the exact SynesDJ recipe.** `feTurbulence baseFrequency .82 numOctaves 3` as a fixed overlay at opacity .04–.05, plus `radial-gradient(transparent 60%, #00000055)`. On Distill's warm bronze ground, grain does even more work: it turns a gradient into paper.
8. **Lit, not filled, sections.** Per-section `::before` with two radial lights at 6–12% alpha. Use the existing `--glow-brass` and `--glow-warm` as `--light-a/b` values that vary by chapter, instead of alternating band fills.
9. **Letter-spacing settle reveal for Cormorant headlines.** Tracking from about `+.02em` to the v4 value `-.02em` over .9s with `cubic-bezier(.2,.7,.2,1)`, plus a 26px rise, per-word stagger of 80ms, and the payoff phrase last (SynesDJ: .05 / .13 / .21 / .29 / .42s). It suits a serif because it reads as typesetting, not motion for its own sake. This is reveal-once motion, consistent with "never moves for attention".
10. **Quieter section turn.** The 16° cube is too theatrical for v4. A "paper leaf" variant works: same dead-zone math (`edge = max(0,|n|-0.12)/0.88`) but `rotateX ≤ 5°`, `translateY ≤ 24px`, `opacity ≥ .85`, hinged at the top or bottom edge. Content stays flat while it is read and pages turn at the edges. Off at 700px and below.
11. **Duotone + halftone for any lifestyle photography.** Wellness stock photos are the biggest AI and template tell in the category. SynesDJ's treatment fixes that: `mix-blend-mode: color` wash in brass at about .35, a `radial-gradient(#100F0Ba8 1px, transparent 1.4px)` dot screen at 5px pitch, and four-side feathering with `mask-composite: intersect`. It turns any photo into a printed plate in Distill's palette.
12. **Pain points as quoted user questions.** SynesDJ's H3s are the reader's own inner questions in quotation marks, with one plain sentence under each. That fits Distill's "letter" and tone guide better than feature bullets. Headlines as two-line couplets with a turn.
13. **Footer watermark.** A giant "Distill" in Cormorant 500, about `clamp(88px,16.5vw,232px)`, line-height .8, gradient-clipped from about `#2a2519` to `--bg`. An editorial sign-off with zero motion.
14. **Native `<details>` with `interpolate-size` height animation** for the FAQ, straight hairlines (v4 is square and editorial, so skip the wavy rule), and summary hover `padding-left: 8px`.
15. **One hero CTA, fixed logo plus fixed small CTA, no nav bar.** That is SynesDJ's whole chrome, and it removes a lot of template feel.
16. **Copy the performance architecture verbatim:** one passive scroll listener with one rAF task queue; self-stopping rAF loops; IO-gated canvases and videos; transform and opacity only; `content-visibility:auto` on mobile; a full `prefers-reduced-motion` block that flattens every effect.
17. **Do not transfer:**
    - the rainbow or any multi-hue palette (v4 has one accent);
    - pill buttons and 16–18px radii (v4 is square);
    - drop shadows and glows (v4: no raised surfaces);
    - chromatic-aberration text;
    - confetti bursts;
    - the cursor trail and ripples;
    - the 128-BPM-style constant loops (ambient spinning objects count as "moving for attention");
    - and above all the borrowed celebrity-helmet hero image. Commission or generate original art.
