# Verdict text

Phase 7 adds `@distill/engine/verdict`: pure template filling, measurement/cost formatting, and result-aware text for experiments, stack audits, historical hypotheses and confirmed observational nights. It reads the checked catalog; it does not fetch studies, change routing, select experiments, compute verdicts or alter saved statistical rules.

## Exact source templates

`renderTemplate(id, values)` fills all 17 Verdict Templates verbatim. Every placeholder has a typed slot, including `did it`, `better/worse`, counts, evidence, dose/form and the source clause. Missing/extra fields, nested braces, blank values and control characters fail explicitly. Replacement is one pass: substituted text cannot become a new template token. The factory captures a private source/rules snapshot, so later caller mutations cannot change the copy.

```ts
import { renderTemplate } from '@distill/engine/verdict';

const draft = renderTemplate('dose', {
  item: 'Magnesium',
  dose: '120 mg elemental',
  threshold: '200 mg elemental',
  cost: '$22',
});
```

This low-level function is a formatter for trusted, verified context. It does not authorize a drop, establish a clinical claim, verify a study summary or decide whether a source fact-check flag may appear in the launch UI. Use the adapters below with a routed item or calculated result. The example values are source/test fixtures, not new advice.

Source clauses reproduce the workbook's friend/podcast/online/ad/explicit-forgotten-source wording. An omitted source or “other” adds no clause; omission never becomes “don't remember.” Doctor and blood-test sources are rejected from drop clauses because they are Protected. Source context is stated once, only alongside actual recorded use duration.

## Result-aware rendering

`renderExperimentVerdict(analysis, context)` uses the existing computed verdict and saved on-condition. Context supplies a display item name, optional actual monthly cost/use duration and whether the tested on-condition represents the item or a restriction. Wearable-history length never becomes months of item use. `dropsCharge` must explicitly confirm that abandoning the tested condition removes the charge; a free habit or a dropped restriction does not produce fictional savings.

```ts
import { renderExperimentVerdict } from '@distill/engine/verdict';

const text = renderExperimentVerdict(analysis, {
  itemName: 'Afternoon coffee',
  subject: 'on_condition',
  monthlyCost: 0,
});
```

The project owner selected **accurate wording variants with the original templates preserved**. The default `copyPolicy: contextual` uses exact wording whenever its factual claims fit. `copyPolicy: exact` withholds an incompatible narrative with a structured `needs_review` result. Both policies leave the numerical verdict unchanged.

| Source conflict                                                                                        | Contextual behavior                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dropped says “outside your normal swing,” but significance need not imply a difference above one swing | Use “against your normal swing” when the effect is not outside it.                                                                                                                                                  |
| Dropped always promises money back                                                                     | Include savings only for an explicitly confirmed paid item charge. A restriction is named by its saved on-condition.                                                                                                |
| Inconclusive always says “inside” and “at this dose”                                                   | Use a neutral comparison for habits or large measured changes; explain insufficient nights, noncompliance, poor assignment resolution, unavailable baseline, conflicting directions or a legacy untested direction. |
| An unfinished test has no final answer                                                                 | Say it is still in progress; no claim that the body showed no effect.                                                                                                                                               |
| Observational comparisons are not randomized                                                           | Label the comparison observational, retain Inconclusive and explain that other things can account for it.                                                                                                           |
| Protected contains two sentences and assumes a clinician                                               | Use one neutral sentence with the actual doctor/blood-test/data-source context, or a generic Protected acknowledgment. No cost, evidence summary or nudge.                                                          |
| No source verdict exists for unused items                                                              | Use a short factual usage/cost sentence, with the choice left to the reader; mark its source as null.                                                                                                               |
| Gated copy assumes two weeks                                                                           | With an explicitly different `protocolDays`, use a duration-neutral small-effect explanation. No unsimulated power probability is invented.                                                                         |

Every ready output includes source row, template ID, source/contextual variant, word count and the original `unverified` flag. Text that cannot safely be formed returns `needs_context` or `needs_review`, with `text: null` and internal issue codes. Missing costs/doses/thresholds/evidence are not filled with guesses. Long or banned substitutions are not silently truncated or stripped.

`renderAuditVerdict(item, answers, context)` selects copy from the already-routed item. Protected precedence is preserved; unresolved follow-ups, source conflicts, excluded items and unsupported special designs cannot become confident recommendations. A dose threshold must be supplied as an explicit compatible value/unit; there are no capsule-to-active-ingredient conversions. Study summaries and gate hooks/fractions require reviewed context rather than parsing raw research prose. Free-and-harmless copy requires explicit confirmation, not just a zero price.

`renderHistoryVerdict(hypothesis, context)` uses confirmed on/off history and an explicit beneficial direction, count/window and behavior phrase. It labels the result a pattern, not proof. `renderMorningObservation(observation)` fills the single-night template only when the observed number is below the usual value and extra awake time is nonnegative; different signs need reviewed copy. Neither function generates a causal Kept/Dropped claim. The morning helper expects a confirmed exposure supplied by the upstream behavior layer; it does not infer that a person drank from a low HRV reading.

## Rounding, tone and boundary

Minutes and milliseconds round to integers; bpm to 0.5; breaths/min, percentage points, Celsius and percentage swing to 0.1. Rounding is symmetric for negative values and never displays negative zero. A small nonzero change that would round to zero is described as “less than 1 minute” or the corresponding unit step. HRV means/changes stay in ms; the card's log-derived swing remains a percent. Dose formatting preserves significant digits, so 0.001 g does not turn into 0 g. Costs use dollars and cents, with annual figures kept separate from monthly charges.

Every generated ready string passes `toneLint()` after all substitutions. Ordinary verdicts allow 59 words; gated copy allows 60. Mechanical checks cover banned words/phrases, exclamation marks, third-person references and word count. The linter does not certify clinical truth, active voice or editorial quality; fact-check review remains separate. Exact source Protected copy remains available for review even though its two sentences conflict with the Tone Guide; the public adapter uses the one-sentence variant.

Outputs are **plain text**, to be rendered as text nodes, not HTML. The adapters never serialize the internal `AnalysisResult`, randomization test, p-values, alpha, seeds or unvalidated intervals. The numeric result-card boundary remains unchanged.

## Demo integration and verification

`pnpm seed:demo --as-of=2026-10-03 --seed=20261003` now writes `experiment.verdict` and per-item `auditText` beside the existing safe numeric result card. `/api/demo/users/{id}` returns these through the same explicitly enabled, read-only synthetic API. Some audit entries intentionally need more context/source review; the source conflicts are not waived for a cleaner demo.

With this fixture, Alex's saved “Skip coffee after 2pm” condition is Kept; Sam's is Dropped with no promised refund; Jordan's is Inconclusive with a measured comparison and no “no effect” claim. These are fictional test histories and their calculated results, not evidence about coffee.

The 17 exact templates each have a filled-text snapshot, with additional snapshots for contextual variants, observed/history results and inconclusive reasons. Tests cover formatting boundaries, bad inputs, source protection, compatibility, missing context, immutable source capture, fact-check flags and the diagnostic boundary. `pnpm tone-lint` checks both the original 17 templates and all 17 filled examples; production rendering also checks every ready output at runtime.

Phase 6 was rechecked with its seed/database/API tests and a complete 105,500-attempt rerun. All 142 scenario/effect cells reproduced exactly. The report provenance now excludes verdict presentation, because wording changes cannot alter the experiment calculations; calculation sources still trigger freshness failures. False-positive/missingness and interval-coverage limitations remain as documented in [POWER.md](POWER.md).

Phase 8 still owns screens, authentication/session flows, result-file persistence and hosted demo provisioning. No production database migration or deployment is performed by Phase 7.
