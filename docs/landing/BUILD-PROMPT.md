# Distill landing page: the build prompt

Paste this whole file into Claude Code (Opus, high effort) opened at the root of the `distill-site` folder. It takes an empty folder to a live page. Everything it needs is in this file or in a file it names. Where it says "you", it means the agent doing the build.

---

## 0. The job

Build the landing page for **Distill** from nothing. Nothing from earlier Distill sites carries over: no old copy, palette, fonts, components, or layouts. You may keep only the product facts in section 3, the data in `data/Routing-Table-V3.xlsx`, and the waitlist table in Supabase.

The page has to look like a studio made it: premium, animation-led, inventive, and nowhere near anything that reads as AI-generated. It carries **very little text and very little empty space**. The meaning travels in moving, working, tappable things, not paragraphs. The page sells one action: **join the Founding 100 waitlist.**

It ships to a **new GitHub repo** and a **new Vercel project** (section 15).

### The three tests the finished page must pass

1. **Five seconds.** A first-time visitor can say what it is (an app that tests your health habits on your own wearable data and tells you which ones to drop), why it matters to them (they pay for a pile of things they can't check), and what to do (join the waitlist).
2. **Memory.** An hour later they describe something specific, like "a page where a pile of 21 health things boiled down to the few that work while I scrolled, then I tried it on my own stuff." If what they would describe is a mood or a color, the page failed.
3. **Removal.** Delete any one animation. If nobody would miss it, it should not have been there. Delete the signature moments in 8.2 and the page should feel like a different, lesser product.

---

## 1. Quality bar

The bar is set by the sites torn down in section 7, led by **synesdj.vercel.app**. Study section 7 before designing anything, then open the top five sites yourself in the browser pane and scroll each one top to bottom at 1440 and 390 wide. You are looking for craft details to beat, not layouts to copy. Never lift a site's assets, fonts, copy, or exact composition. Take the idea under the effect and rebuild it from Distill's own mechanism.

What separates those sites from AI pages, and what this page must show:

- **The color system means something.** On synesdj every color is a musical key, so color is the product. On this page color must encode Distill's mechanism (section 9).
- **One authored focal sequence**, rehearsed until it feels inevitable, instead of the same fade-up on every section.
- **The product proves itself on the page.** Live, working miniatures of the real thing beat screenshots and beat claims.
- **Details nobody asked for.** The tab title changes when you leave. Selection color, caret, scrollbar and focus rings are themed. Numbers are tabular. Buttons answer a press.
- **Pacing.** Dense passages earn a quiet beat, and the page ends on a real close, not a footer dump.

---

## 2. Skills: load order, what to take, who wins

These skills are installed in this workspace. Load each one at the step named, take what is listed, and ignore what is listed.

| Step | Skill | Take | Ignore |
|---|---|---|---|
| Before anything | `impeccable` | Owns the process: `context`, `init` (PRODUCT.md), `new-work` (direction roll with `concept-seed`, decision page, direction contract), `craft-floor` before any UI edit, `detect`, the shipped finish reviewer and documenter. Surface mode is **Persuade**. | Nothing. Its process is the spine of this run. |
| Design read | `design-taste-frontend` | The one-line Design Read; dials **DESIGN_VARIANCE 8, MOTION_INTENSITY 9, VISUAL_DENSITY 6**; section 4.7 layout discipline; 4.9 copy self-audit; section 9 AI tells; the em-dash ban; one CTA label per intent. | Its picsum and placeholder-image advice. |
| Motion plan | `gpt-taste` | GSAP paradigms (pin, scrub, card stacking, scrubbed text), the 2 to 3 line H1 rule, gapless bento math (`grid-auto-flow: dense`, exact spans). | Its "Python randomization" (impeccable's concept-seed does that job), picsum images, React/Tailwind specifics, and "massive section spacing" (this brief wants density). |
| Component finish | `high-end-visual-design` | Nested bezel for the few real containers, button with a nested trailing icon, custom cubic-bezier curves, GPU-safe properties, blur only on fixed layers, grain on a fixed pseudo-element. | Eyebrow tags (banned here), `py-24` to `py-40` section padding (too airy), its font list where it clashes with impeccable's. |
| Every animation | `animate`, `emil-design-eng`, `apple-design` | Decide whether it should animate at all, then purpose, property, curve, duration, interruption, exit. Springs for anything dragged or thrown. Press feedback at `scale(0.97)`. Never animate in from `scale(0)`. Exit faster than enter. A real reduced-motion path. | Nothing. |
| Naming | `animation-vocabulary` | Name every effect precisely in the motion plan, so the plan can be reviewed. | |
| Phone pass | `mobile-native` | `100dvh`, no sticky hover on touch, no tap flash, safe areas, inputs at 16px or more, no pull-to-refresh fights, real-device thinking. | |
| Stress test | `break-ui` | Worst-case data through the stack demo and the form: 40 items, one item, $0 items, long names, a failed fetch, a duplicate email. | |
| After build | `review-animations` | One motion review pass over the finished page. | |
| Every string | `humanizer` | Run every visible string through it, then do the taste skill's copy self-audit. | |

**When skills disagree:** this prompt wins, then impeccable's craft floor, then design-taste-frontend, then the rest. Overrides that are already decided:

- Eyebrows and kicker labels above headings: **banned** (impeccable's ban beats high-end-visual-design).
- Section numbers like 01 / 02 / 03: banned unless the order itself is information (the 14-night calendar is; a features list is not).
- Section spacing: tight. See the density rules in 8.4.
- Fonts: impeccable's list of training-data defaults is binding. That rules out Inter, DM Sans, Space Grotesk, Plus Jakarta Sans, Outfit, Instrument Sans, Fraunces, Playfair, Cormorant and the rest of its list, plus Clash Display (synesdj's face; we do not copy it).

---

## 3. Product truth (the only facts you may state)

**What Distill is.** An app that finds out which of your health habits actually work on your body, using the data your wearable already collects, and tells you which ones you can stop doing and stop paying for.

**Why it exists.** Everything in wellness sells you something to add. People pile up supplements, devices, services and routines, end up doing twenty things for their health, and have no way to tell which of them do anything. The wearable made it worse: a number that moves every day and no idea which habit moved it. Research backs the instinct: across eight experiments in *Nature* (Adams et al., 2021), people asked to improve something rarely thought of taking anything away. Nobody's job is to subtract. Distill's is.

**How it works, step by step.**

1. **Your stack.** You list everything you do and buy for your health: supplements with doses, devices, services, memberships, routines, timings. A running count of items and dollars a month builds as you add.
2. **The number.** Before anything is tested, you see your stack counted and costed, often for the first time.
3. **Day one sort.** Every item lands in one of four places:
   - **Can come off today, no test needed:** dose below what studies used, a form the body doesn't absorb, tested properly and found nothing, no known way it could work, does the same job as something else, or you're paying and not using it.
   - **Worth testing on you:** your wearable can see it and it acts fast enough to test in two weeks.
   - **Can't measure it, your call:** shown with its cost and what the studies found. Never called a drop.
   - **Yours:** anything from a clinician, hormones, diagnosed conditions. Never rated, never touched.
4. **Baseline.** The first 7 days after you connect, the app only watches, to learn your normal.
5. **The experiment.** One habit at a time, 14 days, alternating blocks: 3 days on, 3 days off. Each morning one line tells you what to do today and one tap confirms it. A missed tap is "unknown", never "failed". You can veto a test.
6. **The verdict.** One card: the habit, the number chosen before the test started, the difference in real units against your own normal night-to-night swing, and one word: **kept, dropped, or inconclusive.** Inconclusive is a real answer, said plainly, with the number shown.
7. **Your file.** Verdicts collect into two lists: what you cut (the count and the monthly cost go down) and what's yours, the short proven set your body runs best on.

**Works with:** Oura, Apple Watch (through Apple Health), Garmin. **Not WHOOP yet** (WHOOP is closing its ecosystem to third-party apps).

**What it watches:** total sleep, time to fall asleep, deep and REM sleep, time awake, overnight HRV, resting heart rate, skin temperature. Wellness numbers only.

**The offer.** $20 a month, no lock-in. **Founding 100:** the first 100 members keep $20 a month for life. **Guarantee:** 60 days from your first experiment. If no experiment produces a measurable change (no kept or dropped verdict), you don't pay.

**Who it's not for (yet):** people with no wearable, people training for a specific event, and anyone whose question is driven by a medical condition.

**Status.** Pre-launch. Waitlist only. There are no users, reviews, press mentions, partner logos, or usage numbers. None may appear on the page.

---

## 4. Audience and scene

- **Who (confirmed by the user, both groups):**
  - **Wearable owners.** 30 to 55, high income, have worn an Oura ring, Apple Watch or Garmin for six months or more, spend real money on supplements and routines, and have started to suspect most of it does nothing. Short on certainty, not on motivation or information. Reachable in r/ouraring, r/Biohackers, r/QuantifiedSelf and under every "is Oura worth it after a year" video.
  - **Premium gym members.** Equinox-type members who spend on services as much as supplements: a second class membership, a recovery studio, massage credits, facials, a skincare routine, app subscriptions. The worked example stack is this person, which is why it mixes supplements, services and routines.
- **The scene:** late evening, phone in hand, in bed or on the couch, after a sleep score they can't explain. Or morning, a counter of bottles in kitchen light. Pick the one that best forces the light/dark decision for the world you are assigned, and write it as one sentence in the direction contract.
- **What they must feel:** relief. Someone finally took something away. Calm, on their side, never judged.

---

## 5. Claims

**Allowed as fact:** everything in section 3.

**Allowed only when labeled as an example** (a visible "Example" tag or caption, never hidden in small print):

- The worked example stack from the Routing Table: **21 things, $1,428 a month on arrival. 10 come off on day one, $767 a month back. 4 lined up for testing. 2 can't be measured, cost shown. 4 kept. The Oura ring is protected as the data source.** Item list is on the `Worked Example` sheet.
- Verdict sentences filled from the `Verdict Templates` sheet, for example: "Training after 7pm: your total sleep was 41 minutes shorter on the nights you trained late, outside your normal swing of 30. Dropped." / "Morning walk: your overnight HRV was 6 points higher on the days you walked, against your normal swing of 3. Kept." / "Melatonin: 3 minutes faster to fall asleep, inside your normal swing of 10. That's a real answer, not a failed one."
- Any night-by-night chart data you author for a demo.

**Forbidden:** testimonials, reviews, star ratings, user counts, "trusted by", press logos, partner claims, seats-left counters, invented percentages, "clinically proven", anything about diagnosing or treating a condition, and the stat "a third of tracker owners quit within six months" (its source is dead). Do not promise a verdict on day 14 for every test; say the test runs 14 days and the answer can be inconclusive.

---

## 6. Voice and words

These rules come from the Routing Table's Tone Guide. They are product rules, not style preferences.

- Describe the night, never the person. "Your HRV was 18 points lower after the drinks", never "your recovery is poor".
- The amount or the study is the problem, never the person.
- Money is a plain figure and a plain "back": "$22 a month back". Never "wasted".
- Every decision ends in their hands. No "should", "need to", "must".
- No exclamation marks, no "great news", no hype.
- **Never use:** wasted, useless, scam, fell for, hack, optimise/optimize, biohack, guilty, cheat day, toxins, detox, fix, cure, treat, prevent, boost, supercharge, should, need to, must, poor recovery, bad night, penalty, unlock, transform, journey, revolutionize, seamless, effortless, game-changer.
- **Do use:** your call, yours, back, kept, dropped, inconclusive, a real answer, we can't see it, what the studies found, your normal swing, your number.
- **No em dashes or en dashes anywhere**, including the page title and alt text. Use a period, comma, or colon.
- **No red, anywhere.** Not in errors, not in "dropped", not in charts. A drop is good news here.

**Text budget.** The page is not text-heavy, and that is measured:

- Hero: headline of 2 lines or fewer, one supporting line of 20 words or fewer, the action.
- Every other section: a headline of 8 words or fewer and at most one supporting line of 25 words or fewer. Labels inside demos don't count; sentences do.
- No paragraph anywhere longer than 2 lines at desktop.
- FAQ: at most 5 questions, answers of 35 words or fewer, collapsed by default.
- Total visible prose outside the demos and the FAQ: **under 320 words.** Count it before you ship, and cut until it fits.

Seed lines you may use or improve (all true, all from the founders' notes). Run your final versions through `humanizer`:

- "You're doing twenty things for your health. Find out which ones work."
- "Every app tells you to add something. This one takes things away."
- "Tested on your own data, one habit at a time."
- "3 days on, 3 days off. Your ring does the rest."
- "One tap a day. That's the whole job."
- "Kept, dropped, or inconclusive. All three are real answers."
- "The only scoreboard in wellness that goes down when you're winning."
- "60 days. If nothing measurably moves, you don't pay."

---

## 7. Reference teardown: what to steal, and how it becomes Distill

Two full teardowns sit in `docs/research/`: `synesdj.md` (source-level, exact values) and `references.md` (twelve sites). Read both. **Ignore every line in them that mentions "brand v4", Cormorant, Manrope, brass, `#100F0B`, `#F5EDD7`, or "night and paper grounds".** That was an earlier Distill identity, it is scrapped, and the researchers picked it up by accident.

### 7.1 synesdj.vercel.app: the lead reference

**What it actually is.** One hand-written `index.html` (88 KB: about 35 KB of inline CSS, 31 KB of inline JS) on Vercel. No framework, no GSAP, no WebGL, no Lottie, no audio. Every "expensive" effect is Canvas 2D, big SVG blurs, SVG grain, CSS transforms, and physics written by hand. The lesson: **the premium feel is design decisions and physics, not libraries.** We will use GSAP for the heavy choreography, but nothing here needs a library to look good.

**Why it doesn't look AI-made, in order of importance:**

1. **The product's logic is the design system.** Twelve musical keys map to twelve colors, and that exact palette is reused on the progress bar, the waveform, the key wheel, the vinyl sheen, the scrollbar and the success burst. The colors are muted and of equal lightness (OKLCH L 0.64 to 0.80, C 0.09 to 0.17), so the spectrum reads like print, not neon.
2. **The metaphor runs through the chrome.** The scroll progress is a track timeline ("0:00 / 4:08"), the load is a needle drop, the ticker can be dragged like a scratch, pricing cards carry vinyl grooves, FAQ dividers are tiny sound waves, a CSS metronome ticks at exactly 128 BPM, and the tab title becomes "The mix is still going…" when you leave.
3. **Hand-built objects instead of icon grids.** A clip-path metronome with wood gradients, SVG melody lines with dots riding them, a blurred-petal key wheel. Lucide icons appear only at 16 to 19 px as functional glyphs.
4. **Physics and mass.** Cursor light lerps at 0.13; background streaks skew with scroll velocity (clamped to 2.4°); the card deck rubber-bands at 0.35 and commits a swipe at 16% of its width or 0.45 px/ms; the ticker keeps sliding after a fling (decay 0.94 a frame); CTAs lean toward the cursor at 22 to 30%.
5. **Analog texture.** Fixed SVG `feTurbulence` grain at 5% (screen blend), a vignette, a 2 px chromatic fringe on headlines at about 15% alpha, a duotone wash and a halftone dot screen over the one stock photo.
6. **Lit darkness, not filled color.** Each section's `::before` holds two radial lights at 6 to 15% alpha in that section's hues, so every chapter has a temperature while the ground stays near-black.
7. **Typographic restraint.** Two families. Display at weight 500, not bold. Headlines are two short lines with a turn ("The song is right there. / The next one isn't.").
8. **Small rewards.** Hue-tinted text selection per section, a logo that spins on hover, a 12-dot burst in the key colors on signup success, a themed scrollbar, a skip link.

**Exact values worth borrowing (adapt, don't paste):**

- House ease `cubic-bezier(.2,.7,.2,1)`; reveals 0.7 s; per-word stagger of 80 ms with the payoff phrase last; press feedback `scale(.955)` in 80 ms; hovers 0.2 s.
- Section "turn": content tilts like a cube face only at the edges of the viewport (dead zone while centered): `edge = max(0, |n| - 0.12) / 0.88`, rotateX up to 16°, translateY up to 54 px, opacity down to 0.72. Off below 700 px and under reduced motion.
- Headline settle: `letter-spacing .035em → 0` over 0.9 s with a 26 px rise. The type seems to kern itself into place.
- The deck: spread `o*39px`, rotation `o*1.25°`, scale `1 - d*0.025`, opacity `1 - d*0.065`, transition `.7s cubic-bezier(.16,.8,.22,1)`; two parallax planes inside each card (visual 1x, text -0.45x).
- One scroll pipeline: a single passive scroll listener queues one `requestAnimationFrame` that runs every scroll-linked task; every loop stops itself when idle or off screen.
- A thorough reduced-motion block that flattens every effect and shows posters instead of video.

**How each idea becomes Distill (the translation that matters):**

| synesdj does | Distill does |
|---|---|
| 12 keys → 12 colors, used everywhere | 4 lanes and 3 verdicts → named colors, used everywhere: the tally, the scroll progress, the selection color, the success state. Before sorting, everything is uncolored. |
| Scroll bar as a track timeline | Scroll progress as the **tally counting down**: a fixed readout that starts at "21 things · $1,428" and falls as the page sorts. |
| Needle-drop entrance | The pile **settling** on load: tokens drop in and come to rest with weight. |
| Draggable feature deck with live mini-visuals | The **three-answers deck** (moment D), each card a live verdict with its own night chart. |
| Waveform band: 17 ribbons in additive light | A band of 21 strands that **converge into 4** across the width (many becoming few), drawn in Canvas 2D with the same halo-plus-core double pass, swelling under the cursor. Optional, and only if it doesn't compete with moments B and C. |
| Pain points as the reader's own quoted questions | Allowed for one beat, in the reader's voice ("Is any of this doing anything?"), but keep it to a single line. |
| Tab title "The mix is still going…" | Tab title while away, true and calm, for example "Still 21 things. Come back to sort them." |
| Giant faded wordmark in the footer | Allowed, in the chosen world's type. |

**Do not take:** the helmet photo (a likely IP problem), purple on black (`#8b5cf6` is Tailwind's default violet and the single most common AI landing look), DM Sans or Clash Display, the three-tier pricing grid, chromatic fringe if the world isn't photographic, or confetti.

### 7.2 Twelve more sites: the element worth taking from each

| Site | What it does best | Why it works | How it becomes Distill |
|---|---|---|---|
| **linear.app** | The hero is the whole product window rendered as live HTML, with fixture data and edges masked into the background. A 1 px shimmer travels around whatever is "working". | Proves the product with its own interface; every row can animate. | The pile and the lanes are live DOM tokens, never a screenshot. The one item under test gets a quiet traveling highlight. |
| **igloo.inc** (Awwwards SOTD/SOTM) | Procedurally grown refractive ice blocks; scene transitions as events. | The material itself is the brand. | If the world calls for a material moment, at most one OGL shader (frost, refraction, condensation) on one element. Text always stays in the DOM. |
| **oryzo.ai** (Lusion, SOTM Apr 2026) | A believable real-time scene carries a whole product page; four colors, one type family; every spec gets its own mini-scene. | Restraint plus one hero world; "most of the work was deciding what not to do". | One item gets the full spec-sheet treatment inside moment C: name, amount, cost, 14 nights, change against the normal swing, verdict, money back a year. |
| **raycast.com** | A paragraph where every sentence is a button that switches the demo beside it; a real keyboard as the section graphic with keys lighting in a wave. | Twelve features in one readable sentence, no card grid. | Moment E's chip list can be a sentence wall ("Magnesium at night. AG1. A second gym. Coffee after 2pm…"), each sentence a toggle. The 14-night strip lights in a wave like the keys. |
| **terminal-industries.com** (SOTD Sep 2025) | "What's your yard costing you?" live calculator with one huge rolling-digit total, then the email field. | The visitor argues the case in their own numbers, so the signup feels earned. | Moment E is this: "What's your stack costing you?" with an odometer total and the waitlist straight after. Digits roll on reels (stacked 0 to 9 columns), never fade. |
| **granola.ai** | The hero demo shrinks into a sticky panel on scroll (native `animation-timeline: scroll()`), then rewrites itself from rough notes to a clean summary. | One object carries the whole argument; the before/after happens in front of you. | The pile can shrink into a sticky stage that the sort happens on (moment A → B). Use CSS scroll timelines behind `@supports`, ScrollTrigger as the fallback. |
| **functionhealth.com** | A reeded-glass WebGL shader over hero photos; a marquee of condition names that reverses with scroll direction; a visible "Pause motion" toggle. | "1000s" becomes a felt quantity; the pause control is real accessibility. | A marquee of real stack items that **thins out** as the page goes on: items strike through and leave the rows until only a few drift slowly. Ship a visible motion toggle. |
| **superpower.com** | A pinned four-step stage where scroll sets a target step and the display advances at most one step every 600 ms; each step carries its own short FAQ. | A fast scroller still sees every beat; objections are answered at the moment they arise. | Use the paced queue for moment C's beats (on/off → nights fill → groups split → verdict) so nobody blows past the verdict. One reassurance line per beat ("Missed a night? It counts as unknown, never failed."). |
| **eightsleep.com** | Every feature card holds a small working app screen sized with a custom unit (`--card-u`); "a night on the Pod" told in five beats with a live status line. | Each card proves its sentence with the product's own numbers. | The live status line in moment C: "Night 1 · on" → "Night 4 · off" → "Night 9 · 6h 41m" → "Day 14 · Dropped". Any card on the page holds a working fragment, never an icon. |
| **ultrahuman.com** | An arc gauge that fills while a number counts up; 13 to 19 words per section, the lowest text density in the set. | A number you watch move is remembered; a number you read is not. | The scoreboard that goes **down**: rolling digits 21 → 11 things and $1,428 → $661, with a gauge that unwinds. Section copy at Ultrahuman's word counts. |
| **bevel.health** (Awwwards HM May 2026) | A shutter transition: six horizontal slats scale in with a reversed stagger (`each: .01`, `scrub: .3`) into the next scene; tab progress rings. | Cheap, crisp, very premium handoffs between scenes. | One shutter-style or wipe handoff into moment C, where the page changes from "your stack" to "one test". At most two event transitions on the whole page. (Bevel's coach-voice switcher is **not** allowed: Distill has no voice setting, and showing one would invent a feature.) |
| **getvitaminlab.com** (the "Vitamin Lab" the team liked) | A formula card that lists each ingredient with its dose and reason, like a label; a quiz that asks one question per screen. | Concrete, label-like, expensive-feeling; one decision per step. | Lane cards in moments B and E read like a label: item, amount, monthly cost, lane, the day-one sentence. The waitlist can ask one thing at a time (wearable chips, then email). |

### 7.3 The patterns to use, ranked

1. **The product is the hero, built in live DOM** (Linear, Granola, Eight Sleep). Real HTML tokens, lanes and charts with example data, never screenshots or phone mockups.
2. **One object transforms across the scroll** (Granola, Igloo, Oryzo). The pile is that object: it settles, sorts, shrinks to the few that work.
3. **The visitor's own numbers** (Terminal). Moment E.
4. **Numbers that move physically** (Ultrahuman, Terminal). Rolling digit reels for every tally; the count goes down.
5. **A pinned stage with paced beats** (Superpower, Eight Sleep). Moment C.
6. **Working fragments instead of feature cards** (Eight Sleep, Linear). No icon-and-heading cards anywhere.
7. **A sentence wall instead of a grid** (Raycast). For the chips in moment E, or for the reason tags in moment B.
8. **A kinetic list that means a quantity** (Function). The thinning marquee.
9. **One or two transitions treated as events** (Bevel, Igloo). Never more than two.
10. **Motion the visitor controls** (Function's pause toggle, synesdj's reduced-motion block).

### 7.4 What every one of these sites avoids (so this page avoids it too)

A centered headline over two buttons and a glowing blob. Three or six identical icon-and-title cards. Inter at one weight. Purple-to-blue gradients, neon glow, gradient text. Emoji or stock line icons as feature art. Frosted glass cards over blurred blobs. An eyebrow label above every section. The same fade-up on every element. Rounded cards with soft shadows everywhere. Zigzag 50/50 rows. Fake stat rows and fake logo walls. Paragraphs that explain a feature. An arrow icon on every button and five buttons per screen.

---

## 8. The page

### 8.1 Thesis

**The page performs subtraction.** It opens on a dense, slightly overwhelming pile, the example stack, and as you scroll, the page sorts it in front of you until only a few things are left and they are the ones that work. Everything else on the page is either that sorting up close (one experiment, one verdict) or that sorting handed to you (your own stack). The category ships a calm photo of a person sleeping above three feature cards. This page refuses that.

### 8.2 Signature moments (pinned by this brief)

The direction roll in section 13 decides how these look: material, palette, type, texture. It does not decide whether they exist. Each one is built with the real technique, not a static picture of it.

**A. The pile (first viewport).** The example stack's 21 items fill the hero as physical, tactile tokens, packed close like a cluttered shelf or drawer: "Equinox", "AG1", "Magnesium 120 mg", "Collagen gummies", "Coffee at 4pm", "Drinks, 3 nights a week", "Eye cream", "Training after 7pm" and the rest of the `Worked Example` sheet. A live tally reads **21 things · $1,428 a month**. On load the tokens arrive and settle with weight (a short physics drop or a staggered spring settle, under 1.2 s, skippable, never blocking the headline). The pile reacts to the pointer: tokens lean or part away from the cursor. The headline, one line of support, and the waitlist action (a working email field plus button, not a link) sit in the same viewport. Label the pile "Example stack".

**B. The distillation (pinned, scroll-scrubbed).** Scrolling on, the stage pins and the pile sorts itself. Use GSAP Flip so each token travels from the pile to its lane:
- 10 tokens leave first, each tagged with its one-line reason ("dose too low", "not being used", "does the same job as Equinox"), and they exit the frame or fade to an outline. The tally counts down with every exit: **21 → 11 things, $1,428 → $661 a month, $767 back.**
- 4 tokens move into "Testing on you", 2 into "Your call", 4 into "Keep", and the Oura ring into "Yours".
- Color arrives only as items are sorted (see section 9). The pile is undifferentiated; the answer has color.
- The scrub is reversible: scrolling back un-sorts the pile. At 390 wide the lanes stack vertically and the sequence still reads.

**C. Fourteen nights (pinned, scroll-scrubbed).** One experiment up close: "Coffee after 2pm" (Example). A 14-night strip lays out the on/off blocks (3 on, 3 off, repeat), nights fill in one by one with total-sleep bars, then the on-nights and off-nights pull apart into two groups, a band shows "your normal swing", the gap between the groups measures itself against the band, and a verdict card lands: **Dropped.** with the real-unit sentence. Include one control the visitor can touch (for example, drag the effect size smaller and watch the verdict honestly turn to **Inconclusive** when the gap falls inside the band). This is the moment that makes the product believable, so it gets the most motion craft on the page.

**D. Three answers (draggable deck).** Kept, Dropped and Inconclusive as a short stack of verdict cards the visitor can drag, flick or click through, with spring physics, momentum, and a snap back. Each card carries one example sentence from the Verdict Templates sheet in real units. Keyboard: arrow keys move through it. One line above it at most.

**E. Your stack, distilled (the working demo).** The visitor builds their own pile and the page sorts it with the real router data:
- Tap chips of the most common items (about 24, across supplements, devices, services, routines) and a typeahead over all 210 items in `stack.json`.
- Every add drops a token into a small pile and bumps a live tally of things and dollars a month (dollar figures are the table's typical costs; say "typical cost").
- A "Distill it" control runs the same Flip sort as moment B into the four lanes, each item showing its real day-one sentence from the table (the `t` field). It is a first pass: say plainly that the app asks a few follow-up questions (dose, timing, still using it) that can move an item.
- It ends on the action: the waitlist form, with their count carried over ("Save my 9 things" or similar, one label per intent).
- Empty, one-item, many-item and failed-fetch states are designed, not defaults.

**F. The close.** The waitlist form comes back as the last real moment, with the offer in a sentence (Founding 100, $20 a month for life, 60-day guarantee). On success the button resolves into a confirmed state with a short drawn check; the copy says they're on the list. On a duplicate email it says they're already on the list, kindly. Never a red error.

### 8.3 Section architecture

In this order. Each row is one viewport-scale beat. Merge or split beats if the direction demands it, but keep the order of ideas and keep every beat's visual.

| # | Beat | Job | Visual or interaction | Words |
|---|---|---|---|---|
| 1 | Hero: the pile | Say what it is, show the pile, offer the action | Moment A + email field and button | H1 ≤ 2 lines, support ≤ 20 words |
| 2 | Day one | Show the sort | Moment B (pinned) | ≤ 8-word headline, lane names, reason tags |
| 3 | One experiment | Show how a verdict is earned | Moment C (pinned) | ≤ 8-word headline, ≤ 25-word line |
| 4 | Three answers | Show that every outcome is honest | Moment D | ≤ 8-word headline |
| 5 | Works with | Remove the "will it work with my ring" doubt, and the baseline week | Real device marks (Simple Icons or official SVGs) for Oura, Apple Health, Garmin, plus a "WHOOP soon" state; a 7-day "just watching" strip | ≤ 25 words |
| 6 | Try your stack | Hand them the mechanism | Moment E | ≤ 8-word headline |
| 7 | The deal | Price, Founding 100, guarantee, who it isn't for | A visual 60-day track: baseline week, three 14-day tests, "you only pay if one lands". Not a pricing table | ≤ 40 words total |
| 8 | Questions | Remove the last doubts | ≤ 5 collapsed items, smooth height animation | answers ≤ 35 words |
| 9 | Close | The action again, offer in a sentence | Moment F, a large confident final composition | ≤ 25 words |
| 10 | Footer | Wordmark, one line of legal ("Wellness, not medical advice."), contact email | Something small and alive in the wordmark | minimal |

The nav: a wordmark, at most three anchors, and the one action. It hides on scroll down and returns on scroll up, never covers a pinned stage, and shows scroll progress in a way that belongs to the world.

### 8.4 Density rules (little text, little empty space)

- Every viewport-height of scroll contains at least one visual that moves, works, or responds. No section is text alone.
- No empty band taller than **96 px at desktop or 56 px on phones** between beats. Beats hand off into each other (a pinned stage releasing into the next one, a mask or clip-path wipe, an overlap) instead of being separated by padding.
- Hero content starts within 120 px of the top of the viewport at 1440 by 900, and the action is visible without scrolling at 1280 by 720 and at 390 by 844.
- Grids have exactly as many cells as content. No dead cells, no filler tiles.
- No layout family appears twice. No three image-and-text splits in a row.
- Fill space with the product (tokens, nights, verdicts, devices, the timeline), never with decoration, gradient blobs, or stock imagery.

### 8.5 Small delights to include (each one earns its place)

- The tab title changes while the visitor is away (in the spirit of synesdj's "The mix is still going…"), then restores on return. Keep it calm, true, and free of dashes.
- Text selection, the caret, the scrollbar and focus rings are themed from the palette.
- All figures use tabular numerals, and counters roll digit by digit rather than jumping.
- One hidden reward that reveals real utility, for example pressing `D` anywhere replays the distillation.
- A favicon and an Open Graph image drawn in the page's own world (a 1200 by 630 PNG, made with the page itself, not generated art).

---

## 9. Visual world (decided by the direction roll, inside these fences)

Run impeccable's `new-work` flow. Its `concept-seed` roll picks the world: palette, materials, type, texture, component language. The fences below are brief-pinned; the roll fills everything else.

- **Color carries the mechanism.** Before sorting, the pile is undifferentiated. Each of the four lanes (can come off, testing on you, your call, yours) and each verdict (kept, dropped, inconclusive) has a named color role, and color appears as items are sorted. Someone who scrolls with the sound off and the words blurred should still see clarity arriving.
- **No red, no red-orange, no alarm colors** anywhere.
- **Light or dark is decided by the scene sentence** in the direction contract, not by category.
- **Refuse the AI-default looks** unless the roll lands on one for a stated reason: cream or warm paper with a serif display and a terracotta or brass accent; near-black with one neon accent and glowing edges; violet-to-blue gradients; glassmorphism as decoration; editorial hairlines with tracked mono labels; three equal feature cards; a centered headline over a gradient mesh.
- **Type:** faces with a point of view, self-hosted as WOFF2 under `public/assets/fonts/` (Fontshare's free faces and Google Fonts are both fine sources; check the license allows web use). At most two families. Display size max 6 rem, tracking no tighter than -0.04 em, tabular numerals for every figure.
- **Icons:** one drawn set in one stroke weight, or authored SVG. No emoji, no Unicode glyphs as icons.
- **Imagery:** the page's visuals are the product (tokens, nights, verdicts, devices), drawn in code. If the world needs photography, use at most two decisive real photos of the subject's physical objects, art-directed into the palette, with their source and license recorded in `public/assets/img/CREDITS.md`. No stock people, no generated people.

---

## 10. Motion system

Write a motion plan before code (named effects, per `animation-vocabulary`) with: the focal sequence, each supporting motion and its job, the easing tokens, durations, and the budget. Then build it.

- **Focal sequence:** moments A, B and C. They share one material behavior (how a token moves, settles, and leaves) so the page feels like one physical system.
- **Smooth scroll:** Lenis, synced to GSAP's ticker. Respect native scroll on touch devices if Lenis fights them.
- **Pinned stages:** GSAP ScrollTrigger with `scrub` between 0.6 and 1, `anticipatePin`, `invalidateOnRefresh`. Recalculate on resize and font load.
- **Layout changes:** GSAP Flip for everything that moves between groups (B, E).
- **Text:** SplitText for at most two headline entrances, masked by line. Not on every heading.
- **Drag:** springs with momentum for the verdict deck (D) and the pile's pointer response (A).
- **Easing tokens:** an exponential ease-out for arrivals (for example `cubic-bezier(0.16, 1, 0.3, 1)`), a quicker ease-in for exits, springs for physical things. No `linear` except for scrubbed scroll, no default `ease-in-out`, no bounce or elastic by reflex.
- **Durations:** feedback 100 to 150 ms, state changes 150 to 300 ms, overlays 300 to 500 ms, the authored entrance 500 to 800 ms. Exits faster than entrances.
- **Content is visible by default.** If JavaScript fails, every word and the form still work. Animations start from an already visible state or are added by a class set by script.
- **Reduced motion:** with `prefers-reduced-motion: reduce`, pins become static before/after states, the pile is already settled, counters show final values, and the sort is a crossfade. Feedback on taps stays.
- **Performance:** 60 fps on a mid-range laptop and phone. Animate transform, opacity, clip-path and filter only. Pause any loop or canvas that is off screen or in a hidden tab. Lazy-init WebGL or canvas when near the viewport. `will-change` only while animating.

---

## 11. Tech

- **Static site, no build step.** `public/index.html`, `public/assets/css/*.css`, `public/assets/js/*.js` as native ES modules. Hand-written CSS with custom properties for every token. No Tailwind, no framework, no CSS library.
- **Libraries, vendored** into `public/vendor/` at pinned versions (fetch with npm into a scratch folder, copy the minified files): GSAP with ScrollTrigger, Flip and SplitText (GSAP and all its plugins are free); Lenis; and only if the world needs it, OGL for one WebGL element. Nothing loaded from a CDN at runtime except nothing. Record versions in `public/vendor/VERSIONS.md`.
- **Fonts** self-hosted with `font-display: swap`, the display face preloaded.
- **Data:** `scripts/build_data.py` turns `data/Routing-Table-V3.xlsx` into `public/assets/data/stack.json` (already written; rerun it if the sheet changes). The demo fetches it lazily when section 6 nears the viewport. Do not edit the JSON by hand.
- **Waitlist:** POST to the existing Supabase table `signups` (insert-only RLS) at `https://hzwiikkttligpmkvondy.supabase.co/rest/v1/signups` with the publishable key `sb_publishable_LnnDGCp21cdBGXzoBx-yZQ_MDoWAubE` in the `apikey` header and `Prefer: return=minimal`. Columns: `email` (required), `wearable` (one of `Oura`, `WHOOP`, `Apple Watch`, `Garmin`, `Fitbit`, `Other`, or null), `source` (40 characters max; use `site-hero`, `site-demo`, `site-close`), `user_agent`. A 409 means the email is already on the list: treat it as success with its own message. Keep the config in one place at the top of the main script. Never put any other key or secret in the repo.
- **SEO and being found** (from the founders' notes): a real `<title>` and description, Open Graph and Twitter tags, `robots.txt`, `sitemap.xml`, `llms.txt` that explains Distill in plain sentences, semantic headings in order, alt text on every meaningful image, fast first paint (no render-blocking scripts, critical CSS inline if needed).
- **Deploy config:** `vercel.json` with `"framework": null`, `"outputDirectory": "public"`, `"cleanUrls": true`, and long cache headers on `/vendor/` and `/assets/fonts/`.
- **Accessibility:** WCAG AA contrast on every text and control, visible focus, every interaction reachable by keyboard (the deck, the chips, the typeahead, the FAQ), live regions for the tally and form results, `aria-hidden` on purely decorative motion layers, nothing that flashes.

---

## 12. Files

```
distill-site/
  PRODUCT.md            impeccable init writes this
  DESIGN.md             the documenter writes this at the end
  .impeccable/          impeccable's working files (direction brief, review captures)
  data/Routing-Table-V3.xlsx
  scripts/build_data.py
  docs/BUILD-PROMPT.md  this file
  public/
    index.html
    assets/css/  assets/js/  assets/fonts/  assets/img/  assets/data/stack.json
    vendor/      robots.txt  sitemap.xml  llms.txt  og.png  favicon.svg
  vercel.json
  README.md             how to run it locally, how to rebuild the data, how deploys work
```

---

## 13. Process and checkpoints

Run these in order. Stop only where it says to ask.

1. **Context.** Run `.claude/skills/impeccable/scripts/impeccable context` from this folder (the skill lives in the parent workspace at `/Users/ishanv/Desktop/Claude/.claude/skills/impeccable`). Follow its directives.
2. **Init (PRODUCT.md).** Sections 3 to 6 of this prompt answer impeccable's init interview. Write PRODUCT.md from them. Ask the user one compact confirmation round with the structured question tool (what to confirm: the audience in section 4, the waitlist as the single action, the static-site stack). If they don't answer, proceed on this prompt and say so.
3. **Design read.** Write the one-line Design Read from `design-taste-frontend` and set the dials.
4. **Direction round.** Follow impeccable `new-work` for a new world: name the mechanism, the scene, the category rut; list seven concrete systems from the audience's world across at least three material families; run `concept-seed --scope direction --mode persuade`; fuse and judge the challengers; serve the decision page and open it in the browser pane for the user. Section 8.2's signature moments and section 9's fences are brief-pinned, so the roll decides their world, not their existence. Wait for the user's pick. If the page closes unanswered, re-ask once through the structured question tool, then proceed with the assigned direction.
5. **Direction contract.** Write THESIS, OWN-WORLD, STORY, FIRST VIEWPORT, FORM and FINISH into the surface brief with `impeccable surface-brief write`. Read it back.
6. **Motion plan.** Section 10's plan, written down with named effects, before any code.
7. **Build.** Read impeccable's `craft-floor.md` first. Build the whole page fully committed: hero and moment A first, then B and C, then everything else, then motion, then mobile. No placeholder sections, no TODOs, no lorem.
8. **Inspect, bounded.** One batched round of captures at 1440 by 900 and 390 by 844 (plus 1280 by 720) with entrance motion settled. Check the three tests from section 0, the text budget, the density rules, contrast, focus, reduced motion, console errors, and network failures. Fix everything in one batch. One confirmation round. Stop polishing.
9. **Stress.** `break-ui` on the demo and form. `review-animations` on the motion. Fix what they find in one batch.
10. **Detect and review.** Run `impeccable detect --json` on `public/`. Then spawn the `impeccable-finish-reviewer` fresh with the packet impeccable's new-work section 7 describes, and act on its disposition (ship, fix, rebuild, recapture), within its two-round budget.
11. **Document.** Spawn `impeccable-documenter` to write DESIGN.md and `.impeccable/design.json` from the built page.
12. **Ship.** Section 15.

---

## 14. Verification checklist (all must be true before shipping)

- [ ] The three tests in section 0 pass, judged from captures, not memory.
- [ ] Prose outside demos and FAQ is under 320 words; no paragraph over 2 lines at desktop.
- [ ] No empty band over 96 px desktop / 56 px phone; every viewport has a working visual.
- [ ] Every number shown is either a section 3 fact or labeled "Example".
- [ ] No testimonial, user count, logo wall, press mention, or seats-left counter.
- [ ] No red. No em or en dashes. None of the banned words in section 6.
- [ ] Moments A to F all exist and work at 1440 and 390, with mouse, touch and keyboard.
- [ ] The demo sorts with real `stack.json` data and handles empty, one, many, and failed-fetch states.
- [ ] A real signup reaches Supabase from the deployed page (use an address the user gives you or ask them to try one); a duplicate shows the "already on the list" state.
- [ ] Reduced motion shows complete, readable before/after states.
- [ ] No console errors; no failed requests; no horizontal scroll at any width from 360 to 1920.
- [ ] Lighthouse-style budget: first contentful paint under 1.5 s on a fast connection, total JS under 250 KB gzipped excluding fonts, no layout shift from fonts or late content.
- [ ] Theme details done: selection, caret, scrollbar, focus, tabular numerals, tab-title change, favicon, OG image.
- [ ] impeccable detector run, finish reviewer verdict recorded, DESIGN.md written.

---

## 15. Ship (new repo, new Vercel project)

1. Commit in `distill-site` with the repo-local identity `distillAI-maker <disttilai@gmail.com>` (Vercel Hobby only deploys commits authored by the account owner).
2. Create a new **private** GitHub repo `distill-site` under the `distillAI-maker` account. The user signs in to GitHub in the browser pane themselves; you never type a password or token. Push `main`.
3. In Vercel (team `distill-dd01`, signed in as the GitHub owner), import `distill-site`: framework "Other", no build command, output directory `public`. Deploy.
4. Open the production URL, run the section 14 checks against it, and do one real signup.
5. The old landing project (`distill-v1`, serving distill-v1-tau.vercel.app from the distillV1 repo) is scrapped only on the user's explicit yes at that moment, because deleting a Vercel project can't be undone. Offer the choice: delete it, or leave it up until the new URL is shared. Never touch the distillV1 repo or the `distill-app` project.

---

## 16. Report back

Finish with a short report: the live URL, the chosen direction in one line, the six signature moments and where each lives, anything the finish reviewer left open, what real material would make it better (real verdicts from beta users, real photos, a custom domain), and how to change copy or rebuild the data.

---

## Revision 2 (2026-10-09): what changed after the first live review

The user reviewed two builds (a steel locker wall, then a lacquer cabinet wall) and asked for a clean restart of the visual layer. These rules now override sections 8.2 to 9 where they conflict:

- **Too much was going on.** Study the competitors' first screens and signup before designing (Function Health, Superpower, Bevel, Oura, Eight Sleep, WHOOP). They all lead with a 2 to 6 word headline, at most one short line, one action, and one focal object that shows the product. Superpower's signup is one email field, then Continue, beside a short summary of what you get. Function puts three glanceable facts under the hero.
- **No subtitles.** No description line under a heading. Use step titles, short dot-separated data lines, and the product itself to carry meaning.
- **Palette:** white ground, black type, gold only for what works or is worth keeping (keep, the money back, a test in progress). No cream, no gradient text.
- **Type:** Switzer (Fontshare), self-hosted, one family, light weights at large sizes.
- **The display device is the product:** one phone, rendered in HTML, that tells the whole story as you scroll: your stack (21 things, $1,428), day one (rows strike and collapse, $767 back, what is left tagged Testing / Keep / Your call / Yours), one habit for 14 nights (3 on, 3 off, one tap), the verdict (Dropped, 74 more minutes of sleep without it). On phones the four steps become tabs and the phone plays through them.
- **Signup:** email first, then one tap for the wearable (or skip). Same Supabase table.
- **Page, in order:** hero (headline, email, three facts) with the phone; four steps; "What's in your stack?" (chips, live day-one result from the Routing Table); $20 a month with the member card; five questions; Join the Founding 100.

## Revision 3 (2026-10-09): plain words and more movement

The user liked Revision 2 and asked for three things: crisper, leaner, more premium motion with a lot of movement; titles and descriptions that read less like AI; and steps that explain themselves from a buyer's point of view, because "stack" was abstract.

- **Copy.** "Stack" is gone from the page. People think of it as their list of what they take and do. H1 asks a question in the buyer's own words, "Is your greens powder worth it?", and the noun rotates through items from the worked example (2pm coffee, nightcap, eye cream, monthly facial, collagen) while the phone highlights the matching row. One plain sentence under it says what Distill does. Each step now has a short title plus one or two sentences a non-expert can follow (what goes on the list, why some things come off on day one, how the 14 nights work, how a keep or drop is decided). Written against the humanizer and copywriting skills: no contrast reveals, no fragment rows, no dashes.
- **Skills and packages.** Installed GreenSock's official gsap-skills (core, timeline, scrolltrigger, plugins, performance, utils) and coreyhaines31/marketingskills copywriting into the project. Vendored GSAP's CustomEase (same 3.15.0 release) for one pair of curves across the page. No new libraries beyond that.
- **Motion system.** GSAP owns every moving transform (GSAP blanks CSS `scale`/`translate` on elements it touches, so presses use `!important` on `scale` only where GSAP isn't driving). Pointer tilts use `quickTo` on direct transforms instead of CSS variables on parents. The phone sits in a rig that turns slowly with the story scroll; screens change with a short blur and lift; each step's title lifts in word by word; a rail beside the steps fills with a leading edge level with the current step; a band of everyday items drifts and speeds up with scroll; the try panel grows into place; the member card tips up into view and floats; the price rolls to $20; primary buttons lean toward the pointer. Phones get story-style progress bars, step text under the phone, and swipe.
- **Checks.** Headless captures at 360 to 1440 with and without motion: no console errors, no horizontal overflow, 0 frames over 33 ms while scrolling the story at 1440.
