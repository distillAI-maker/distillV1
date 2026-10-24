# Catalog validation

How we know routing table V4 (156 rows, 463 sources) is right, and what's left. Scripts: `scripts/v4/validate/`. Records: `data/validation/`.

## Why it needed validating

Claude agents drafted every row on 20 and 22 October from sources they opened (156 read in full, 307 from the abstract). The validator checks structure (an A or B row needs an independent source, and so on), not truth. On 23 October all 156 rows went live, signed "Veer", on his decision, before any person had read one.

## The four steps

| Step | What | Who | State |
| --- | --- | --- | --- |
| 1 | Every source is real and is the paper we cite | Code: Crossref, PubMed, the web | Done, 24 Oct |
| 2 | Each row's claims and tier follow from its sources | An independent Claude (Opus 5.5), reading the abstracts | Done, 24 Oct, $6.84 |
| 3 | The words a person reads, and the rows Distill can suggest dropping | Veer | Next |
| 4 | Tiers and the Safety sheet | A qualified expert (dietitian, pharmacist, sports scientist or doctor) | To arrange |

## Step 1: the sources (24 October)

- All 387 papers exist in Crossref and match the title, year and first author we cite (differences were shortened titles, accents, or online-first years). 384 have a PubMed abstract.
- All 76 web pages load and say what the row claims; three government sites block automated checks (CDC twice, CPSC) and were read by hand.
- **None is retracted or withdrawn.** 13 carry a published correction or erratum, which is normal; step 2 judged them against their summaries.

## Step 2: the independent re-check (24 October)

Of 156 rows: 81 fine, 75 worth a look, none wrong. 140 tiers judged right. Where it disagreed:

- **Premium and paid extras** (premium gym, a second membership, a personal trainer, a premium app): the evidence is for training or logging, not the purchase. **Veer's decision:** protect the activity, never push a cheaper version of something premium. These rows only come up when unused or doubled; services carry no "instead" line, and no "instead" line anywhere talks price (the money back is shown separately).
- **Evidence that holds only for a group** (melatonin for sleep problems or jet lag, a light box for seasonal depression, a dietitian for weight or blood-sugar goals, acupuncture for chronic pain): **Veer's decision:** their call (C) for everyone, since the engine treats "can't tell" as "protect". C is never pushed to drop, so people in the group lose nothing. When the engine can read these conditions from their words, give the rows `evidence_requires` back.
- **Grades moved for accuracy:** sunscreen and retinoids A to B, a personal trainer A to B (all still protected); a consistent wake time, paper reading before bed and earplugs B to C (single small or patient-only studies).
- **Overstated words fixed** in 38 summaries; 35 "instead" lines rewritten or removed; 11 tiers changed. For example, creatine's strength gain is shown mostly in men; CBT-I's gains "seemed to last"; the camping light study had no evening electric light.
- **False alarms, not acted on:** "missing safety cautions" (the reviewer didn't see the Safety sheet, which already covers biotin and blood tests, berberine with diabetes medicine, kava with alcohol, turmeric with blood thinners and more), and "a C row shouldn't clear" (the engine clears a C item only when the person says it came from a feed, which matches "their values decide").

Every change is in `data/validation/2026-10-24-edits.json` (with the reasons) and `2026-10-24-applied.json` (before and after). The reviewer's full verdicts are in `2026-10-24-recheck.json`.

After the edits all 41 golden people still pass every hard gate, and the engine finds the same share of clears (43%).

## Left for the expert (step 4)

The re-check flagged these without a clear answer from abstracts alone: psyllium's `low_intake` condition, the electrolyte rows' tier, ashwagandha's studied forms (Shoden vs Sensoril), zinc's typical dose against the 40 mg upper limit, and the gua sha row's "less puffy" claim. Plus a spot-check of the A/B/D/N tiers and the 218 Safety rows.
