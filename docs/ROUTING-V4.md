# Routing table V4

V4 is the table the engine reads to decide what is well-founded, what can be let go, what overlaps, and what is a clinician's call. It replaces this doc's 11 October brief ("add six columns to V3"): per the build plan it was rebuilt from scratch, 50 rows first. Ishan owns every call in it.

- **Source of truth:** `data/Routing-Table_V4.xlsx`. Edit it in Google Sheets (File, Import; then File, Download, Microsoft Excel, saved over the same path).
- **Built into:** `data/catalog-v4.json` by `pnpm catalog:build`. `pnpm check` fails with the sheet, row and column of anything wrong.
- **Read through:** `packages/catalog/src/view.ts`. A V4 row is used once its status is allowed; everything else falls back to its V3 row as unknown evidence (tier U: it neither protects nor clears).

## Sheets

| Sheet | One row per | Columns that matter most |
| --- | --- | --- |
| Items | thing a person does or buys | `evidence_tier`, `evidence_for`, `evidence_requires` + `tier_otherwise`, `keep_when`, `clear_when`, `never_clear`, `dose_min` + `dose_unit`, `moments`, `cadence`, `human_question` (background for Claude), `origin_question` (the where-did-it-come-from card in the row's own words, 14 words at most; the buttons stay the same), `fits_instead`, `swap_title` + `swap_slot` + `swap_per_week` (the thing to do a person can add once they let this go; never something to buy; blank per week means every day), `budget_option` (for something expensive: the same activity for less, offered once unless loved), `builds` (yes when the benefit builds with daily use, so now and then mostly misses it: Distill offers to anchor it), `status` |
| Sources | paper or page someone opened | `type`, `finding` (30 words at most, paraphrased), `checked_by`, `checked_on`, `brand_funded` |
| Overlaps | group of things that do the same job | `rule`: keep-one, keep-best-evidence, keep-most-used, or show-together (shown side by side with the total, nothing proposed) |
| Safety | condition that changes an item | `condition`, `action`: clinician-first, see-dermatologist, never-suggest, or note |
| Words | phrase Distill never says | |

The build reads columns by header, so reorder them freely; never rename one.

## Status, and how a row goes live

Every row is `draft`, `reviewed` or `live`. Only `live` rows reach people (Vercel's `ENGINE_CATALOG_STATUSES`, default `live`).

**All 156 rows are `live`** (23 October, signed by Veer). Validation, its results and what's left: [CATALOG-VALIDATION.md](CATALOG-VALIDATION.md). They were `reviewed` first (22 October): the first 50 from 20 October, plus 106 added so every onboarding chip (100 of 100) and the common feed products people type in have a row, each drafted by Claude agents from sources they opened. Veer signs rows off (22 October decision): `python3 scripts/v4/set_live.py --by Veer --all [--except key,key]`, then `pnpm catalog:build` and `pnpm eval:gates`. To check a row by hand, the reviewer:

1. Reads `evidence_for` and `evidence_summary`: is the claim the one the sources make, for people like ours?
2. Checks the tier against the anchors on the Read me sheet. A and B protect something done regularly; C, D and N don't. A and B need at least one independent source (`brand_funded` no).
3. Checks `keep_when` and `clear_when`. A row graded on a cost (alcohol, nicotine, coffee after 2pm) has `UNLOVED_HABIT` and never `EVIDENCE_REGULAR`.
4. Reads the person-facing words (`evidence_summary`, `human_question`, `fits_instead`) out loud.
5. Puts his name in `reviewed_by`, the date in `reviewed_on`, sets `status` to `live`, saves, and runs `pnpm catalog:build` and `pnpm eval:gates`.

## What the validator enforces

Unique keys and group names; every source id exists; A and B need an independent checked source, C needs a source; an A or B supplement needs a dose; `evidence_requires` needs `tier_otherwise`; a live row needs a reviewer; `THEIRS` and `LOVED` always keep; `never_clear` rows have no clear codes; `BORROWED_WEAK` only where the tier (or `tier_otherwise`) is C, D or N; `OVERLAP` needs a group; findings 30 words at most; and person-facing text free of the Words sheet, exclamation marks and "they / their".

## What the research changed from V3

- **Tiers moved:** bedtime worry list B → C (one small one-night study); gratitude B → A (a 2025 preregistered meta-analysis of 24,804 people); nicotine A → B (sleep trials used patches in non-smokers; the "lowers HRV" claim didn't hold up).
- **Claims dropped:** work email after 9pm "lowers HRV"; breathwork "beat mindfulness for mood" (true only for positive mood); sleep-score checking "makes sleep worse" (the experiments show effects on the next day, not on sleep).
- **Memberships** are tier A only for people who use them (`evidence_requires: trains`, N otherwise).
- **Creatine's** dose floor is 3 g a day (V3 disagreed with itself: 3 g in one column, under 2 g in its rule).
- **Areas:** morning sunlight, the bedtime worry list, the sleep score check and a second wearable moved from mind to sleep.
- **Costs** were re-estimated from pricing pages (meditation app $7 a month paid yearly, therapy $300, second wearable $20, nicotine $80). Estimates, not sourced.
- **Schema:** a `topical` kind for skin products, `%` and `steps/day` doses, `smoker` and `sleep-apnea` conditions, finer source types, and the `brand_funded` flag.

## Overlap groups

29 groups: every V3 group carried over with an explicit rule, plus the ones research proposed. Only groups V3 already treated as "one of these goes" clear anything: collagen, electrolytes, exfoliants, gym floor access, hydrating layers, magnesium, meditation apps, melatonin and gummies, multivitamin and greens, omega-3, retinoid nights. Everything new is show-together. Once V4 exists, its sheet replaces V3's groups entirely.

## Rules added with the 106 rows (22 October)

- **Worth a look.** Something with tier N or D, nothing in their words about it, and no origin yet gets a `curate / WORTH_A_LOOK` decision: one short question ("AG1: no independent evidence. Worth a look?"), never a verdict. A yes marks it borrowed and the clear follows with the money; "this is mine" keeps it for good.
- **Free to keep.** A device or something in the room that costs nothing more (a salt lamp, a grounding mat) is never offered as a clear or a question: letting it go frees nothing.
- **Memberships need known use.** A membership is only kept as "real work for your training" once they've said they go; until then it is their call.
- **Electrolytes** (LMNT, sports drinks) no longer protect for anyone who trains: the evidence is for long or very sweaty sessions, which the engine can't yet tell apart.
- **Berberine** is C for healthy adults; its good trials are in people with raised blood sugar.
- Every row that names an overlap group is a member of it. New groups: noise-masking, self-tests, biotin-sources, testosterone-boosters, nad-and-longevity, weight-and-blood-sugar, mushroom-supplements.
- `scripts/v4/add_rows.py` merges drafted rows (JSON) into the workbook, keeping its formatting; `scripts/v4/set_live.py` signs them off.

## Next batch

The 156 rows cover every onboarding chip and the feed products in the golden set's missed clears. The other V3 rows (about 54: less common supplements such as valerian, passionflower or vitamin K2, and situations such as a partner's snoring) still read as unknown evidence. Take them next, in the order the evaluation's "Missed clears" and real members' stacks show they matter (`eval/reports/*-rules.md`).
