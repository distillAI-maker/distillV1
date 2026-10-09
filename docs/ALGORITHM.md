# Routing, experiment and statistics algorithms (Phases 3–5)

> **Superseded for verdicts (2026-10-08).** New experiments decide with the estimate-based policy in [ALGORITHM-IDENTITY.md](ALGORITHM-IDENTITY.md), measured in [DECISION-POWER.md](DECISION-POWER.md). The exact randomization test below still runs for experiments registered before that date. The routing sections remain current, with the order changes listed under "Algorithm identity" in [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md).

This document covers day-one stack routing, experiments, statistical analysis and the Phase 6 findings. [POWER.md](POWER.md) contains conditional simulation evidence. The 0.8 threshold remains a candidate-priority rule; it cannot promise a two-week result.

## Contract

`routeStack(inventory, answersById, options?)` is exported from `@distill/engine`. It reads no database, calls no provider, and changes none of its inputs. Its default catalog is the generated workbook JSON. `createStackRouter(catalog)` supports testing a reviewed source revision.

Each inventory entry has a unique `id`, a catalog `key`, and an optional editable `monthlyCost`. Two products may share a catalog key but must have different inventory IDs. Answers and overlap choices use inventory IDs. Unknown ordinary items, duplicate IDs, invalid costs, unknown answer IDs, and invalid keeper choices fail explicitly. An explicitly Protected custom item, including a wearable data source, may have a key outside the catalog.

```ts
import { routeStack } from '@distill/engine';

const result = routeStack(
  [
    { id: 'magnesium', key: 'magnesium-any-form', monthlyCost: 22 },
    { id: 'coffee', key: 'coffee-after-2pm', monthlyCost: 0 },
  ],
  {
    magnesium: { goal: 'sleep', form: 'citrate', dose: 120, doseUnit: 'mg elemental' },
    coffee: { goal: 'sleep', time: '2 to 5pm' },
  },
);
// Magnesium: T2, dose too low. Coffee: T1. Monthly amount back: 22.
```

## First-match order

1. Stop for Protected provenance, a Protected catalog row, or a declared data source. A doctor/blood-test source, prescription, hormone, clinical service, or diagnosed condition takes precedence over every recommendation.
2. Apply the item-specific safety redirects from the Phase 1 rules. Attach the source safety note to non-Protected results. Mouth tape with a contraindication and 5-HTP with an antidepressant cannot reach a test or a drop recommendation.
3. Require a recognized goal. General health, longevity, or nothing specific is T3, with cost shown. Unknown or missing goals require an answer. The goal map's hormone/clinician boundary is Protected.
4. Apply settled item rules, then usage, then overlap decisions. Dose/form/evidence decisions win over an unused-item reason. Exact last use over 30 days or a confirmed zero-use paid subscription triggers the global usage rule; explicit row thresholds from Phase 1 still apply. A broad month chip is never replaced with a guessed day count.
5. A supported wearable metric, fast action, and adjusted effect ≥ 0.8 produce runnable T1. The queue sorts by adjusted effect descending, breaking ties by inventory ID.
6. The corresponding fast effect below 0.8 produces `T3_TOO_SMALL`, with `canRunAnyway: true`. Zero and unknown effects remain different; a missing estimate is a source-review case.
7. Slow and special-design items enter separate queues. They never become ordinary three-day-block candidates.
8. Remaining items are T3. Unconditional source keep statements and explicit item-rule keeps are retained. A daily rating is offered only when the selected goal permits one.

Missing item answers and documented source ambiguities stay conservative. A separate, fully established global usage fact can settle an item without inventing its missing dose or form. Earlier Protected, general-health, excluded, settled, or ambiguous results are not overturned by a generic overlap comparison.

## Goal and effect handling

Goal aliases are explicit mappings to **Goal to Number**, not fuzzy clinical interpretation. The row's first recognized metric is the default for general sleep. A specific measurable goal must match a supported row metric; a metric override from an item rule cannot bypass an invisible goal. Routing supplies candidates, not a locked experiment or a computed verdict. Starting an experiment requires an explicit direction and definitions of both conditions; ambiguous workbook direction text is not guessed.

The existing hand-written item rules supply the source adjustments: mouth tape with snoring 0.8, allergy/traffic air purifier 0.7, blocked-nose strips 0.7, noisy-room earplugs 1.0, hot-sleeper cooling pad 0.9, close-to-bed dinner 0.8, and a hot bedroom 1.0. Phase 4 can supply a separate history hypothesis; it never turns that comparison into randomized evidence.

The `unverified` flag is preserved on every routed catalog item, including Protected items. `onDays: observe` is also preserved. Routing never assigns an on-day.

## Overlaps

All 18 source groups have explicit policies in `route/overlaps.ts`. Membership alone is insufficient to drop an item. Comparisons retain all participants, including products already settled for another reason. Eligible survivors determine the recommendation, so a rejected low-dose fish oil cannot cause a viable krill oil to be dropped.

| Source group                                       | Policy                                                                                                                                                                        |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fitness memberships                                | Compare gym/studio usage; a fitness app alongside an attended gym is permitted. Unknown use or ties need a keeper choice. The app/unused-gym exception remains a review case. |
| Heat and cold                                      | Require confirmed equivalent home equipment before calling a studio a duplicate; compare two studios by use.                                                                  |
| Massage; wake-up light                             | Show the group and cost, with no automatic duplicate drop.                                                                                                                    |
| Meditation apps                                    | Suggest the less-used app; ties or missing counts require a choice.                                                                                                           |
| Wearables; magnesium                               | Require an explicit keeper choice, using separate inventory entries for separate products. A combined catalog row does not invent a second product identity.                  |
| Daily multivitamin                                 | Separate vitamin drops require confirmation that the base product contains that vitamin's studied dose; Protected vitamins are excluded.                                      |
| Omega-3; collagen                                  | Recommend source-defined fish oil/powder where an eligible keeper exists.                                                                                                     |
| Caffeine before training                           | Require confirmed coffee timing within an hour before calling pre-workout a duplicate. No combined caffeine amount is invented.                                               |
| Sleep aids                                         | Melatonin plus gummies can settle the gummies; otherwise show the group. Never claim sleep stayed unchanged without history.                                                  |
| Electrolytes                                       | A valid electrolyte product can settle the duplicate sports-drink row.                                                                                                        |
| Bloodwork                                          | A physical can be a reference-only Protected participant. Only the subscription is evaluated, and only with the extra-tests answer.                                           |
| Exfoliants; hydrating layers                       | Require the actual same-night/routine/ingredient answers. Conflicting conditional rows remain pending source review.                                                          |
| Professional skin treatments; at-home skin devices | Show the comparison and flag undefined “least”/weekly cutoffs. Known old use is already handled by usage rules.                                                               |

Each decision returns `itemIds`, comparisons, total cost, proposed `dropIds`, a keeper where defined, missing answers, and a status: `suggested`, `confirmed`, `pending`, or `informational`. A source-defined recommendation can be overridden by an explicit keeper choice within that comparison. Informational and conditional groups cannot be converted into a drop merely by passing an arbitrary keeper ID.

These are proposed day-one recommendations, not persisted user removals. Savings reflect the proposed drop list; the app must distinguish recommendations from items the person actually removed.

Eligible participants in a pending overlap stay T3 until the missing comparison answers are supplied. They do not enter the test queue or receive a run-anyway option while a possible duplicate exposure remains unresolved. Informational groups keep their independently determined routes.

## Accounting and Protected output

Costs are rounded and summed in cents. Monthly and annual savings use the person's edited costs, not the catalog default when an override exists. Every arrival belongs to exactly one output bucket: dropped, runnable, queued, cannot measure, keep, Protected, or excluded. Excluded items are retained for audit and counted separately; their entered cost remains in the arrival total.

Protected routed records contain identity, tier, routing step, and provenance flags, with no cost, rating, effect, safety opinion, or recommendation. Protected participants are excluded from comparisons except the reference-only physical in the bloodwork policy. Their monetary contribution appears only in the aggregate total when `includeProtectedInSummary: true` is supplied. Submitting the entry places it in the arrival count.

## Worked-example acceptance

`route/worked-example.ts` encodes the 21 source entries and all row-level expected outcomes, including the editable costs and Protected Oura source. Fixture goal intents are declared where needed, but missing fish-oil intent and missing workout intensity/bedtime information are not guessed. The fixture is not synthetic history or a demo account.

Run `pnpm routing:golden` for the strict acceptance check. **It currently exits 1**, with per-item and summary diagnostics, because the supplied source is unresolved:

- Table/line-item spending is $1,428; prose says $1,342.
- The table says two cannot-measure items; prose says three.
- First-match instructions sort by effect; the example puts coffee ahead of alcohol.
- Conditional goal notes conflict with name-only rule text for memberships and skincare. Those items remain T3 with a `COLUMN_CONFLICTS` flag, unless an earlier independent rule settles them.
- Fish oil has a dose but no specific goal in the example. A general-health goal would stop before the dose floor.
- Training ends at 9pm, but the example does not provide the vigorous/intensity and time-to-bed answers required by its rule.

`pnpm check` includes regression tests proving these conflicts fail acceptance clearly. A green regression suite **does not mean the worked example passed**. The strict check remains separate so routine CI can verify conservative behavior while the source is being reviewed. Keep the original workbook unchanged until a reviewed revision or explicit team decision is available; then update ingestion, fixtures and expected outcomes together.

## Validation

Routing tests cover first-match precedence, safety, goals, effect boundaries and personal adjustments, queues, observe-only flags, conditional/selected overlap decisions, exact accounting, input rejection, input immutability, summary buckets, and strict source rejection. Existing catalog, provider, database and API tests continue to run under `pnpm check`.

Phases 4–5 checks are described below. Phase 6 measures power, interval coverage and false positives under declared assumptions. Failures and remaining product decisions are recorded in [POWER.md](POWER.md).

## Phase 4 contract and selection

`@distill/engine/experiment` exports pure functions for candidate selection, baseline assessment, scheduling, pre-registration, daily check-ins and history hypotheses. The root engine export exposes them too. Functions leave inputs unchanged; schedules, baselines, registrations, check-ins and comparison outputs are copied and deeply frozen. There is no clock, database, provider or random-entropy I/O inside the engine.

`rankCandidates` accepts only resolved, non-excluded runnable T1 items. Score is adjusted expected effect × selected-channel data quality × history strength, with a strength of 1 when no hypothesis exists. Zero-quality candidates are omitted; ties use inventory ID. The cycle permits one veto, after which the next eligible candidate is selected. A switch closes the old experiment and creates a fresh registration; it cannot change the old test's metric or schedule. Pure helpers reject concurrent active experiments, and database transactions enforce that constraint across concurrent requests.

The eventual server must derive candidates from the authenticated person's inventory and router results. These library contracts do not authorize accepting a client-supplied T1 result or registration. Phase 4 does not add experiment HTTP routes or screens; Phase 8 will connect the library and repository to those flows.

## Baseline and locked measurement

`planBaseline` watches seven calendar days without instructions, unless at least 28 usable prior nights are available. After seven days, at least five usable nights and a positive personal swing are required; otherwise status remains insufficient and further watching is needed. History is assessed only through the supplied local date. Duplicate usable dates are rejected.

Measurements use one source/device channel. HRV additionally requires one known method, so SDNN and RMSSD never mix. Missing and non-finite values, flagged nights, latency over 60 minutes and nonpositive HRV are excluded. Personal swing is MAD × 1.4826, in log space for HRV and real units for other metrics. The selected dates and swing estimate are saved with the baseline.

`startExperiment` requires a ready baseline assessed on the local registration date. It locks item identity, the unverified flag, metric, predicted direction of on-minus-off, alpha 0.05, explicit on/off definitions, data channel, baseline, personal swing, behavior rule and complete seeded schedule. On may mean following a restriction, such as a coffee ceiling; it does not always mean consuming something. The first activity date is the next Monday, including today when registration occurs on Monday.

The baseline swing is an immutable pre-test reference. Phase 5 estimates swing from baseline plus actual off-nights for its analysis, but cannot overwrite this saved reference or retrospectively change the pass line. New registrations also save raw baseline values and the test policy described below. Legacy registrations retain their original policy.

## Schedule and exact assignment space

The example `[3,3,3,3,2]` cannot split into seven nights per side. The normal default instead uses four three-day blocks and two one-day blocks. Carryover needs a different layout: dropping six block-first nights would leave fewer than five nights per side, so its default uses two three-day and two four-day blocks. These choices reconcile the stated constraints; they are not improvements justified by simulation.

| Configuration                                | Block lengths               | Assigned on/off | Usable capacity per side | Eligible assignments | Smallest possible one-sided p |
| -------------------------------------------- | --------------------------- | --------------- | ------------------------ | -------------------- | ----------------------------- |
| Default 14 days                              | `[3,3,3,3,1,1]`             | 7 / 7           | 7 / 7                    | 6                    | 1/6                           |
| Default 14 days with carryover               | `[3,3,4,4]`                 | 7 / 7           | 5 / 5                    | 2                    | 1/2                           |
| Explicit 28-day configuration with carryover | `[3,3,1,3,3,1,3,3,1,3,3,1]` | 14 / 14         | 8 / 8                    | 22                   | 1/22                          |

`enumerateAssignments` lists the full support: equal assigned nights, no three consecutive same-condition blocks, at least five nights per side after carryover exclusions, and a weekend-night difference of at most one. `createSchedule` selects from this space using a stored uint32 seed and rejection sampling. The caller must generate the seed from server-side secure entropy and save it; the user must not choose among schedules. Revalidation reproduces the complete schedule from its seed and saved configuration, with algorithm version 1.

Total days, block length, explicit block lengths, minimum nights and carryover are configuration values. Invalid or infeasible layouts fail, rather than silently becoming unbalanced. Alcohol and cannabis default to dropping each block's first night. Each activity date maps to the following morning's `sleepDate`, matching the provider wake-date convention and handling daylight-saving changes as local calendar dates.

**Neither 14-day randomized default can reach the required p < 0.05 using its exact assignment space.** The schedule saves assignment count, minimum attainable p and a limitation flag. Phase 5 must respect that resolution and cannot declare a decisive result from these schedules. The explicit 28-day example shows a feasible larger support, not validated power or a revised product default. Phase 6 must evaluate autocorrelation, carryover, missing nights and power before changing the protocol.

Observe-only items receive `off` or `observe` slots, never assigned `on`. Actual on-exposure is recorded only when it naturally happens. All nine source observe-only keys are guarded when registrations are reloaded. These records are labeled observational, have no randomized-exposure p resolution, and do not guarantee enough actual on-nights for a comparison.

## Daily loop and historical hypotheses

`dailyInstruction` returns one tone-checked instruction line and whether a tap is needed. During baseline or outside the schedule it gives no experiment instruction. A `did` / `didnt` tap is translated using the saved condition; an explicit exposure can also be supplied. A missing tap and absent confirmed inference mean unknown, never off. On an observation slot, a tap alone cannot establish that the exposure happened.

Confirmed workout timing, wake-window or nap observations can establish exposure without a tap. The saved behavior rule maps a match to on or off: for example, a late nap maps to off when on means avoiding late naps. Missing workouts or naps establish the opposite condition only when the input establishes complete coverage of the relevant window; otherwise they stay unknown. The current primary-sleep provider contract does not supply nap episodes, so nap inference needs separately recorded episodes or a manual check-in. Illness, travel, children waking the person and an unusually hard session are exclusion flags. Carryover-excluded days still record compliance but cannot enter the analysis.

History helpers compare confirmed on/off nights within the same measurement channel, requiring at least five per side. They return real-unit means, their difference, a standardized difference and hypothesis strength. The item-aware wrapper rejects Protected, excluded and unresolved items and preserves `unverified`. Comparisons are labeled hypotheses with `randomized: false`; there is no p-value or kept/dropped verdict. Tags require explicit on/off evidence; absence of a tag is unknown.

The alcohol signature requires HRV below, resting heart rate above and temperature deviation above a supplied personal reference together. It remains an unconfirmed suggestion until the user confirms or rejects it. Signature-only observations cannot enter a history comparison or replace a daily tap.

## Persistence and validation

`ExperimentRepository` in `@distill/data` stores cycles, immutable experiment registrations and check-ins. Apply `supabase/migrations/202610020002_phase_four.sql` after the Phase 2 migration. No live migration has been applied by this implementation.

An account-row lock and partial unique index allow only one active experiment per user. Owner-bound cycle foreign keys prevent cross-account attachment. Switching closes and starts records atomically; a failed new start rolls back the close. A database trigger rejects changes to locked registration JSON, identity and start time, even through raw SQL. Another trigger prevents resetting a used veto. Check-ins may be corrected while active; future check-ins and edits after closing are rejected. Completion waits until the final wake date. Closed experiments cannot reopen.

The new tables enable RLS with no direct browser table access; server operations require the verified owner's ID. Account deletion cascades through registrations, cycles and check-ins, and a deleting account cannot create new experiment records.

Tests cover the complete schedule support and reproducibility, invalid layouts, carryover capacity, p-resolution limits, baseline gating and log-HRV, selection/veto/switching, locked registration tampering, all observe-only keys, missing versus inferred compliance, exclusions, history coverage and confirmation. PGlite executes the real migrations and verifies SQL immutability, concurrent-active constraints, rollback, ownership, browser access restrictions and deletion cascades. Simulation, demo people and rendered hypothesis/verdict templates remain for Phases 6–7.

## Phase 5 contract

`@distill/engine/stats` exports `analyzeExperiment`, `exactRandomizationTest`, `bootstrapInterval`, and `experimentResultCard`, plus their types. The root engine export also exposes them. The code is pure TypeScript: no provider/database reads, clock, global random state or runtime dependencies are introduced. Analysis and presentation outputs are detached and deeply frozen.

```ts
import { analyzeExperiment, experimentResultCard } from '@distill/engine/stats';

const analysis = analyzeExperiment({
  registration: savedExperiment.preRegistration,
  nights: normalizedNights.map((night) => ({ night })),
  checkIns: savedCheckIns.map(({ entry }) => entry),
  through: localWakeDate,
});
const card = experimentResultCard(analysis);
```

The server must load the authenticated owner's saved registration/check-ins and derive the local date. It must not accept a client-authored registration, verdict, p-value or future date. Phase 5 supplies the library and UI payload contract; experiment HTTP routes, persistence of rendered results and screens are not introduced here.

Results now carry `validation: simulation_evidence_available`. This points to the conditional evidence in [POWER.md](POWER.md), not universal or real-user validation. The internal bootstrap remains available for analysis, but the public card hides it because tested coverage is insufficient in some profiles.

## Locked policy: benefit only versus both directions

The brief's single beneficial-tail test cannot also justify an opposite-tail drop. The project owner approved testing both help and harm for **new** experiments, while preserving saved rules for existing experiments. `startExperiment` now saves `testPolicy: both_directions` by default. An explicitly pre-registered `benefit_only` policy is also supported; a legacy record without the field means benefit only. The existing immutable-JSON database trigger prevents changing this policy after start.

`direction` remains the beneficial direction of **on minus off**, regardless of whether on is taking a product or following a restriction. Alpha stays 0.05 overall. Benefit-only tests use p < 0.05 in that direction. Both-direction tests split the budget: p < 0.025 in the beneficial tail for Kept, or p < 0.025 in the opposite tail for Dropped. No tail is selected retrospectively at 0.05. Splitting the budget follows the [Bonferroni rule](https://online.stat.psu.edu/stat503/Lesson03); it controls either-tail rejection under the test's null assumptions, not an untested claim about effect-estimation accuracy.

For Kept, retain the saved **on condition**. For Dropped, discontinue that condition in favor of the saved off condition. Thus a beneficial two-coffee ceiling is kept as a restriction; the word does not authorize dropping the underlying coffee item when the tested on condition was avoiding it.

## Measurements and personal swing

Only saved schedule wake dates through the requested cutoff enter the experiment comparison. The saved source/device and HRV method select one channel. Duplicate check-ins or channel/date measurements, mismatched carryover flags and inconsistent persisted usability fail explicitly. Future schedule nights, block-first carryover nights, any exclusion flags, missing/unknown exposure and unavailable measurements are excluded. Latency > 60 minutes and nonpositive HRV remain artifacts. Missing taps are not off-nights.

The minimum is the saved `minimumNightsPerSide`, never below five. Comparison means use actual confirmed on/off exposure. For randomized inference, those usable exposures must match the saved assignment. A contrary exposure makes the result Inconclusive with `noncompliance`, retains the descriptive means, and suppresses the randomization test. Relabeling noncompliant exposure or testing only selected adherent nights would not preserve the assignment mechanism. A future intention-to-treat or noncompliance estimator requires a separately defined protocol.

Analysis swing is MAD × 1.4826 from **locked baseline values plus all valid actual off-nights**, excluding flagged nights. Raw baseline values are now snapshotted with their dates when baseline assessment is saved; registration revalidation recomputes the MAD. Starting a new experiment requires that snapshot, so an old baseline plan must be reassessed before reuse. Provider corrections cannot silently replace the snapshot. Old experiment records without raw values require baseline history on the original saved dates/channel with the same saved MAD; missing or changed evidence yields `baseline_unavailable`. Matching a legacy MAD does not prove the raw historical values are identical, since those records did not save them.

Real means and on-minus-off difference are always returned in metric units. For HRV, swing, the test statistic and standardized difference use log measurements: `(mean(log(on)) - mean(log(off))) / logSwing`. Other metrics use raw difference divided by raw swing. If raw and log effect directions disagree, the result is Inconclusive with `effect_direction_disagreement`; a verdict must not contradict the real-unit number shown. A zero pooled MAD leaves swing units undefined and prevents a decisive verdict; no invented variance is substituted. The locked pre-test swing is preserved separately. UI HRV swing is reported as `100 × (exp(logSwing) - 1)` percent, a multiplicative variability reference, while the actual change remains in milliseconds.

## Exact block randomization and uncertainty

The statistic is mean on minus mean off, using log values for HRV. `exactRandomizationTest` reconstructs the saved version-1 schedule and enumerates **every assignment the scheduler could have generated**, with its original equal weight. It keeps outcomes, temporal order, block identities, carryover and other exclusions fixed, then changes only block conditions. It does not shuffle independent nights. Both directional tails include ties and the observed assignment; exhaustive p-values are extreme-assignment count / total assignment count, without a Monte Carlo correction or a zero p-value.

This is randomization inference for the sharp null of no effect, using the actual assignment mechanism. Temporal correlation does not make nights independent; retaining the full randomized block design avoids pretending they are. A sharp-null test is not a general exact test of every zero-average-effect model. The distinction and assignment-based tail counting are described in [Berkeley's randomization-test notes](https://www.stat.berkeley.edu/~stark/Teach/S240/Notes/ch3.htm). Phase 6 must still exercise autocorrelation, carryover, heterogeneous effects and assignment-dependent missingness before this product protocol is accepted.

Missingness does not justify discarding inconvenient assignments. If any original assignment produces an empty measured side, the test is not estimable and the result is Inconclusive. Assignments with fewer than five measured nights in a hypothetical reassignment are retained: the minimum gate applies to the observed comparison, and filtering the null support would change the design. The fixed exclusion mask assumes missingness/flags are not caused by assignment; results with exclusions record that limitation for Phase 6.

For a benefit-only test, more than 20 assignments are necessary for strict p < 0.05. Both-direction tests need more than 40 for p < 0.025. These are necessary conditions, not sufficient power or a guarantee: ties and erased blocks can make resolution worse. For example, with carryover, one-day blocks contain no usable measurements. Multiple full schedules may then give the same statistic, and each must still be counted.

| Layout (explicit configuration, not a revised default) | Assignment count | Resolution before missingness/ties | Supports both tails in principle?                   |
| ------------------------------------------------------ | ---------------- | ---------------------------------- | --------------------------------------------------- |
| Default 14 days `[3,3,3,3,1,1]`                        | 6                | 1/6                                | No                                                  |
| Default 14-day carryover `[3,3,4,4]`                   | 2                | 1/2                                | No                                                  |
| 28 days `[3,3,1]` repeated four times                  | 22               | 1/22                               | No; benefit-only threshold may be attainable        |
| 28 days `[3,3,3,3,1,1]` repeated twice                 | 60               | 1/60                               | Yes before ties; carryover can erase one-day blocks |
| 42 days, fourteen three-day blocks                     | 138              | 1/138                              | Yes; carryover leaves two usable nights per block   |

No longer layout became the product default in Phase 5. Phase 6 compares their power with the starting design; choosing the offered duration remains a product decision.

The 90% interval is a **condition-stratified whole-block percentile bootstrap** of the raw-unit mean difference. Within each actual exposure side, it draws the observed scheduled blocks with replacement, concatenates all measurements in each selected block, and recomputes the night-weighted mean. It preserves within-block dependence and unequal block lengths. At least two observed blocks per side are needed. If a scheduled block has valid nights in both exposure sides, independent stratified resampling would break their shared dependence, so the interval is unavailable with `bootstrap_condition_clusters_overlap`. Default replicates are 5,000; explicit counts must be 1,000–50,000. The saved schedule seed derives a separate deterministic bootstrap seed, which is reported internally; no hidden randomness changes a rerun.

Endpoints are the linearly interpolated 5th and 95th percentiles. This interval describes uncertainty and **never changes the verdict or substitutes for the exact test**. Resampling does not resolve observational confounding or noncompliance, and dependence across adjacent blocks and small-sample coverage still need validation. [CMU's bootstrap notes](https://www.stat.cmu.edu/~cshalizi/dst/20/lectures/16/lecture-16.html) explain why dependent data need blocks and why block-length/coverage assumptions matter.

## Decision table

All rows first require a finished schedule, enough nights on both sides, a usable positive swing, randomized exposure matching the assignments, and adequate test resolution/estimability. Any failed gate gives **Inconclusive** with explicit reasons. Observational experiments always return an observational comparison and Inconclusive, without a randomization p-value or a causal kept/dropped decision.

| Beneficial direction | Observed on-minus-off | Benefit-only policy                                 | Both-direction policy                                 |
| -------------------- | --------------------- | --------------------------------------------------- | ----------------------------------------------------- |
| Higher               | Positive              | Kept if beneficial p < 0.05; otherwise Inconclusive | Kept if beneficial p < 0.025; otherwise Inconclusive  |
| Higher               | Negative              | Inconclusive: opposite direction not tested         | Dropped if opposite p < 0.025; otherwise Inconclusive |
| Higher               | Zero                  | Inconclusive: no difference                         | Inconclusive: no difference                           |
| Lower                | Negative              | Kept if beneficial p < 0.05; otherwise Inconclusive | Kept if beneficial p < 0.025; otherwise Inconclusive  |
| Lower                | Positive              | Inconclusive: opposite direction not tested         | Dropped if opposite p < 0.025; otherwise Inconclusive |
| Lower                | Zero                  | Inconclusive: no difference                         | Inconclusive: no difference                           |

Equality to a threshold is Inconclusive. Inconclusive is a recorded answer, not grounds to choose another metric, direction, seed, threshold or tail after seeing results.

## UI boundary and validation

`AnalysisResult` contains internal p-values and diagnostics for testing/audit. It must never be serialized directly into a user result card. `experimentResultCard` explicitly selects the metric, means, real-unit change, personal swing, swing-unit change, condition definitions, night counts, unverified/observational flags and verdict word. Its `interval` is now null, with `intervalStatus: coverage_not_established` when an internal interval exists. No p-values, alpha, assignment counts, bootstrap seeds or raw test diagnostics enter this payload. Phase 7 now implements rounding, template rendering and tone/snapshot tests through `@distill/engine/verdict`; [VERDICTS.md](VERDICTS.md) documents its semantic gates and contextual variants. Phase 8 owns screens.

Tests cover both signs of both beneficial directions, legacy policies, strict thresholds, restriction conditions, complete assignment support, ties including carryover aliases, insufficient/unknown/flagged nights, noncompliance, observation-only handling, baseline snapshots/legacy evidence, log-HRV, zero swing, whole-block resampling and the p-free presentation boundary. Database regression tests also reject post-start edits to the new policy and baseline measurements. Passing these tests does not waive the blocked worked example, missing live provider acceptance or Phase 6 simulation requirement.
