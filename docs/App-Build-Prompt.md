# Prompt: refine the onboarding prototype and build it as the Distill web app

Paste everything below the line into a new session. Answer the decisions at the end first, or leave the recommendations in place.

---

I want you to refine the Distill app's onboarding UI (a Figma Make prototype) and build it as the real web app in this repository, on the plan the team has already set in `SPEC.md`.

## Read first, in this order

Repository: `/Users/ishanv/Desktop/Claude/distillV1` (GitHub distillAI-maker/distillV1; `main` deploys the marketing site to https://distill-v1-tau.vercel.app).

1. `SPEC.md`. The product brief for the app: four tiers, non-negotiables (section 2), stack (section 3: TypeScript, Next.js App Router, pnpm workspaces, Supabase), the eight phases, the Phase 8 web app screens (section 11) and the acceptance test (section 12). Everything you build must fit it.
2. `README.md` and `docs/CATALOG.md`. Phase 1 is merged: `packages/catalog` turns `data/Routing-Table_V3.xlsx` into `data/catalog.json` (210 items, 8 follow-up question types, 17 verdict templates, tone rules), and `packages/engine` has 95 hand-written item rules plus `toneLint()`. A teammate is on Phase 2 (`origin/phase-2/data-sources`: `apps/web` API routes, `packages/providers`, `packages/data`, a Supabase migration). Do not edit those packages; build beside them.
3. `docs/OPEN_QUESTIONS.md`. Team decisions and source conflicts. Add to it; never decide those yourself.
4. `public/index.html` and `docs/Design-Research.md`. The live landing page and the design rules it was built against (Impeccable, Emil Kowalski's motion rules, ConardLi). SPEC section 11 says the app uses the landing page's look. Its tokens, icon sprite, glass surfaces, motion rules and the dark "verdict explorer" panel are the house style.
5. `docs/Emotional-Positioning-Research.md` and the Tone Guide sheet (already in `catalog.json` as `toneRules`). Second person, under 60 words, no exclamation marks, banned words enforced by `toneLint`, never red, never a score about the person, effort named before the number, a missed tap is unknown and never failed.

## The prototype you are refining

https://oval-dill-03025795.figma.site, a phone-frame prototype in Cormorant Garamond and Manrope on a near-black and bronze gradient. Walk through it and screenshot every screen before you write anything. As of 2 October 2026 it has nine screens:

1. Splash: star glyph, "Distill your life.", "Not who they imagined. Who you are." (renders as "Distillyour life").
2. "Talk us through what you do for yourself." Free text with a speak option, button "Find my essentials", link "I'd rather choose them myself". The text does nothing yet; the next screen is hard-coded.
3. "What are you doing for yourself right now?" The inventory grouped as Movement, Supplements, Treatments, Devices, Rituals, Evenings; each item has a cost, a remove control and "Where did this come from?" (TikTok, a friend, a podcast, a doctor, an ad, can't remember); nudges between groups; button "This is everything".
4. "Tell us about the life you want." Free text with a starter line.
5. Five questions, one per screen: did a doctor put you on any of these; what would you never give up; magnesium dose and form; coffee timing; confirm the facial's cost.
6. Reveal: item names drift past, then "14 things. $750 a month. Most of it chosen for someone else's life."
7. "Here's what we heard": an italic letter reflecting the free text back, then "Who you are at your best" in three lines.
8. "Your stack, sorted": four coloured groups (Yours, Worth reading on you, Ready to let go, Your call), then "Three things you can let go of today" with reasons blurred behind "Private reading" and "$114 a month, back".
9. Membership: "A private invitation", a "private reading" card, what membership includes (monthly analysis, curated alternatives, quarterly private reading), $20 a month, Pay, Start membership, Not yet.

## What to keep and what to change

Keep: the one-question-per-screen pace, the inventory grouped by category with editable costs, the origin question (it feeds Protected when the answer is doctor or blood test, and is narrative otherwise), the follow-ups, the reveal, the four-group sort, and the writing's calm.

Change, because `SPEC.md` requires it:

- **Screens 2 and 3 become SPEC's "List your stack".** Search the 210 catalog items with fuzzy matching on name and aliases, prefill the monthly cost from the catalog, and use the chips doctor / blood test / friend / podcast / online / other. The free-text box can stay as a scratchpad that highlights catalog matches as you type, but the typeahead is the primary path until there is a model behind free text. Add the "connect your wearable" step before it (Oura, WHOOP, Fitbit, upload the Apple Health export, or "use demo data"), with backfill progress.
- **Screen 5 becomes SPEC's "Follow-ups".** Generate the questions from `followUpQuestions` and each item's rule in the catalog, chips per the Follow-up Questions sheet plus one number box for dose. Where a chip crosses a rule threshold (see `docs/OPEN_QUESTIONS.md`, THRESHOLD_CHIPS), ask for the exact value instead of a range. Under four minutes total.
- **Screens 6 to 8 become SPEC's "Day-one screen".** The four groups map to the four tiers and use the tiers' words: Protected ("we leave these alone"), Tested on you, No test needed (with the reason from the rule: dose too low, form not absorbed, overlapping, not being used), Can't measure it (with "run it anyway"). Day-one sentences come from the catalog, never written fresh. Overlaps show both items and ask which to keep. Nothing is blurred or gated. Rewrite "Most of it chosen for someone else's life" so it describes the stack, not the person. Screen 7's letter may only reflect what the person typed or chose; if there is no model behind it, drop it or template it from their "never give up" picks and goal.
- **Screen 9 goes.** SPEC section 11 forbids pricing, trial and guarantee copy in the app; billing sits behind `PRICING_ENABLED=false`. End onboarding on the day-one screen with the first experiment Distill would run and what the daily tap looks like. The prototype's "at least five things lighter in 60 days" and the landing page's "pay nothing unless something measurably moves" disagree; record that in `docs/OPEN_QUESTIONS.md` for the team.
- **Add the screens the prototype never reached**, from SPEC section 11: Today (one instruction line, Did it / Didn't, "don't count last night"), Verdict card (habit, number, swing, word, from the 17 templates), Your file (What you cut, What's yours, with the count and bill that go down), Settings (connected sources, export, delete everything).
- **Everywhere:** account by Supabase magic link, saved progress, back navigation that keeps answers, loading, error and empty states, a progress indicator that matches the real number of steps, a footer disclaimer on every screen, contrast at 4.5:1 or better (the prototype's muted text on dark fails), 44px targets, keyboard operation, reduced-motion paths, and every string through `toneLint`.

## How to build it

1. **Prerequisites on this Mac.** There is no Node, pnpm or Homebrew installed. Ask me before installing anything; the repo expects Node 24 (`.node-version`) and pnpm 10.34.6 (`package.json`). Then `pnpm install --frozen-lockfile`, `pnpm catalog:build`, `pnpm check` must pass before you change anything.
2. **Spec first, one checkpoint.** Write `docs/ONBOARDING.md`: the final screen list in order, the token sheet (a dark variant of the landing page's tokens if decision 1 says so), what each screen reads from the catalog and writes to Supabase, and every heading and button in final copy. Show me that before building. It is the only checkpoint.
3. **Branch `phase-8/web-ui` from `main`.** Build in `apps/web` on Next.js App Router, importing `@distill/catalog` and `@distill/engine`. Phases 3 to 7 (full routing, scheduling, statistics, simulation, verdict text) are not merged yet, so build the UI against typed fixtures shaped like SPEC's `RoutedStack`, `DayOneSummary` and verdict output, with a `demo` data source that reproduces the Worked Example (21 items, 10 drops, $767 a month back, 4 lined up for testing). Do not fork the routing logic into the UI; when `routeStack` lands, the fixtures are replaced, not the screens.
4. **Verify like the landing page was verified.** Every screen at 390 and 1440, keyboard only, reduced motion on, and the full click-through from onboarding to a verdict on demo data. Share screenshots.
5. **Small PRs, tests included, `pnpm check` green**, docs updated, open questions logged. Tell me what is ready; do not merge to `main` until I say so. Leave `public/` alone except, if the app needs a link from the landing page, propose the one line and where it goes.

## Decisions (answer, or accept the recommendations)

1. **Look.** SPEC says the landing page's look. The prototype is dark bronze with serifs. Recommendation: the landing page's system in a dark variant for the app (ink ground `#15211F`, mint `#9FD0C9` accents, glass panels, Sora and Geist Mono, Italiana wordmark), which the site's verdict explorer already uses, so the two feel like one product. Alternative: light `#FAFAF7` throughout, exactly as the site.
2. **Free text.** Scratchpad plus typeahead now (recommendation), or wire a language model for "Find my essentials" (needs an API key and a server route).
3. **The reveal.** Keep the "N things, $X a month" moment as the entry to the day-one screen (recommendation), or drop it.
4. **Demo first.** Build the full flow on the demo data source first and connect real Oura OAuth after Phase 2 merges (recommendation), or wait for Phase 2.
5. **Tooling.** Allow me to install Node 24 and pnpm on this Mac (recommendation: yes, via the official installer or nvm), or run the build somewhere else.
