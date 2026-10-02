# Catalog ingestion and item rules

## Build contract

`pnpm catalog:build` reads every sheet of `data/Routing-Table_V3.xlsx` with SheetJS and writes `data/catalog.json`. `pnpm catalog:check` rebuilds in memory and fails when the committed JSON differs. Paths resolve from the script location, not the shell's working directory. Output has stable ordering and no timestamp; the SHA-256 identifies the exact source bytes.

The workbook is never rewritten. All nonblank cells and cached formulas are retained under `sheets`, including Start Here, Experiment Priority, Glossary, Tone Guide, Emotional Positioning, Worked Example and Summary. Formulas are not evaluated by SheetJS: missing caches, Excel errors, inconsistent annual costs and incorrect Summary counts fail with diagnostic messages. Recalculate an intentionally updated workbook in Excel before ingesting it.

The package exports `Item`, `Metric`, `Goal`, `OverlapGroup`, `FollowUpQuestion`, `VerdictTemplate`, `ToneRules`, `Catalog`, their Zod schemas, and `validateCatalog`. The Node-only XLSX reader has a separate `@distill/catalog/ingest` export. The default package entry has no Node filesystem dependency.

The catalog retains all 38 source columns through normalized fields and the source-cell snapshots, with sheet/row provenance. Source narrative is kept verbatim apart from outer whitespace. Costs and expected effects must be numeric; zero stays zero and an absent effect stays `null`. There is no inferred scientific evidence. On-days are `assign`, `observe`, or `null` when the source has no assignment mode; a blank never becomes `assign`.

| Source after-gate tier | Enum |
| --- | --- |
| `1` | `T1` |
| `1, queued (slow)` | `T1_QUEUED_SLOW` |
| `1, queued (special design)` | `T1_QUEUED_SPECIAL` |
| `3, effect too small` | `T3_TOO_SMALL` |
| `2` | `T2` |
| `3` | `T3` |
| `P` | `PROTECTED` |

Validators cover duplicate keys, every enum, missing required fields, malformed/unknown template placeholders, unknown group items, group membership counts, unknown group names, missing T2 reasons, annual costs, and Summary totals by tier, category, reason, evidence and fact-check status. Names containing commas resolve by exact longest-name matching, not comma splitting.

There are eight follow-up types, including `OVERLAP` and `NONE`. Generic question definitions and per-item wording/options are preserved. Chip text is not coerced into invented values: `1 to 3` visits cannot prove `under 2`. The future UI needs an exact value or an additional question when a chip crosses a threshold.

## Rule contract

`packages/engine/src/rules/items.ts` contains one typed function for each of the 95 rows whose threshold column is not `Routes on the item name alone.` The registry is hand-written; no runtime code parses natural-language rules. Per-rule tests quote the original workbook sentence, exercise matching/nonmatching cases and dose boundaries, and snapshot the complete source sentences so workbook changes require review.

```ts
import { evaluateItemRule } from '@distill/engine';
import type { Catalog } from '@distill/catalog';

function example(catalog: Catalog) {
  const item = catalog.items.find(i => i.key === 'magnesium-any-form')!;
  return evaluateItemRule(item, {
    source: 'friend',
    goal: 'sleep',
    form: 'citrate',
    dose: 120,
    doseUnit: 'mg elemental',
  });
  // tier: T2, reason: dose too low, monthlyCost: 22, unverified: false
}
```

Dose inputs are daily totals in explicit source units, including `mg elemental` and `mg EPA+DHA`. Capsules, compound weight and active ingredient weight are not interchangeable. There is no implicit conversion. Missing or incompatible units return T3 and `needsAnswers`.

Rule results carry structured signals for later routing/rendering: tier, reason, effect/metric adjustments, keep/rating hints, overlap checks, related experiments, excluded inventory items, source notes, and unanswered fields. Notes are internal identifiers, not user-facing prose. `onDays` and `unverified` are preserved even when a rule changes a tier.

The public evaluator enforces Protected precedence for doctor/blood-test sources, prescriptions, hormones, clinical services and diagnosed conditions. Protected results omit cost, ratings, experiment suggestions and evidence. Item-specific safety redirects cover CBD/medication, 5-HTP/antidepressants, berberine/medication or diabetes, and mouth-tape breathing concerns. No function assigns an on-day, and all nine observe-only flags survive evaluation.

Unknown required answers return T3 with cost shown. Ambiguous source branches additionally carry a `teamQuestion` identifier. The engine does not mutate inputs or use filesystem, network, clocks or randomness.

**This is not `routeStack`.** The full goal-first ordering, general-health gate, cross-item overlap choice, priority ordering, goal-specific overrides outside column AG, and golden worked example belong to Phase 3. Do not use `evaluateItemRule` alone as a public audit API or experiment authorization. Keep/rating hints must be reconciled with Goal to Number there. Rows whose AG says “name alone” but AC describes conditions are preserved and listed as a source conflict, rather than smuggled into Phase 1 as a second router.

## Tone and source text

`toneLint(text, rules)` is pure. It checks banned phrases from Tone Guide plus the brief's US spelling `optimize`, exclamation marks, word limits and obvious third-person references. For template inspection, each placeholder counts as one word; generated text must be checked again after substitution. Ordinary verdicts permit 59 words, gated verdicts 60.

CI checks all 17 source templates. The final row in Verdict Templates is the source-clause lookup, retained separately instead of mistaken for a verdict. All exact placeholder spellings are accepted explicitly, including `did it` and `better/worse`; arbitrary placeholders fail validation.

Active voice, effort-before-number, nonmedical meaning, contextual exceptions and implicit second-person address still need editorial review. The linter is not presented as a semantic guarantee. Raw evidence, research notes, examples and day-one text are reference data; some violate the Tone Guide and cannot be shipped verbatim. Phase 7 must lint every final generated verdict, including substitutions and source clauses.

## Updating the workbook

1. Replace the source file deliberately; retain its provenance.
2. Run `pnpm catalog:build`. Resolve validation failures against the workbook rather than weakening checks.
3. Review changed rule sentences and update their hand-written functions, tests and source snapshot together. Record ambiguous product decisions in OPEN_QUESTIONS.
4. Run `pnpm check`. Commit the workbook, generated JSON, rule/test changes and docs in the same PR.

The SheetJS tarball is vendored per its [official installation guidance](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/). Its source URL, license location and SHA-256 are in `vendor/README.md`; pnpm also verifies integrity from the lockfile.
