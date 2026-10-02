# Design and wording research behind landing page v3

Compiled 1 October 2026. This is the research the v3 landing page (`public/index.html`) was built from: three design skills written for AI coding tools, and a read of how large consumer companies design and word their pages.

## What was actually read

Be clear about the limits before using any of this.

- **Design skills (read from source):** Impeccable by Paul Bakaus (current `main`, plus the seven domain references at tag `skill-v3.0.4`), Emil Kowalski's skills repo (ten `SKILL.md` files, three reference files, nine essays), and ConardLi's `web-design-engineer` skill (v1.3.0, with eleven reference files).
- **Company sites: 132 read, not all 500.** 122 are Fortune 500 companies and their consumer brands (a few, such as Fidelity and Kaiser, are large but not on the list). 10 more are consumer wellness products that are not Fortune 500 (Oura, Function, Levels, Eight Sleep, Headspace, Ritual, Thorne, Superpower, Bevel, InsideTracker). They are labelled as comparables wherever they appear.
- **About 58 companies could not be read.** Their sites block automated readers or timed out (Home Depot, Lowe's, McDonald's, Tesla, Marriott, Oracle, Mastercard, Coinbase, UPS, AbbVie and others). Nothing below describes a site that was not read.
- **Text, not pixels.** The sites were read as page text, so section order, wording, button labels and form fields are reliable; anything about layout was inferred from markup. Four pages were also looked at as screenshots (Lingo by Abbott, Progressive, Function, TurboTax's refund calculator).
- **No headlines are quoted here.** Patterns are described in our own words.

## Part 1. What the three design skills say

### Impeccable (Paul Bakaus)

The useful part is its list of things that make a page look machine-made.

- No small label or pill badge sitting above a headline. No decorative section numbers.
- No grids of identical cards (icon, heading, text). No cards inside cards.
- No big-number-with-small-label "hero metrics" used as decoration.
- No gradient text, glow, or glass used as decoration. No emoji as icons.
- No pulsing dots, marquees, bounce easing, or the same fade-in on every section.
- The first screen should show the product doing its job, with one clear action.
- Body text at least 16px, lines 65 to 75 characters at most, headings balanced, tracking no tighter than -0.04em.
- Tight spacing inside a group, generous spacing between groups, more room above a heading than below.
- Colour owns whole regions. The button colour is never used as decoration.
- Text contrast 4.5 to 1, including placeholder text.
- One authored motion moment per page. Content must be visible if JavaScript fails. Reduced motion keeps fades and drops movement.
- Buttons say verb plus object. One label per action. At most five nav items.
- Works at 390px wide with 44px touch targets and no sideways scroll.

### Emil Kowalski (nine skills on animation and components)

His own page lists nine skills; the repo has since grown to thirteen. The rules that matter for a landing page:

- Ease-out for anything entering: `cubic-bezier(0.23, 1, 0.32, 1)`. Ease-in-out for things already on screen: `cubic-bezier(0.77, 0, 0.175, 1)`. Never ease-in.
- Interface motion under 300ms. Button press 100 to 160ms. Modals 200 to 500ms. Explanatory or marketing motion can run to about 600ms.
- Every animation needs a reason: feedback, showing where something came from, or explaining. "Looks cool" is not one.
- Buttons scale to 0.97 when pressed. Nothing appears from scale 0; start at 0.95 to 0.97 with opacity 0.
- Animate only transform, opacity and clip-path. Never write `transition: all`.
- Use transitions, not keyframes, for anything a person can trigger twice quickly.
- Stagger a group by 30 to 80ms. Soften a content swap with a 2px blur for 200ms.
- Hover effects only where there is a real pointer. Inputs at 16px so phones do not zoom.

### ConardLi `web-design-engineer`

- In a redesign, keep the things people and systems depend on: anchors, form fields, prices, legal text, real content.
- Never invent proof: no made-up statistics, logos, testimonials or badges.
- No more than two type families. Hero type four to six times body size. Call to action inside the first screen.
- Do not repeat the same label, heading, paragraph stack in every section. No three left-right splits in a row.
- One label for one action across the page.
- One signature motion moment. Everything else is quiet.

## Part 2. How big consumer companies do it

### Headlines

- Consumer hero headlines run **4 to 9 words**, most often about 5. Longer ones come from corporate and investor pages, which are the wrong model.
- Sentence case, usually with no hype words. Exclamation marks only appear on sale events.
- The recurring shapes:
  1. A short instruction naming the outcome (two or three words).
  2. Two short parallel sentences, each ending in a period.
  3. "See or know how X affects you", which leads with understanding and leaves improvement to the reader. Common in health.
  4. The product, then the objection removed.
  5. A plain description of the service in seven to nine words.
  6. The question the customer already has, used as the headline of a tool.
- The line under the headline does the explaining in one sentence: what it does, then what you get.

### Buttons

- Two to four words, verb first. The same label repeated down the page.
- A second, lower-commitment button sits beside it (see how it works, see pricing).
- A short reassurance line sits right under the button and names what will not happen: no card, cancel anytime, nothing to install.
- Tools use a button that names the result, not "Submit".

### Introducing a tool to an ordinary person

This matters most for "What would Distill do with it?". Insurers, banks, tax software and ride apps all do the same thing:

1. The headline is the customer's own question, never the name of the system.
2. One sentence says what you give and what you will see.
3. The cost of trying is stated at once: how long, and that it commits you to nothing.
4. The first ask is tiny and familiar: one field, with examples to tap.
5. The answer comes back in everyday words, in a small number of named outcomes.
6. One line explains how the answer was reached, and one button offers the next step.

### Health and wellness in particular

- Mass-market health pages say see, know, understand and guesswork. They avoid optimise, protocol, biomarker and stack unless the word is explained.
- Claims are hedged (helps, supports, can, up to) and tied to one number with its unit and time span.
- Limits are stated openly. The strongest comparables say in plain words when something is not a clinical trial or cannot be measured, and it reads as trustworthy.
- A wellness-only disclaimer and a talk-to-your-clinician line sit in the footer.
- Data ownership is promised in the first person on the closest comparables (your data is yours, never sold).
- Guarantees are time-boxed and named. Prices are shown, not hidden.

### Section order on the strongest pages

Hero with one reassurance line, a short proof strip, the problem in a line, how it works in three steps, what you get, evidence, pricing with the guarantee, questions, a final call to action, then the fine print.

### Voice

- Sentences of 5 to 12 words. Second person. Roughly a grade 6 to 9 reading level.
- Benefits are a verb plus a concrete noun, or a number.
- Capital letters for emphasis are rare and left to brands with decades of recognition.

### What big companies do that small pages miss

- They say what you get in under eight words.
- They show the price and what happens after the trial early.
- They end with blunt questions: what does it cost, how do I stop.
- They route people by need straight after the hero.

### What not to copy from them

Rotating hero carousels, 15-section pages, abstract brand slogans, "Learn more" buttons, promo banners above the hero, and walls of footnotes.

## Part 3. What changed in v3 because of this

| Finding | What the page does now |
|---|---|
| The call to action must be in the first screen | The pinned 175vh scroll hero is gone. Headline, both buttons and the reassurance line sit above the fold on a laptop and a phone. |
| Hero headlines run 4 to 9 words | New six-word headline in two parallel sentences. The founder's original sentence is kept, word for word, as the line directly under it. |
| Show the product doing its job | The hero object is the example stack itself: four items get struck through, two are kept, and the count and monthly cost tick down. It plays once and has a Replay button. |
| Tools are introduced in the customer's words | The widget keeps its question as the heading. "Router", "routing table" and "gate 0.8" are gone from what visitors read. The answer leads with a plain verdict, then the day-one sentence, then a simple meter. |
| State the cost of trying | "No sign-up, and it takes a few seconds" sits by the examples. |
| Progressive detail | Numbers, cost and the studies sit behind "The details and the research". Safety notes stay visible. |
| First answer should feel positive | The widget opens on coffee after 2pm (a testable habit) instead of magnesium (cannot be measured). |
| One label per action | Every sign-up button reads "Get my free stack audit". The offer keeps "Claim a founding spot". |
| No kicker labels, no identical card grids | Section labels above headings are removed. The four promises are a ruled list. The six-card "why it's different" grid is folded into other sections. |
| Blunt questions answered | A "What does it cost?" question now opens the FAQ, written from the existing offer. |
| Contrast and touch | Small text uses the darker muted colour (above 4.5 to 1). Inputs are 16px. Buttons and chips are at least 38 to 52px tall. |
| Motion rules | One easing token, press feedback on buttons, a soft blur on answer swaps, reveals only on product objects, reduced-motion path, and nothing hidden if JavaScript fails. |
| Keep what systems depend on | Form field names, the Supabase request, section anchors, prices, the guarantee text and the FAQ answers are unchanged. The routing engine is untouched; only how its answer is displayed changed. |

## Part 4. Things the research suggests that need a team decision

These were not added, because they are promises or facts only the team can make.

1. **A privacy line.** The closest comparables say plainly that your data is yours and is never sold. This needs a real policy behind it before it goes on the page.
2. **How to cancel.** Subscription pages answer this in the FAQ. The page has no cancellation terms to quote yet.
3. **Real proof.** Ratings, member counts and named reviews are still empty. The plan in `Distill-LP-Copy-v2.md` (three free beta users, reviews with name and photo) still stands.
4. **The word "stack".** It is explained once in the hero ("everything one person takes and does for sleep and recovery"). If testing shows people stumble on it, "routine" is the plain alternative.
5. **The headline.** If the founder's sentence must be the headline itself, swap the `<h1>` and the `.lede` paragraph in the hero. Nothing else depends on it.

## Part 5. Design elements added after v3, and why each one is there

The rule for this pass: every element has to explain something or give feedback. Anything that only decorates was left out (no marquees, no cursor trails, no tilting cards, no looping background motion). Each row says how to switch it off if the team finds it too much.

| Element | What it does for the visitor | Where it lives in `index.html` |
|---|---|---|
| Icon set (20 line icons, one stroke weight) | Marks the kind of thing in the widget (supplement, timing, device, membership) and the kind of answer (test, settled, can't see, left alone). Also used in the trust strip, step labels and promises. | The `<symbol id="i-...">` block at the top of `<body>`; `CATICON` and `VICON` in the widget script. |
| Skeleton placeholders | The 200 KB table now loads when the widget is close, not on page load. Placeholders hold the exact space of the chips and the answer card, so nothing jumps. On a fast connection they are rarely seen. | `.sk` styles; `SK_CARD`, `SK_CHIPS` and `load()` in the widget script. |
| Progress line and nav dot | Shows how far down the page you are and which section you are in. | `.nav .prog`, `onScroll()`, the `sio` observer. |
| The fortnight that plays on scroll | The 14-day calendar fills in day by day as it moves up the screen, and the "Today" card changes between on days and off days. It makes "three on, three off" visible. | `.cal.live`, `setDay()`, `calStep()`. |
| Swing chart on verdict cards | A shaded band (your normal swing) and a dot (the difference). It shows at a glance why one result is Kept and another is Inconclusive. The big number counts up once. | `.swing`, `.vnum`. |
| Words that come up to full ink | The "sells you more / sell you less" line lights up word by word as you read past it. Used once. | `.pivot .big.live`, `pivStep()`. |
| Hero entrance and the drop | Headline, text and buttons rise in once. The drop swells each time an item is struck off, and its highlight leans toward the pointer on a laptop. | `@keyframes rise`; `bump`, `ptx`, `pty` in the drop script. |
| 60-day timeline | Three tests, a verdict after each, and day 60 as the only day a charge can happen. | `.tl` in the offer section. |
| Easing FAQ | Answers ease open in browsers that support it; others open instantly. | The `@supports (interpolate-size...)` block. |
| Sign-up feedback | A spinner while the address is saving and a drawn tick on success. | `.btn.busy`, `.tick`. |
| Small touches | Teal text selection and caret, a soft wash behind the hero object, faint ripple rings behind the final form. | `::selection`, `.hero` background, `.final::before`. |

To remove any one of them, delete its styles and the matching few lines of script; none of them depends on another. Everything respects the "reduce motion" setting, and the page still reads correctly with JavaScript off.
