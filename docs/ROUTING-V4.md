# Routing table V4

V4 is the table the engine reads to decide what is well-founded, what can be let go, what overlaps, and what is a clinician's call. It replaces this doc's 11 October brief ("add six columns to V3"): per the build plan it was rebuilt from scratch, 50 rows first. Ishan owns every call in it.

- **Source of truth:** `data/Routing-Table_V4.xlsx`. Edit it in Google Sheets (File, Import; then File, Download, Microsoft Excel, saved over the same path).
- **Built into:** `data/catalog-v4.json` by `pnpm catalog:build`. `pnpm check` fails with the sheet, row and column of anything wrong.
- **Read through:** `packages/catalog/src/view.ts`. A V4 row is used once its status is allowed; everything else falls back to its V3 row as unknown evidence (tier U: it neither protects nor clears).

## Sheets

| Sheet | One row per | Columns that matter most |
| --- | --- | --- |
| Items | thing a person does or buys | `evidence_tier`, `evidence_for`, `evidence_requires` + `tier_otherwise`, `keep_when`, `clear_when`, `never_clear`, `dose_min` + `dose_unit`, `moments`, `cadence`, `human_question`, `fits_instead`, `status` |
| Sources | paper or page someone opened | `type`, `finding` (30 words at most, paraphrased), `checked_by`, `checked_on`, `brand_funded` |
| Overlaps | group of things that do the same job | `rule`: keep-one, keep-best-evidence, keep-most-used, or show-together (shown side by side with the total, nothing proposed) |
| Safety | condition that changes an item | `condition`, `action`: clinician-first, see-dermatologist, never-suggest, or note |
| Words | phrase Distill never says | |

The build reads columns by header, so reorder them freely; never rename one.

## Status, and how a row goes live

Every row is `draft`, `reviewed` or `live`. Only `live` rows reach people (Vercel's `ENGINE_CATALOG_STATUSES`, default `live`).

All 50 rows are **reviewed**: drafted by Claude agents from sources they opened on 20 October, with `reviewed_by` saying so. To set one live, Ishan:

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

## Next batch

The plan finishes these 50 before touching the other 160. When that starts, two sources set the order: the six rows that made room for skin (eye mask, white noise, L-theanine, a hot bath before bed, massage gun, fitness apps), and what the golden set's careful friends wanted cleared but V4 doesn't cover yet (`eval/reports/*-rules.md`, "Missed clears"): sea moss, activated charcoal, EMF stickers, hydrogen water, BCAAs, glutamine, lion's mane, glucosamine, berberine, maca, colostrum, chlorophyll, shilajit, NAD+ and hyperbaric sessions.
