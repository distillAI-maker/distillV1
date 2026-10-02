# Build prompt: Distill v1 (for Codex)

Commit this file to the repo root as `SPEC.md`. Commit the spreadsheet as `data/Routing-Table_V3.xlsx`. Then give Codex everything below the line.

---

## 0. Who you are and what we're building

You are the lead engineer on **Distill**. Distill is a web app for people who own a sleep or recovery wearable (Oura, WHOOP, Fitbit, Apple Watch, Garmin) and spend money on supplements, habits, devices, memberships and skincare. Distill does three things:

1. **Day-one audit.** The person lists everything in their "stack." Distill routes each item through our routing table and shows what can be dropped today without any test (dose too low, form not absorbed, tested and found to do nothing, no known mechanism, duplicates something else, not being used). It also shows the cost.
2. **On/off experiments.** For the few items a wearable can actually measure, Distill runs a single-person on/off experiment on the person's own nightly data. It then gives a verdict: **Kept**, **Dropped** or **Inconclusive**, always shown with the real number.
3. **A running file.** Distill keeps two lists: what the person cut, and the conditions their body does best under.

The product sells subtraction. It never sells more.

A marketing landing page already exists at https://distill-v1-tau.vercel.app/. Do not reuse its pricing or guarantee copy (see section 10). This repo is the actual app.

We have no users, no traffic and no real wearable data yet. Everything must work end to end on **synthetic data** first.

## 1. The source of truth: `data/Routing-Table_V3.xlsx`

Read the whole workbook before writing code. It is the product's brain and its voice. Sheets:

- **Start Here.** Explains the four tiers, the first-match routing order, how effect sizes were made, free stand-in tests, and what every column means. Read it fully. (The title says version 3, but it also documents "version 4" changes. Treat the file as one version and note the mismatch in the README.)
- **Items.** 210 rows × 38 columns, one row per item, with `Key` as the stable unique id. Important columns:
  - Cost per month/year
  - Can a wearable see it?
  - Which number we'd watch
  - Which way it should move
  - How fast it acts and clears
  - Expected effect (in units of a normal night-to-night swing)
  - Chance of a clear answer
  - Tier after the effect gate (what the engine uses)
  - Can we read it from their history?
  - On-days: assigned or observed?
  - Lowest dose worth testing
  - Evidence grade (A/B/C/D/N)
  - Follow-up question (trigger), Question wording, Answer options
  - Rule that flips the tier
  - Overlap group
  - Safety note
  - What the user reads on day one
  - Needs a fact-check? / What to check
- **Experiment Priority.** The runnable Tier 1 list, ordered by expected effect. It has three parts: runnable items, items queued as slow, and items gated as too small.
- **Goal to Number.** Maps each goal to the metric the test is judged on, or to a daily rating, or to "untestable."
- **Numbers we can watch.** Each metric with its unit, per-device availability, typical personal swing, and the detectable change. It also contains the plain-English statistical rules, under the heading "How 'measurable' is decided."
- **Verdict Templates.** Every verdict sentence, with `{placeholders}`.
- **Tone Guide** and **Emotional Positioning.** Hard rules on how text may sound, plus banned and allowed words.
- **Follow-up Questions.** The 8 question types, their wording, chip options, and which rows fire them.
- **Overlap Groups.** 19 groups and what happens when two or more items from one group are present.
- **Worked Example.** A 21-item stack routed by hand. **This is your golden end-to-end test.**
- **Summary.** Counts per tier, category and reason. Use these as data-validation assertions.

Current counts you should reproduce after ingest:

| Measure | Count |
|---|---|
| Tier after gate: `1` | 16 |
| Tier after gate: `1, queued (slow)` | 3 |
| Tier after gate: `1, queued (special design)` | 1 |
| Tier after gate: `3, effect too small` | 61 |
| Tier after gate: `2` | 47 |
| Tier after gate: `3` | 73 |
| Tier after gate: `P` | 9 |
| Rows flagged "Needs a fact-check" | 93 |
| On-days `observe only` | 9 |

## 2. Non-negotiables

These rules apply to every line of code and copy.

1. **Not a medical product.** The app never diagnoses, treats or prevents anything. It never claims what a substance does to a body. It only says what a habit did to a number, or what studies found. A footer disclaimer goes on every screen.
2. **Protected items are never rated, tested or suggested for dropping.** An item is Protected if it came from a doctor or a blood test, is a prescription or hormone, is a clinical service, or is tied to a diagnosed condition. It gets one sentence and no opinion. Safety notes can redirect an item to Protected (for example, mouth tape plus possible sleep apnoea, or 5-HTP plus an antidepressant).
3. **Observe-only items never get an assigned "on" day.** This covers alcohol, nicotine, cannabis, energy drinks and fat burners. We never tell anyone to drink, smoke or use. The app may assign "off" days and records "on" nights only when they happen.
4. **The metric and the pass line are locked before day one.** Store a pre-registration record when an experiment starts and make it immutable. It contains the item, metric, direction, alpha, schedule, and the personal swing estimate. The verdict must be computed only against that record. Write a test proving that the record cannot be edited after start.
5. **Tone Guide is law.**
   - Second person, active voice, under 60 words.
   - No exclamation marks.
   - Banned words: wasted, useless, scam, fell for, should have known, hack, optimise/optimize, biohack, guilty, cheat day, toxins, detox, and anything else on that sheet.
   - Never red. Never a score about the person. Effort is named before the number.
   - A missed tap counts as *unknown*, never *failed*.
   - Build a `toneLint()` function and run it in CI over every template and every generated verdict.
6. **Never invent evidence.** All evidence, effect sizes and copy come from the spreadsheet. If a row is ambiguous, leave a `TODO(team)` and route it conservatively, to Tier 3 with cost shown. Rows with `Needs a fact-check = yes` carry an `unverified` flag through to the API. Behind a feature flag, the UI can mark them as "being checked."
7. **No pricing, no guarantee copy.** See section 10.

## 3. Stack and repo layout

- **Language and framework:** TypeScript everywhere. Next.js (App Router), deployable to Vercel.
- **Database:** Postgres through Supabase, with Prisma or Drizzle as the ORM. Supabase also provides auth (email magic link).
- **Engine:** a **pure TypeScript package** with no I/O, so it can be unit-tested and later reused in a native app.
- **Tooling:** Vitest for tests, Zod for schemas, pnpm workspaces.
- **CI:** GitHub Actions running lint, typecheck, test and tone-lint on every PR.

```
/apps/web              Next.js app (UI + API routes)
/packages/engine       routing, scheduling, statistics, verdicts (pure, no I/O)
/packages/catalog      xlsx -> typed JSON ingest + validators
/packages/providers    wearable adapters (Oura, WHOOP, Fitbit, Apple export, manual/CSV, synthetic)
/packages/sim          synthetic person generator + Monte Carlo power harness
/data                  Routing-Table_V3.xlsx (source of truth), generated catalog.json
/docs                  README, ALGORITHM.md, DATA_SOURCES.md, OPEN_QUESTIONS.md
```

## 4. Phase 1: catalog ingest (`packages/catalog`)

1. Write a script `pnpm catalog:build` that reads every sheet with SheetJS. It should write `data/catalog.json` plus typed exports: `Item`, `Metric`, `Goal`, `OverlapGroup`, `FollowUpQuestion`, `VerdictTemplate` and `ToneRules`.
2. Normalize the enum-like text columns into enums:
   - Tier after gate → `T1 | T1_QUEUED_SLOW | T1_QUEUED_SPECIAL | T3_TOO_SMALL | T2 | T3 | PROTECTED`
   - Visibility → `yes | partial | no`
   - Speed → `fast | slow`
   - On-days → `assign | observe`
   - Evidence grade → `A | B | C | D | N`
   - Follow-up trigger → one of the 8 types
   - Parse "Expected effect" to a number or null.
3. **Translate "Rule that flips the tier" into code.** This column is natural language (example: "form = oxide or spray → Tier 2 (form not absorbed). … dose under 200 mg elemental → Tier 2 (dose too low)"). Do not try to parse it at runtime. Hand-write `packages/engine/src/rules/` with one typed rule function per item `Key` that has a rule. Write a unit test per rule that quotes the original sentence in the test name. Rows with "Routes on the item name alone" need no rule.
4. Add validators that fail the build on any of the following:
   - duplicate keys;
   - unknown enum values;
   - an overlap group naming an item that doesn't exist;
   - a verdict template with an unknown placeholder;
   - tier counts that don't match the Summary sheet;
   - a T2 row with no reason.

## 5. Phase 2: data sources (`packages/providers`)

The goal is that **users never log their nightly data by hand**. Everything is pulled from their wearable platform. Platform reality, which you must verify against current docs before building and record in `docs/DATA_SOURCES.md`:

- **Apple Health (HealthKit)** can only be read by a native iOS app. A website cannot read it.
  - For v1, support **uploading the Apple Health `export.zip`**, parsing `export.xml` in a streaming way.
  - Leave a clean adapter interface so a future iOS companion app can push the same data through the API.
- **Google:** Google Fit's APIs are being shut down. Health Connect is on-device on Android only, so it also needs a native app.
  - The realistic web path for Google is the **Fitbit Web API** (OAuth). Check its current status and any migration notice from Google.
- **Oura:** API v2, OAuth. Pull sleep, readiness, workouts and tags.
- **WHOOP:** developer API, OAuth. Pull sleep, recovery, cycles and workouts.
- **Garmin:** Health API requires partner approval. Stub the adapter and document the application steps.
- **Manual / CSV import:** keep this as a fallback only.
- **Synthetic:** see Phase 6.

Every adapter implements:

```ts
interface Provider {
  id: 'oura' | 'whoop' | 'fitbit' | 'apple_export' | 'garmin' | 'csv' | 'synthetic';
  fetchNights(userId, from: Date, to: Date): Promise<NightRecord[]>;
  fetchWorkouts(userId, from, to): Promise<Workout[]>;   // with start time
  fetchTags?(userId, from, to): Promise<Tag[]>;           // Oura/WHOOP tags (alcohol, caffeine, supplements)
}
```

`NightRecord` is keyed by the person's local "sleep date." It holds the metrics from **Numbers we can watch**. Each field is nullable when the device doesn't report it:

- total sleep
- sleep latency
- deep sleep
- REM sleep
- wake after sleep onset
- sleep efficiency
- overnight HRV
- resting heart rate
- breathing rate
- skin-temperature deviation

Also store `source`, `deviceModel` and a raw-payload pointer.

Implementation rules for providers:

- Backfill all available history on connect. The history is what powers the day-one hypotheses.
- Sync daily with a Vercel cron job.
- Encrypt OAuth tokens at rest.
- Build a "delete all my data" endpoint that actually deletes everything.

## 6. Phase 3: routing engine (`packages/engine/route`)

`routeStack(inventory, answers, history?) → RoutedStack`

The function implements the **first-match order from Start Here** exactly:

1. **Protected?** Stop if so.
2. **Safety note?** Attach it. It may redirect the item to Protected.
3. **Goal known?** If the goal is "general health" or "nothing specific," route to Tier 3 with cost shown.
4. **Settled without a test?** Check these in order:
   1. the item's follow-up rule (dose, form, evidence N for the goal, no mechanism) → T2 with reason;
   2. usage checks (last used over 30 days ago, or still paying and not using) → T2 "not being used";
   3. overlap groups (two or more from one group) → T2 "overlaps with something else" for the item used less. Always return both items so the UI can ask which to keep.
5. **Visible, fast, and effect ≥ 0.8?** Route to T1. Order the T1 list by expected effect, largest first.
6. **Visible, fast, and effect < 0.8?** Route to T3 "too small to see in two weeks," with `canRunAnyway: true`.
7. **Visible but slow?** Route to T1 queued. Never run 3-day blocks on it.
8. **Everything else:** T3. Offer a daily rating only if Goal to Number says so.

Also:

- Apply the per-person effect adjustments described in the "Where the effect estimate comes from" column. For example, mouth tape uses 0.8 if the person snores; air purifier uses 0.7 for allergy sufferers.
- Return a `DayOneSummary` that matches the Worked Example: items on arrival, monthly total, drops today with $ back, lined up for testing, can't-measure, keep.
- **Golden test:** encode the Worked Example's 21 items and tapped answers. Assert every landing and the totals (10 drops, $767/month back, 4 lined up for testing). If the sheet's own numbers disagree with each other, fail with a clear message rather than fudging. (For example, the "Stack on arrival" row lists $1,428, but the prose says $1,342.)

## 7. Phase 4: experiment engine (`packages/engine/experiment`)

The team needs **you to design this algorithm** and document it in `docs/ALGORITHM.md`. Below is the required starting design. Improve on it only with simulation evidence from Phase 6.

**Selection.**
- Candidates are the person's runnable T1 items.
- Rank by `adjustedExpectedEffect × dataQuality × (history hypothesis strength, if any)`.
- The person can veto once per cycle and can switch mid-test.
- One variable at a time, never two concurrent experiments.
- Observe-only items become **observational** experiments. Assign "off" nights only, record "on" nights when they happen, and label the result as observational in the verdict.

**Baseline.**
- 7 days of watching before the first experiment. No instructions during this time.
- Skip the baseline if there are ≥ 28 nights of usable history.

**Schedule.**
- 14 days, starting on a Monday, so weekends spread evenly.
- Use 3-day blocks. The order of on/off blocks must be **randomized within balanced constraints** (equal on and off nights, max 2 consecutive same-condition blocks), using a stored seed. Randomization is what makes the statistical test valid.
- 14 doesn't split into 3s. Make block length and total days config values. Document the exact layout chosen, for example `[3,3,3,3,2]`.
- Config flag `dropFirstNightOfBlock` (default on for items with carryover, such as REM rebound after alcohol or cannabis).

**Daily loop.**
- Each morning there is one instruction line (usually a skip). The person gives one tap: `did | didnt`. No tap means `unknown`.
- Where the wearable already records the behavior (workout start time, wake time, nap), infer compliance automatically and don't ask.
- The person can flag a night as not counting: ill, travelling, kids woke me, unusually hard session.

**Day-one hypothesis from history.**
- For items readable from history (workouts, wake times, tags, and the alcohol signature of HRV↓ + RHR↑ + temperature↑ together, which must be confirmed by the user), compare past on-nights with off-nights.
- Show the comparison using the "day-one hypothesis" template. Always label it a hypothesis, because those nights weren't randomized.

## 8. Phase 5: statistics (`packages/engine/stats`)

Plain-English rule from the sheet: on-nights vs off-nights. The verdict is decisive only if the difference, in the pre-stated direction, would occur by chance about 1 time in 20. Implement it like this:

1. **Personal swing.** Estimate each metric's night-to-night variability from the baseline plus all off-nights, using a robust SD (MAD × 1.4826). For HRV, work in log space or percent of the personal mean, because the swing grows with the average. Exclude flagged nights. Exclude latency > 60 min as artifact, per the sheet.
2. **Effect.** Compute the mean on-nights minus the mean off-nights, in real units and in swing units.
3. **Test.** Run an exact **randomization test** over all balanced block assignments the scheduler could have produced. Use a one-sided test in the pre-registered direction with α = 0.05. Also report a bootstrap 90% interval.
   - Before choosing this method, check whether nightly autocorrelation breaks the test, using the simulator. If it does, use a block-level permutation.
4. **Minimum data.** Require at least 5 valid nights per side. Otherwise the verdict is Inconclusive (insufficient nights), and that counts as a real answer.
5. **Verdict.**
   - p < α and the effect is in the "good" direction → **Kept**.
   - p < α and the effect is in the "bad" direction for an item the person does → **Dropped**.
   - Otherwise → **Inconclusive**.
   - Write a decision table in `ALGORITHM.md` for every combination of item direction and result. For example, a "Two-coffee ceiling" is a habit where the on-condition is the restriction.
6. Never show a p-value to the user. Show the number, their swing, and the word.

## 9. Phase 6: simulation and power (`packages/sim`)

This phase is how we check that the algorithm works before we have users.

- **Synthetic people.** Generate nightly metrics with a realistic per-person mean, the swing from "Numbers we can watch," AR(1) autocorrelation, a weekend effect, occasional illness nights, missed taps and device noise.
- **Injected effects.** Inject a true effect of a chosen size (in swing units) on on-nights.
- **Monte Carlo harness.** For effect sizes 0 → 2.0, block layouts, baseline lengths and missed-tap rates, report the following:
  - false-positive rate at effect 0, which must be ≈ 5% or less;
  - probability of a decisive verdict;
  - wrong-direction rate.
- **Outputs.** Write `docs/POWER.md` with tables and one chart. **Use this to confirm or revise the 0.8 gate and the "good / fair / low" labels in the spreadsheet.** The sheet claims 0.8 gives roughly a one-in-three chance of a clear answer and 1.2 better than even. Verify these claims and report.
- **Demo users.** `pnpm seed:demo` creates 3 demo users with 6 months of synthetic history and a stack based on the Worked Example, so the whole app can be clicked through with no wearable.

## 10. Phase 7: verdict text (`packages/engine/verdict`)

- Fill the **Verdict Templates** exactly. Placeholders include `{item}`, `{number}`, `{change}`, `{swing}`, `{months}`, `{annual}`, `{dose}`, `{threshold}`, `{other}`, `{cost}`, `{hook}`, `{fraction}` and the "where it came from" clause.
- Round numbers sensibly: minutes and ms as integers; bpm to 0.5.
- Every generated string must pass `toneLint()`. Snapshot-test one output per template.

## 11. Phase 8: web app (`apps/web`)

Keep the UI calm and simple. Use the landing page's look (off-white `#FAFAF7`), and follow the frontend skill and design guidance in this repo if present. Never use red for results.

1. **Connect.** Pick a provider (Oura, WHOOP, Fitbit, upload Apple Health export, or "use demo data"). Show backfill progress.
2. **List your stack.** Search over the 210 items with fuzzy matching on name and aliases. Prefill the monthly cost from the catalog, editable. Ask "where did it come from?" with the chips doctor / blood test / friend / podcast / online / other. Doctor or blood test means Protected.
3. **Follow-ups.** Only the questions the routing table fires, using chips per the Follow-up Questions sheet, plus one number box for dose. Prefill from wearable or calendar data where possible. Target: under 4 minutes total.
4. **Day-one screen.** "N things, $X a month. K come off today, $Y a month back. M lined up for testing." Show each item's sentence. For overlaps, show both items side by side and let the person choose which to keep.
5. **Today.** One instruction line, two buttons (Did it / Didn't), and an optional "don't count last night."
6. **Verdict card.** Shows the habit, the number, their swing and the word, using the template text.
7. **Your file.** Two lists, "What you cut" and "What's yours," plus a stack count and monthly bill that go down over time.
8. **Settings.** Connected sources, export my data, delete everything.

**Billing.** Not built. Add a `PRICING_ENABLED=false` feature flag and an empty `billing/` module with a TODO. **Do not write any copy about price, free trials, or a pay-nothing guarantee anywhere in the app.**

## 12. Working style and acceptance

- Work in small PRs, one phase each. Every PR includes tests and updates the docs. Update `docs/OPEN_QUESTIONS.md` whenever you hit a decision that belongs to the team; don't guess.
- **Phase 1–5 done** means:
  - the catalog build passes all validators;
  - the Worked Example golden test passes;
  - the simulator shows a false-positive rate ≤ 5% at effect 0;
  - every template passes `toneLint`.
- **v1 done** means a stranger can run `pnpm i && pnpm dev`, choose "use demo data," and click from onboarding to a day-one screen to a completed experiment verdict. Real Oura OAuth must also work against a test account.

## 13. Open questions for the team (do not decide these yourself)

- **Pricing model and amount.** Is there a guarantee at all?
- **Fact-checking.** Who signs off on the 93 rows flagged for fact-checking, and do unverified Tier 2 drops appear to users before sign-off?
- **Apple Health.** When do we build the native iOS companion for live data, replacing the export upload?
- **Google/Fitbit.** Is Fitbit Web API access confirmed for the launch window?
- **Effect estimates.** The effect numbers are literature estimates. Who updates them once real verdicts accumulate? (A future feature could pool anonymized verdicts to update priors.)
- **Sheet inconsistency.** The day-one total in the Worked Example is inconsistent ($1,428 in the table vs $1,342 in the prose).
