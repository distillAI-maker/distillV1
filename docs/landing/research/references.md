# Distill landing page: reference teardown

Research date: 2026-10-09. Twelve live sites, chosen for web craft first and for how well they fit Distill second. synesdj.vercel.app is covered by another agent and is not included here.

## How this was done (and limits)

- Every homepage was fetched with curl. Where it helped, the JS and CSS bundles were downloaded too and searched for library signatures (GSAP plugins, Lenis, three/OGL/GLSL, Rive, Lottie, motion, CSS `animation-timeline`, `@property`, `mask-image`, View Transitions). Fonts and palettes come from `@font-face` and CSS custom properties. Section structure and word counts come from the server-rendered HTML.
- Raw HTML and bundles are in `research/refs/html/` and `research/refs/bundles/<site>/`. Evidence lines are in `research/refs/notes.txt`. The analysis scripts are in `research/scripts/`. Fetched code was searched as text and never run.
- Public write-ups used: the Abeto case study for Igloo on Awwwards (2024-10-31), Lusion's Oryzo behind-the-scenes posts parts 1–3 (blog.lusion.co, March–April 2026), and the Awwwards award pages and credits for Igloo, Oryzo, Terminal Industries, Bevel and Function Health.
- **What the fetches can't show:** they read code, not the rendered page. Every claim about how something moves comes from the CSS and JS that drives it. Exact timing, feel and art direction should still be checked in a browser. The main agent owns the browser.
- **Blocked:** nekohealth.com (Vercel bot checkpoint, 429), whoop.com and withings.com (403) blocked both curl and WebFetch, so they were dropped. They are worth a quick look in the browser.
- **Swaps against the suggested list:** arc.net is now a holding page that points to Dia. family.co is still live and lovely, but its design dates from 2022–23 and the blog stopped in May 2025, so it moved to "also checked". Lusion's own studio site was swapped for **Oryzo AI**, Lusion's 2026 product-launch piece and Awwwards Site of the Month for April 2026. ouraring.com has premium typography but little motion and is commerce-led, so **Ultrahuman** replaced it. Two recent award winners were added: **Terminal Industries** (Awwwards SOTD, Sep 2025) and **Granola**.

### Which site is "Vitamin Lab"?

The only live product with that name is **VitaminLab, getvitaminlab.com**: personalized supplements from Victoria, BC. Forbes Health ranked it the #1 personalized vitamin subscription for 2026. Three things make it the likely match:
- The product is literally a "stack". The builder URL is `/create-stack`.
- It has a conversational one-question-per-screen quiz.
- Its formula cards list every ingredient with a dose.

Other domains were checked and ruled out:
- vitaminlab.com is parked.
- vitaminlab.co and vitamin-lab.com are redirect landers.
- vitaminlabs.com is for sale.
- vitaminlabs.co is a B2B marketing agency.
- vitalab.com is a fertility clinic.
- vitalabs.com is a private-label manufacturer.

Searches on Awwwards, Godly, the Framer marketplace and Dribbble found no "Vitamin Lab" entry. The site is technically modest (WordPress, Bootstrap, jQuery). So the team was probably praising its **product UI and clarity**, not its motion. If they meant a different site, they should send the URL. The teardown below says what is actually worth taking from it.

---

## At a glance

| # | Site | Type | Stack (verified in source) | Recognition | Single best element |
|---|------|------|----------------------------|-------------|---------------------|
| 1 | linear.app | Product/SaaS | Next.js, StyleX, motion | Long-time craft benchmark | Full product window rendered as live DOM as the hero |
| 2 | igloo.inc | Startup (web3) | Vite, Svelte, three.js, GSAP, KTX2/Draco, MSDF, OGG audio | Awwwards SOTD + SOTM Jul 2024 | Procedurally grown, refractive ice blocks you scroll through |
| 3 | oryzo.ai | Product launch (Lusion) | Astro, three.js, Gaussian splats, GSAP SplitText, Rive | Awwwards SOTD + SOTM Apr 2026 | Photoreal real-time desk scene that carries a whole product page |
| 4 | raycast.com | Product/SaaS | Next.js, CSS Modules | Long-time craft benchmark | Clickable "sentence wall" that switches a live demo |
| 5 | terminal-industries.com | Startup (B2B) | Nuxt, Storyblok, GSAP (SplitText, DrawSVG), Lenis, Rive | Awwwards SOTD Sep 2025 (Rejouice + Propagande) | "What's your yard costing you?" live ROI calculator |
| 6 | granola.ai | Product/SaaS | Next.js, Tailwind 4, native CSS scroll-driven animation, GSAP, Rive | Current | Hero demo shrinks into a sticky note that rewrites itself on scroll |
| 7 | functionhealth.com | Health testing | Astro, custom WebGL shader, GSAP, Lottie, Rive | Awwwards HM (2024 build) | Fluted-glass WebGL hero; scroll-reactive condition marquee |
| 8 | superpower.com | Health testing | Webflow, GSAP (ScrollTrigger, SplitText, Flip, Observer), Lenis, Lottie, Rive, HLS | Current | Pinned 4-step stage with a paced step queue and crossfading video |
| 9 | eightsleep.com | Sleep hardware | Next.js, Tailwind 4, GSAP, Rive, Swiper | Current | Working mini-app UI inside every feature card |
| 10 | ultrahuman.com | Wearable | Next.js, GSAP, Lenis, Unicorn Studio (WebGL) | Current | Arc-wipe gauge with count-up; live global counter |
| 11 | bevel.health | Wearable-data coach | Webflow, GSAP (ScrollTrigger, SplitText), Lenis, Rive, Lottie | Awwwards HM May 2026 (NOOON) | Coach-personality switcher; shutter-slat section transition |
| 12 | getvitaminlab.com | Personalized supplements | WordPress, Bootstrap 5, jQuery | Forbes Health #1 (2026) | Ingredient-and-dose "formula card"; conversational quiz |

---

# A. Motion and interaction leaders

## 1. Linear — linear.app

**Positioning:** "The product development system for teams and agents."
**Stack:** Next.js with StyleX atomic CSS (`sx-` classes) and motion/framer-motion (heavy signature in the bundles). Fonts are Inter Variable and Berkeley Mono. The ground is near-black `#08090a` with text `#e2e4e7`. The only colour comes from the product's label colours: pink `#f79ce0`, blue `#55cdff`, amber `#ffc47c`, green `#89d196`, and brand indigo `#5e6ad2`.
**Structure:** hero (H1, one line, full app window) → customer logos → one statement paragraph ("A new species of product tool") → four pillar sections, each with one H2, one sentence and "Learn more" (Intake and integrations; Planning and monitoring; AI and automations; Build, review, and ship) → changelog → one quote → prefooter "Built for the future. Available today."

**Signature elements**
1. **The product as the hero, rendered in live DOM.** The hero is a whole Linear window: sidebar (Inbox, My issues, Reviews, Initiatives…) plus an open issue, "DRV-8852 Faster app launch". Its activity feed tells a story: created from Slack, labels added by Triage Intelligence, an agent picks it up, "Draft PR awaiting your review · 2 min ago". It is built from HTML and SVG, not an image. *How:* real components with fixed fixture data, faded at the edges with `mask-image` (121 uses in the CSS). *Why it works:* it proves the product with its own interface. It stays sharp at any pixel density, and each row can animate on its own.
2. **Shimmering hairline on "working" things.** Agent badges carry `[data-shimmer]`. An `::after` sits on the border with a gradient background. `mask-composite: xor` cuts it down to a 1px ring, and a keyframe (`agentBorderSweep`, background-position 0→120px) slides light around it. *Why:* it shows something is happening in the calmest way possible.
3. **Isometric dot-matrix loaders.** Small grids are tilted into isometric planes with `rotateX(60deg) rotateY(3deg) rotate(43deg)` and pulse (`1.75s cubic-bezier(.66,0,0,1)`). This gives depth with no WebGL.
4. **Edge-dissolved compositions instead of boxed cards.** The pillar visuals are groups of UI fragments that fade into the background. They never sit in rounded cards. Text swaps use a short suffix enter (`.2s ease-out-quart`).

**Text density:** each pillar has about 20–30 words of marketing copy. The page has about 1,700 visible words, but most of them are UI microcopy inside the mock-ups (issue titles, labels, diff lines). Those words *show* the product instead of describing it.

**Steal for Distill:** make the hero a live **stack ledger** in DOM, not a phone screenshot:
- Rows such as "Magnesium glycinate · 400 mg · $18", "Cold plunge membership · $89", "Red-light mask · $0 (bought)", each with a tier chip (Tested on you / No test needed / Can't measure).
- A running total at the top: "23 things · $341 a month".
- A small activity feed under it, written in Distill's voice: "Night 6 · off day · deep sleep inside your normal range" → "Verdict ready · late coffee · dropped".
- A brass shimmer hairline on the one item currently under test.
- Every edge masked into the background. No card boxes.

---

## 2. Igloo Inc — igloo.inc

**Positioning:** parent company of Pudgy Penguins ("create the largest onchain community").
**Credits:** built by Abeto (WebGL) with Bureaux (moodboards, 3D, music). Awwwards SOTD 2024-07-23, listed among Sites of the Month. It is still live and still cited as one of the best-engineered three.js sites.
**Stack (from `App3D` chunk, 1.5 MB):** vanilla three.js + three-mesh-bvh, Svelte for the shell, GSAP, Vite.
- Geometry is Draco (`igloo.drc`, `floor.drc`, `intro_particles.drc`). Textures are KTX2, and the environment map is EXR.
- UI text is MSDF rendered in WebGL (`IBMPlexMono-Medium-datatexture.ktx2`).
- Sound effects are OGG (`enter-project.ogg`, `leave-project.ogg`, `manifesto.ogg`, beeps).
- The bundle is heavy on transmission/refraction/dispersion/fresnel code.
- The HTML `<body>` is empty: the whole site is one canvas.

**Signature elements**
1. **Procedurally grown ice blocks.** Each portfolio project is an object frozen in its own ice block. Abeto wrote a crystal-growth algorithm that "grows" ice inside a base shape, so every block differs while staying one family. The blocks are rendered with transmission and dispersion shaders. *Why:* scrolling past them feels like walking past museum cases. The material itself is the brand.
2. **UI rendered in WebGL so text can scramble and glitch cheaply.** The case study says DOM text scrambles force style recalculation. In WebGL a letter change is just an offset into the SDF atlas.
3. **Scene transitions as events.** Chromatic aberration, "tech displacement" and a frost effect move you between scenes. The intro is animated in real time in-engine, not a video, so it stays sharp and light.
4. **Particles that form volumes, with sound.** In the links footer, particles swirl into a different 3D shape for each link. The shapes are VDB volumes exported with a custom compressed format. Particles change colour with speed and glow while re-forming, and sound effects are synced to the motion.

**Text density:** close to zero in the DOM. There are three sections in total: intro manifesto, projects, links. Meaning comes from objects, motion and sound.

**Steal for Distill:** **"The stack, under glass."**
- On scroll, the visitor's 23 items sit as small glass capsules in a refractive tray.
- As the 14-day tests resolve, the ones that showed nothing fog over and dissolve into a slow particle drift that falls out of frame.
- The ones that work stay crystal-clear and slide together: 23 becomes 4.

Practical version for a no-build site: one OGL canvas with a simple refraction/frost fragment shader over pre-rendered capsule sprites. That costs about 30 KB of library instead of a full three.js scene. Sound stays off by default.

---

## 3. Oryzo AI — oryzo.ai (by Lusion)

**Positioning:** "The world's most unnecessarily sophisticated cork coaster." It is a parody premium product launch, built with full seriousness. Awwwards SOTD 2026-04-13 and Site of the Month April 2026; Lusion reports it as a Site of the Year 2026 finalist.
**Stack:** Astro, three.js (about 200 GLSL markers in one bundle), GSAP SplitText, Rive for interactive bits, an audio layer.
- The desk scene is **Gaussian splatting**. Lusion rendered it in Houdini/Redshift, converted it to splats in Postshot, and split it into several splats for compositing.
- Type: halyard display and text variable (Typekit), plus Literata and DM Mono.
- Lusion's stated rule: about 99% of the type is one family, and the palette has **four colours**: cream `#ffedd7`, near-black `#100904`, olive `#445231`, orange `#dc5000`.

**Structure:** by Lusion's own account it is an ordinary product page: hero shot → key benefit → usage → specs → reviews → comparison → purchase. The section ids are hero, ai, wearable, features, encryption, grip, sustainability, testimonies, product ("ORYZO / Pro / Pro Max").

**Signature elements**
1. **A photoreal, real-time hero world.** A lived-in studio desk with the product in the centre, rendered as splats so it holds up close and still runs in real time. The camera follows one linear spline as you scroll. Lusion first tried a "clean abstract product study" and dropped it as "lifeless". The believable environment is what made it work.
2. **Absurd-zoom microscope section.** The camera pushes into the cork at microscopic scale; the surface uses periodic noise so it loops seamlessly. A drag-and-shake Easter egg reveals a tardigrade. Interaction rewards curiosity.
3. **Every spec gets its own mini-scene.** "Smart flip encryption" (type a message, flip it, decode it), "Grip-locked Antislip technology", "Thermodynamic stability", "Now 37.9% More Circular", "Average age of first harvest". Fake-precise numbers with real craft.
4. **One rule-break.** A section transition borrows an old fashion magazine's typography. It is the only place the UI is allowed to "perform", which is why it lands.

**Text density:** about 1,000 words in total, but each section is one headline plus one or two lines (23–118 words, mostly jokes). Renders and hand-drawn Procreate illustrations carry the page. Lusion's summary is that most of the UX work "came down to deciding what not to do".

**Steal for Distill:** two things.
- **The spec sheet, used straight.** Oryzo inflates a trivial object. Distill deflates an over-built stack. Give one real item the full premium treatment: "Magnesium glycinate. 400 mg nightly. $18 a month. Tested on you for 14 nights. Change against your normal night-to-night swing: 0.2×. Verdict: dropped. $216 a year back."
- **The microscope zoom.** Zoom into one night of HRV data until the item's "effect" is visibly smaller than the band of normal variation.

Oryzo's restraint also matches Distill brand v4 (night ground, paper text, one brass accent, one serif + one sans): four colours and one family let the hero object do all the talking.

---

## 4. Raycast — raycast.com

**Positioning:** "Your shortcut to everything."
**Stack:** Next.js (Turbopack chunks) with CSS Modules. Fonts: Inter, Geist Mono, Instrument Serif and VT323. Dark greys `#07080a`–`#18191a`, with brand red `#ff6363` used sparingly.
**Structure:** hero (19 words) → "It's not about saving time." + keyboard → extensions → AI → snippets/hotkeys showcases → feature wall → community → API → footer CTA with an animated ⌘-space keyboard.

**Signature elements**
1. **A real keyboard as the section graphic.**
   - Next to "It's not about saving time. It's about feeling like you're never wasting it." sits a full DOM keyboard of 159 keys.
   - Most keys rest at `opacity: .2`. Selected keys light up by transitioning their SVG fill, each with its own `--delay`, on `cubic-bezier(.23,1,.32,1)`. The result is a wave across the keyboard.
   - The value words (Fast / Ergonomic / Personal / Reliable) are printed on the keys themselves.
   - The whole keyboard is masked with a radial gradient so it melts into the dark.
   - *Why:* the product's own input device becomes the illustration.
2. **The clickable sentence wall (FeatureWall).** A paragraph reads "What else can Raycast do? It can take notes. Track your flights. Convert anything. Search files. Run scripts. Manage your windows. Plan your day…". Every sentence is a `role="button"`. Grey sentences turn white when active, the demo on the right switches, and a progress keyframe auto-advances. *Why:* a dozen features fit in one readable, scannable sentence with no card grid.
3. **Hotkey showcase.** Key combinations cycle with tight enter/exit motion: from `translateY(10px) scale(.97)` to rest in 300 ms on `cubic-bezier(.4,0,.22,.96)`, exiting to `scale(.97) translateY(-5px)`. Small, physical and quick.

**Text density:** very low per section. The H2 plus one line is about 13 words. Keyboards, command bars and extension UIs carry the meaning.

**Steal for Distill:** **the stack sentence wall.**
- "What's in a stack? Magnesium at night. Ashwagandha. A $90 red-light mask. Cold plunges. Creatine. Coffee after 2 pm. Mouth tape. A $180 sleep coach."
- Each sentence is a button. The panel beside it shows that item's tier, its test plan and an example verdict.
- Dropped items get a quiet strikethrough that stays.

The keyboard idea becomes a **14-key calendar strip** that lights 3 on / 3 off in a wave, so the experiment rhythm is understood without a sentence of explanation.

---

## 5. Terminal Industries — terminal-industries.com

**Positioning:** AI-native "Yard Operating System" for logistics. Credits: Rejouice and Propagande. Awwwards SOTD 2025-09-03, tagged *startups* and *storytelling*.
**Stack:** Nuxt (Vue), Storyblok CMS, Tailwind, GSAP (SplitText, DrawSVG, ScrollTrigger), Lenis, Rive, video. Fonts: Suisse Intl and Geist Mono. Palette: deep teal-black `#052424`, acid lime `#abff02`, white.
**Structure:** two-beat hero over a video carousel ("AI-native technology that turns the space between your gate and your dock…" / "…into one connected, automated system.") → logo wall → three entry cards by scale ("Fix one problem / a few yards / a network") → ROI calculator → platform intro → four numbered steps with video → expandable module carousel → team → quote and contact → FAQ tabs.

**Signature elements**
1. **A live ROI calculator as a full section.** "What's your yard costing you?"
   - Seven inputs: gates, shifts per day, operating days, spotters per shift, check-ins per day, blended hourly wage, and a 1–10 slider for detention costs.
   - Output: one huge live number ("With Terminal your yard saves $641,626", "23%") plus a three-line breakdown by category.
   - Then an email field: "run a custom ROI analysis with one of our yard experts".
   - *Why:* the visitor makes the case for the product themselves, in their own numbers, and the lead capture feels earned.
2. **Odometer steps.** The four "features-steps" use rolling digit reels (stacked 0–9 columns that translate). The step index rolls like a meter as each video swaps.
3. **Line-drawn diagrams and split-type reveals.** DrawSVG strokes and SplitText headlines over a Lenis-smoothed scroll, plus Rive for the modular-platform carousel.

**Text density:** hero 27 words. The calculator section is about 120 words, almost all of them input labels. Explanatory copy is a sentence per step.

**Steal for Distill:** upgrade the v3 stack builder into **"What's your stack costing you?"**
- Steppers and chips: supplements, services, memberships, devices, average monthly cost.
- A live odometer total in brass: "$341 a month · 23 things".
- A second line: "Likely day-one cuts: 6 · $112 a month back".
- Then the waitlist field ("Get my stack audit").

Rolling digit reels instead of fading numbers make the subtraction physical.

---

## 6. Granola — granola.ai

**Positioning:** "The AI notepad for back-to-back meetings."
**Stack:** Next.js, Tailwind 4, GSAP + ScrollTrigger, Rive, and a lot of **native CSS scroll-driven animation**. Fonts: Quadrant (display serif) and Melange (sans). Palette: warm off-white `#fcfcf8`, ink, lime `#d1e043`, olive `#788c15` / `#5b6f00`. It feels like paper, warm and human.

**Signature elements**
1. **Hero demo that shrinks into a sticky document.**
   - `.sticky-demo-preview { animation: shrink-to-sticky-sm linear both; animation-timeline: scroll(root); animation-range: 0 100vh }`
   - The meeting note shrinks from hero size into a sticky panel (`sticky top-24`) as you scroll. Copy then passes beside it while the note flips from "My notes" (rough typed lines) to "Enhanced" (structured summary with owners and next steps).
   - *Why:* one object carries the whole argument, and the before/after happens in front of you.
2. **Floating items that scatter on scroll.** `.floating-item` runs two animations on the root scroll timeline, with ranges `0–50vh` and `60–80vh` (`float-explosion` keyframes). Stickers and icons drift outward as you leave the hero. No JS.
3. **View-timeline step fills.** "Before / In / After the meeting" progress bars are filled by named view timelines (`view-timeline-name: --hiw-step-0..2`). A headline slides under the logo wall (`doers-slide-under`, `animation-range: cover 50%`). Text reveals use `animation-timeline: view()`.
4. **"Generating" states.** The chat question is typed letter by letter, with a letter wave while generating (`chromaGeneratingLetterWave`) and small dancing audio bars. The machine at work, shown in miniature.

**Text density:** hero 28 words. The sticky demo replaces a features section. Some sections run long (about 500 words in "how it works", much of it demo content).

**Steal for Distill:** this is the closest tonal match, and the strongest hero pattern for Distill.
- The visitor's **messy typed stack** sits on paper: "mag glycinate at night, AG1 mornings, sauna 3x, red light mask, zinc?, sleep coach".
- On scroll it shrinks to sticky and **distills**: each line becomes a clean ledger row with a cost and a tier chip, duplicates merge ("zinc is already in AG1"), and the count ticks 23 → 19.

Build it with `animation-timeline: scroll()` behind `@supports`, with GSAP ScrollTrigger as the fallback.

---

# B. Health, wellness and biometrics

## 7. Function Health — functionhealth.com

**Positioning:** "Check your health." 160+ lab tests a year for $365 ("$1 per day").
**Stack:** Astro (the site was rebuilt; a few Webflow asset references remain), GSAP (`quickSetter`), Lottie (17 instances in "Testing is easy"), a custom WebGL hero shader, Rive in the doctor grid, and a site-wide Motion toggle. Fonts: FT Base (sans), **Financier Display Light Italic** (serif) and Fragment Mono. Palette: warm cream `#fef9ef`, beige `#f5eee1`, charcoal `#2a2b2f`, terracotta `#b05a36` used for italic emphasis. The 2024 build got an Awwwards HM (credits: Aaron McGuire, Stas Bondar, Victor Niculici).
**Structure:** hero → 3 steps (Lottie) → "Monitor early indicators of *1000s of diseases*" (marquee) → 160+ tests with doctor quotes → trust → press logos → member video stories → testing logistics → comparison table ("Not your average checkup") → doctors → pricing ("What could cost you $15,000 is $365") → FAQ → "Life is short? We disagree."

**Signature elements**
1. **Fluted-glass WebGL hero.** Hero photographs are seen through a reeded-glass shader whose uniforms show the art direction:
   - `u_fluteAngle`, `u_flutingEnabled`, `u_bevelIntensity`, `u_bevelWidth`
   - `u_chromaticAberration`, `u_colorBleed`, `u_stainIntensity`, `u_noiseInfluence`
   - `u_crossfade` / `u_nextZoomFactor` for image-to-image transitions with a zoom
   - `u_reveal`, `u_driftSpeed`

   *Why:* real photography gets a clinical, laboratory-glass quality without becoming "tech", and it is unique to them.
2. **Scroll-direction-reactive condition marquee.** Rows of condition names (Anemia, Gout, Celiac disease, Insulin resistance…) run in opposite directions in a requestAnimationFrame loop driven by `gsap.quickSetter`. Scrolling up reverses them. The loop respects `data-motion-paused`, set by a global "Pause motion / Play motion" control. *Why:* "1000s" is shown as a felt quantity instead of being stated. The pause control is a real accessibility touch.
3. **Serif italic emphasis in one accent colour.** The sans headline carries one italic serif phrase in terracotta (`.u-orange-italic`). This is the brand's typographic signature.
4. **Price anchoring as a section.** "What could cost you $15,000 is $365", next to a checklist comparison table against a standard checkup.

**Text density:** the hero is about 60 words (including the stat strip) and the steps are about 40 words in total. Lottie, the marquee and photography carry most sections. FAQ and doctor bios add bulk lower down (about 2,150 words overall).

**Steal for Distill:** **the stack marquee that thins.**
- Rows of real things people pay for drift across: Magnesium · AG1 · Sauna · Red-light mask · NMN · Creatine · Mouth tape · Cold plunge · Ashwagandha · Blue-light glasses · Sleep coach…
- As the page goes on, items get struck through and drop out of the rows. The rows get sparser and slower until only four remain, at rest.

It is the "only scoreboard that goes down when you're winning" made visible. Add a Motion toggle. Use one serif-italic phrase per headline in brass (brand v4: Cormorant italic against Manrope).

---

## 8. Superpower — superpower.com

**Positioning:** "Your new health membership." 150+ biomarkers over two blood draws, $349 a year.
**Stack:** Webflow, GSAP with ScrollTrigger, SplitText, Flip, Observer, ScrollTo, Text, CustomEase and EasePack, plus Lenis, Lottie, Rive, hls.js and Plyr video cards. Font: NB International (+ mono). Palette: white/black with cyan `#00b2ff` and orange `#fc5f2b`.
**Caveat:** this is the most text-heavy site in the set (about 3,500 words, long doctor bios, big FAQ). Its density is **not** the model. Its "how it works" engine is.

**Signature elements**
1. **Pinned four-step stage with a paced step queue** (`[data-howitworks]`, read from the inline script):
   - Scroll sets a *target* step. The *displayed* step ticks toward it **one step at a time, at most every 600 ms** (`TICK_INTERVAL`). A fast scroller still sees every beat.
   - Full-bleed backgrounds (image or video) crossfade with `is-active` / `is-prev`. Each video restarts at 0 when its step activates.
   - Text colour flips light/dark per step (`setDark(index === 0)`).
   - A `--reverse` class flips the animation direction when scrolling up.
   - **Each step has its own short FAQ list** that swaps in, so objections are handled at the moment they come up.

   *Why:* scroll position becomes a calm, legible slideshow instead of a scrub you can blow past.
2. **Price-anchor membership card.** "What could cost $10,000 is now $349", followed by an itemized inclusion list.
3. **Video-first social proof.** HLS video cards with Plyr. Sources are parked and unparked (lazy load and memory release).

**Text density:** the hero is short ("Members get 150+ lab tests across 2 blood draws. $349 per year."). Lower sections are long, which is a cautionary example.

**Steal for Distill:** "how it works" as **one pinned stage in four beats**:
1. **List.** The ledger fills.
2. **Sort.** Rows fly into three tier columns.
3. **Test.** A 14-night calendar runs 3 on / 3 off with dots landing.
4. **Verdict.** Kept / dropped / inconclusive stamps.

Use Superpower's paced queue so no beat is skipped. Attach one-line FAQs per beat: "Do I stop everything at once? No, one thing at a time." "What if I miss a night? The test just runs longer."

---

## 9. Eight Sleep — eightsleep.com

**Positioning:** Pod 6 intelligent bed cooling, from $1,999.
**Stack:** Next.js, Tailwind 4, GSAP + ScrollTrigger, Rive, Swiper, video. Fonts: Neue Montreal, Oswald (numerals and display) and IBM Plex Mono. Palette: black, white and warm greys, with electric blue `#1862ff`.
**Structure:** film hero (with "4.5 · 30,000+ reviews" up top) → film → "What's the Pod?" (Cover / Hub / App) → "New to Pod 6" spec chips → **"For the life you live"** scenario cards → **"A night on the Pod"** → Solo sizes → clinical research → advisory board → member stories → top performers → 30-night trial.

**Signature elements**
1. **Working mini-app UI inside every feature card.** Each card holds a functioning-looking fragment of the app:
   - Couples: split-bed temperatures 64° vs 76°.
   - Training: "Run · Tennis — 68°F Current → 66°F Updated".
   - Women's health: Hot / Neutral / Cold body-feel scale across weeks W0–W30.
   - Nap: "14:58 · Nap in progress · Alarm at 9:56 · Add 10m · End".

   These UIs are scaled with a custom unit variable (`--card-u`), so the little interface stays proportionate at every card size. *Why:* each card *proves* its sentence with the product's own numbers. No icons, no stock photos.
2. **"A night on the Pod": one night narrated in five beats.** A sticky app panel follows you while the beats scroll by (scene set → deep sleep, deeper cooling → snoring detected → gentle wake → know how you slept). A live status line changes with each beat ("Now Cooling to 68°F", "The Pod is recalibrating for your day"). Scroll-snap keeps beats aligned.
3. **Film-first hero with proof in the first screen.** The rating sits beside the price before any explanation.

**Text density:** each card is a headline plus one sentence plus a live widget. The total word count is high (about 3,200), mostly from reviews and testimonials.

**Steal for Distill:**
- **"Fourteen nights on Distill"**: a sticky phone or panel with a live status line that changes per scroll beat. "Night 1 · on · magnesium tonight" → "Night 4 · off · skip it tonight" → "Night 9 · deep sleep 1h 42m · inside your normal range" → "Day 14 · Inconclusive · keep it or drop it, your call."
- Feature cards that each hold a live UI fragment:
  - the tier sorter
  - the 3-on/3-off strip
  - a verdict card with the person's own normal-swing band and a dot that lands inside or outside it
  - a cost line that ticks down

---

## 10. Ultrahuman — ultrahuman.com

**Positioning:** "Power Moves." Ring PRO and an ecosystem for "peak health and performance".
**Stack:** Next.js with CSS Modules, GSAP + ScrollTrigger, Lenis, **Unicorn Studio** (v1.3.2, no-code WebGL effect scenes loaded behind a WebGL capability check), video. Fonts: Geist Sans and JetBrains Mono (with Inter). Palette: black and white with electric blue `#1539f5`. The lowest text density in the set: most sections are **13–19 words**.
**Structure:** product hero → science → battery life → "PRO beyond measure" metric tabs → form-factor blocks (PRO dark / AIR light) → app → "The world's sleep, on a single system" (live counter) → research partners.

**Signature elements**
1. **Arc-wipe gauge with count-up.** A pinned stage shows the ring render. An SVG arc wipes around it with a moving shine (`arcWipeStack`, `arcShine`) while a counter climbs to "15 days". *Why:* a number you watch fill is remembered. A number you read is not.
2. **A live global counter.** "Nights of sleep tracked 130,264,253" keeps incrementing at a fixed rate (the page data carries `nightsPer5m: 567`), next to country cards placed by latitude/longitude. The brand feels alive while you watch.
3. **Overlap layers.** Form-factor blocks pin and stack over one another (`data-overlap-layer="pro"/"air"`, `data-overlap-pin`): sticky stacking sections with light/dark alternation. The header recolours itself per section through `data-header-theme`.
4. **Metric tabs with a sliding pill highlight** (Activity / Sleep / Workouts / Recovery / Women's Health) over a carousel of app screens.

**Text density:** the most disciplined here. One heading, one line, then an object, number or screen. It proves that a health brand can say almost nothing in words.

**Steal for Distill:** **"The only scoreboard that goes down."**
- A pinned arc gauge that **unwinds** as you scroll, the shine running backwards.
- Item count rolls 23 → 4 and monthly cost rolls $341 → $96 (odometer digits).
- End state: "4 things that work · $245 a month back".

Later, once there are real members, a live "things dropped by early members" counter. Until then, keep it to the visitor's example numbers, never invented aggregate stats.

---

## 11. Bevel — bevel.health

**Positioning:** "Your Connected Health Coach." Makes sense of wearable and lab data. Awwwards Honorable Mention 2026-05-11. Credits: NOOON and Diego Toda de Oliveira.
**Stack:** Webflow, GSAP (ScrollTrigger, SplitText), Lenis, Rive, Lottie, many short MP4s. The CSS references Archivo, Graphik and Gilroy. Palette: white with charcoal `#1f2025`, signal yellow `#fecc00`, and pastel feature cards (lilac, pink, red).
**Structure:** hero → "Works with" logos → "2.5 million members" → Strain/Sleep/Recovery → "Go deeper with Bevel Intelligence" (dark) → "And that's not all" video tabs → privacy → reviews wall → "Ready when you are".

**Signature elements**
1. **Device-constellation hero.**
   - A looping "tunnel" video sits behind an iPhone and an Apple Watch, each playing three synced screen videos.
   - Nine floating metric cards (`hero_card cc-1…9`) and soft cloud layers fly in and settle on scroll.
   - A clip-path reveal at the bottom hands off to the next section.

   *Why:* the product is shown across the devices the audience already wears.
2. **Coach-personality switcher.** Rive avatars labelled **Commander / Friend / Guardian / Data Nerd** change the voice of the coach in the demo. *Why:* tone becomes a feature you can try in one tap.
3. **Shutter scroll transition.** Moving into a dark section, the page builds six horizontal slats (configurable per breakpoint). Each scales on Y from the bottom with a reversed stagger (`each: .01`, `scrub: .3`), like blinds closing into the next scene. Cheap, crisp, and very premium.
4. **Video tabs with progress rings.** Each feature tab owns an SVG ring that fills over the clip's duration (`strokeDashoffset` tween), auto-advances, pauses on hover, and lazy-loads and unloads video sources to save memory.

**Text density:** hero 35 words. Logo and member sections are 2–9 words. Feature sections run about 90–110 words over two or more visual layers.

**Steal for Distill:**
- **"How should Distill talk to you?"** Three voices (Plain / Gentle / Just the numbers) rewrite the *same* verdict live, e.g. late coffee, dropped. This sells the "on your side, never judging" promise by demonstration.
- The **shutter transition** for the move from paper "your stack" to night "the test" (brand v4's two grounds).
- **Ring-progress tabs** reused as the 14-night progress ring around each tested item.

---

## 12. VitaminLab — getvitaminlab.com (the team's "Vitamin Lab")

**Positioning:** "You're one of a kind. Your vitamins should be too." Custom single-formula supplements from a quiz or uploaded blood/DNA results, with a practitioner channel (Jane integration).
**Stack:** WordPress theme with Bootstrap 5.1.3, jQuery and some Tailwind utilities. Fonts: Sofia Pro and Karla. Palette: clinical blues `#002e82` / `#005cdb` with a green accent (`#1a8f6a`) and rose bands. Motion is close to none: a parallax hero and a testimonial slider.
**Structure:** hero → how it works (quiz, unique formula, adjust as you go) → four numbered pillars (Evidence-Backed, Truly Personalized, Dynamic, Quality Ingredients) → **"Jen's Power Mix" sample formula** → quality → testimonials → "Start your formula" form.

**What is good about the UI (probably what the team noticed)**
1. **The formula card.**
   - "Jen's Power Mix · Doctor and Yogi · Immunity · Energy" with a short persona line.
   - Then ingredient rows with a dose and a reason: "500 mg Vitamin C — For immune and adrenal health", "35 mg B-Complex — To support adrenals and energy", "300 mg Rhodiola…".

   It reads like a label, concrete and expensive-feeling.
2. **A conversational, one-question-per-screen quiz.**
   - "Before we get started, what's your first name?" → "Nice to meet you, {name}!" → "Choose 3–5 goals" as chips → diet and lifestyle multi-selects → "What would you like to name your formula?"
   - It is personal and low-effort, and every step is a single decision.
3. **"Create stack" with a naming moment.** "You're seconds away from creating a truly personal formula!" Naming the thing creates ownership.

**Text density:** high (43–256 words per section). Not a model for density or motion.

**Steal for Distill:**
- **"Your stack, labelled"**: a supplement-facts-style panel. Every row shows the item, the dose or frequency, the monthly cost, the tier, and a verdict column that fills in as tests resolve. A bottom line shows "Monthly total" with the struck-through old total above the new one.
- The **name-your-stack** moment inside the waitlist flow ("Name it: Ishan's evening stack"). A one-question-at-a-time waitlist ("What do you wear?" Oura / Apple Watch / Garmin chips → "Roughly how many things are in your stack?" → email) beats one long form.

---

## Also checked (not in the twelve)

- **family.co**: live, still the reference for spring-physics micro-interactions and Lottie-driven phone demos (styled-components, framer-motion, Lottie). But the design dates from 2022–23 and the content is stale. Benji Taylor's interaction write-ups ("dynamic tray", continuity through motion) are worth reading for the app.
- **diabrowser.com**: calm, Lenis + Lottie + Mux video, ABC Oracle type. Close in tone (calm, "better days") but the motion is mostly video.
- **cursor.com**: interactive multi-surface product demo hero. Too text-heavy for this brief (about 2,800 words).
- **rive.app**: a Framer site; useful as a gallery of what Rive state machines can do, not a layout model.
- **arc.net**: now a holding page pointing to Dia.
- **basement.studio** and **lusion.co**: studio portfolios. Oryzo is the better Lusion reference.
- **poolsuite.net**: a JS-only retro-OS radio app; off-brief.
- **ouraring.com**: PP Editorial New Ultralight + Akkurat on a "sandstone" ground, beautiful photography, little motion, commerce-first.
- **levels.com** and **risescience.com**: competent, text-heavier, standard section rhythm.
- **why.zero.university**: Awwwards SOTD 2026-09-07 (three.js, gestures, sound, startup storytelling). Worth a browser look as the freshest winner.
- **nekohealth.com**, **whoop.com**, **withings.com**: bot-blocked; check in the browser.

---

# Synthesis

## The 10 strongest transferable patterns (ranked for Distill)

1. **The product as the hero, built in live DOM** (Linear, Granola, Eight Sleep, Bevel). Not a screenshot or phone mock-up but real HTML UI with fixture data, edge-masked, animating row by row. *Distill:* the stack ledger with tier chips, costs and a running total, plus a tiny activity feed in Distill's voice.
2. **One object transforms over the scroll** (Granola notes → enhanced, Igloo ice, Oryzo desk). The page tells one story through one thing that changes. *Distill:* the messy typed stack distills into a clean ledger, then sorts, then tests, then shrinks to the four that work.
3. **A personal-number calculator in the visitor's own numbers** (Terminal's ROI calculator; VitaminLab's quiz in spirit). *Distill:* "What's your stack costing you?" → live total → "likely day-one cuts" → waitlist. The visitor argues the case for you.
4. **Numbers that move physically** (Ultrahuman arc-wipe and live counter; Terminal odometer reels; Function's "$1 per day" anchor). *Distill:* the scoreboard that **goes down**. Odometer digits roll 23 → 4 and $341 → $96, and an arc gauge unwinds. This is the brand's core idea, made literal.
5. **A pinned stage with paced beats, crossfading backgrounds and per-beat FAQs** (Superpower's 600 ms queue; Eight Sleep's "night on the Pod"). *Distill:* "how it works" as List → Sort → Test (14 nights, 3 on / 3 off) → Verdict, with one-line reassurance attached to each beat.
6. **Working mini-UI inside feature cards** (Eight Sleep `--card-u` widgets; Linear pillars). No icon-plus-headline cards. *Distill:* the tier sorter, the 3-on/3-off strip, a verdict card with the person's own swing band, a cost line ticking down.
7. **A clickable sentence wall / auto-advancing tabs with progress** (Raycast FeatureWall; Bevel ring tabs). Many items, zero grids. *Distill:* "Magnesium at night. A $90 red-light mask. Coffee after 2 pm…". Each sentence opens its verdict; dropped ones keep a quiet strikethrough.
8. **Meaningful kinetic lists** (Function's scroll-direction marquee). Motion that stands for a quantity. *Distill:* the stack marquee that **thins out** as the page goes on.
9. **Section transitions treated as events** (Bevel shutter slats; Igloo chromatic/frost; Oryzo's one magazine break; Ultrahuman overlap stacking and header theme flip). *Distill:* a shutter or "pour" transition from paper ground to night ground when the experiment starts. Keep it to one or two such moments on the page.
10. **Tone made interactive** (Bevel's coach personalities). *Distill:* the same verdict in Plain / Gentle / Just-the-numbers voices. It proves "never judging" without a paragraph claiming it.

Two cross-cutting rules every one of these sites follows:
- **Restraint system.** Oryzo uses four colours and one type family. Linear's only colour is the product's own label colours. Function has one accent, used only on an italic serif phrase. For Distill, brand v4 already fits this: night `#100F0B`, paper `#F5EDD7`, one brass `#B89552`, Cormorant + Manrope, hairlines, square corners, no red, no glass.
- **Motion is controllable.** Function ships a visible Pause/Play motion toggle. Everything should honour `prefers-reduced-motion`.

## Anti-patterns these sites avoid (that AI-generated pages commit)

- **Centred hero: H1 + subhead + two buttons + a glowing gradient blob or orb.** Every site here puts a *thing* in the hero instead: a product window, a world, a device, a film, an object.
- **Three (or six) identical feature cards with an icon in a rounded square, a bold title and two lines.** Here each feature carries its own live UI fragment, a sentence-wall entry, or a pinned beat.
- **Inter everywhere at one weight.** Faces are chosen with a reason and paired: Financier Display italic + FT Base (Function), Quadrant + Melange (Granola), Editorial New + Akkurat (Oura), Suisse + Geist Mono (Terminal), halyard + DM Mono (Oryzo). Linear uses Inter only because the product UI *is* the visual, and pairs it with Berkeley Mono.
- **Purple-to-blue gradients, neon glows, gradient text on black.** Palettes here are a neutral ground plus one accent (terracotta, brass-like orange, acid lime, electric blue), used rarely.
- **Emoji or generic line icons as feature art.** Features are illustrated with real UI, real numbers, product renders or hand-made illustration (Oryzo's Procreate drawings).
- **Generic glassmorphism** (frosted cards over blurred blobs). Where glass appears it is *specific*: Function's reeded-glass shader over photography, Igloo's refractive ice.
- **An eyebrow label over every section** ("FEATURES", "HOW IT WORKS"). Most sections here open on the headline or the object. Bevel and Linear rely on hierarchy and space.
- **The same fade-up-on-scroll on every element.** Motion here is assigned per job: scrub for transformations, enter/exit springs for state changes, staggered reveals only on display type, rAF loops only for living data.
- **Rounded-2xl cards with soft drop shadows everywhere.** These sites use edge masks, hairlines, full-bleed bands, and pinned or stacked layers.
- **Zig-zag 50/50 image–text rows and dotted-line 1-2-3 circles.** These become pinned stages, sticky documents and calculators.
- **Fake stat rows ("10k+ users · 99% satisfaction") and fake logo walls.** Numbers here are either product data (Eight Sleep's 64°/76°), the visitor's own (Terminal), or live (Ultrahuman). Distill has no members yet, so use the visitor's example stack, never invented aggregates.
- **Paragraphs that explain a feature.** One line, then proof you can see or touch.
- **An arrow icon on every CTA, five CTAs per screen.** One primary action, repeated sparingly.

## Recommended approach for a static site with no build step

**Architecture**
- Plain `index.html` + hand-written CSS + ES modules loaded with `<script type="module">` and an **import map**. Vendor every library file into `public/vendor/` at an exact version, so Vercel serves them from the same origin. No runtime CDN dependence.
- One module per pattern (`ledger.js`, `marquee.js`, `stage.js`, `calculator.js`, `odometer.js`, `glass.js`). Each one initialises only when its section nears the viewport (IntersectionObserver) and tears down its requestAnimationFrame loop when the section leaves.
- Fixture data for the demo stack in one JSON file (the Worked Example). The v3 `routing.json` can keep feeding the calculator and the sentence wall.

**Libraries (all usable without a bundler)**

| Need | Pick | Notes |
|------|------|-------|
| Timelines, pinning, scrubbing, split text, layout morphs | **GSAP 3.13.x** + ScrollTrigger, SplitText, Flip, DrawSVG (and CustomEase) | All plugins have been free, commercial use included, since 3.13 (2025). Vendor the minified UMD/ESM files. |
| Smooth scroll | **Lenis 1.x** (pin the exact patch) | Sync with `lenis.on('scroll', ScrollTrigger.update)` and drive it from `gsap.ticker`. Disable under reduced motion. Keep native scroll on touch. |
| Simple scroll-linked effects | **Native CSS** `animation-timeline: scroll()` / `view()` with `animation-range` | Granola's approach. Wrap in `@supports (animation-timeline: scroll())`. Use ScrollTrigger as the fallback where support is missing (check current Firefox status). |
| Animatable numbers and gradients | **`@property`** registered custom properties | Enables CSS-only count-ups (`counter-reset` with an `<integer>` property) and smooth gradient or arc changes. Use JS odometer reels for the hero numbers. |
| State swaps (tier sort, tabs, ledger reorder) | **GSAP Flip** or **View Transitions API** (`document.startViewTransition`) | View Transitions for whole-panel swaps; Flip where you need control over the stagger. Feature-detect. |
| One shader (glass capsules, frost dissolve, "pour" transition) | **OGL 1.x** | Tiny WebGL wrapper (about 30 KB) suited to a single full-screen or quad shader. Reach for **three.js** (as an ES module via the import map) only if real 3D models are needed. Clamp DPR to about 1.75 and pause offscreen. |
| Designer-authored interactive illustrations (verdict stamp, drop, avatars) | **Rive web runtime** (`@rive-app/canvas`) | Only if someone will author `.riv` files with state machines. Otherwise skip and use SVG + GSAP. |
| Charts (14-night swing band, dots landing) | Inline **SVG** + GSAP (DrawSVG for lines) | Crisp, accessible, themeable. Canvas 2D only if there are hundreds of points. |
| Lottie | Avoid unless the team already has JSONs | Rive or SVG/GSAP does the same job with smaller files and state machines. |

**Guardrails**
- **Accessibility:**
  - Honour `prefers-reduced-motion`. Swap scrubs for instant states, stop marquees, show final numbers.
  - Add a visible Motion toggle (Function's pattern).
  - Every interactive demo needs keyboard focus states (Raycast's sentence buttons use `role="button"`, `tabindex="0"` and a focus-visible outline).
  - Don't put text in WebGL (Igloo's approach is wrong for a conversion page). Keep all copy in the DOM.
- **Performance:**
  - The hero LCP should be DOM text and the ledger, not a canvas.
  - Load WebGL and video after first paint. Use posters for every video and lazy park/unpark sources (Bevel, Superpower).
  - Self-host subset WOFF2 fonts with `font-display: swap`.
  - Budget about 150 KB of JS before any shader.
- **Tone rules carried into motion:**
  - No red, and no "error" shakes on dropped items.
  - Dropping is shown as relief: things *settle*, *clear*, *fall away gently* with long eases. Avoid snappy deletions.
  - Kept items glow faintly in brass. Inconclusive items stay neutral, with "your call" language.
- **Copy:** the founder's long-headline framework conflicts with "little text". One way to fit both is to set the long H1 as kinetic type (a SplitText line-by-line reveal, one accent phrase in serif italic). Below it, hold every section to one headline plus at most one line, and let the ledger, calculator, stage and scoreboard carry the meaning.

**A page skeleton that uses the top patterns**
1. **Hero:** the long headline (kinetic) next to the messy typed stack on paper. It distills into the live ledger, ending at "23 things · $341 a month". *(Granola + Linear)*
2. **Thinning stack marquee.** *(Function)*
3. **"What's your stack costing you?"** calculator with odometer total and waitlist field. *(Terminal)*
4. **Shutter transition to the night ground.** *(Bevel)*
5. **Pinned stage:** List → Sort → 14 nights (3 on / 3 off) → Verdict, with per-beat one-line FAQs. *(Superpower + Eight Sleep)*
6. **Sentence wall** of stack items, each opening its verdict card with a swing band; plus the **voice switcher**. *(Raycast + Bevel)*
7. **Scoreboard that goes down:** an arc gauge unwinding 23 → 4, $341 → $96. *(Ultrahuman)*
8. **One item, full spec sheet:** "Magnesium glycinate… Verdict: dropped. $216 a year back." *(Oryzo)*
9. **Offer as a label:** $20 a month, 60-day guarantee, the "Your stack, labelled" panel, then a waitlist that asks one question at a time. *(VitaminLab)*

Sources used beyond the sites themselves:
- Awwwards case study "Igloo Inc: Case Study" by Abeto, 2024-10-31 (awwwards.com/igloo-inc-case-study.html)
- Lusion, "Oryzo BTS" parts 1–3 (blog.lusion.co)
- Awwwards site pages: /sites/igloo-inc, /sites/oryzo-ai, /sites/terminal-industries, /sites/bevel-health, /sites/function-health, /sites/why-zero
- Forbes Health and Jane integrations listings for VitaminLab (via search)
