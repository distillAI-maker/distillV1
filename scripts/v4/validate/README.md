# Validating routing table V4

Run in order, into any scratch folder `DIR` (needs `openpyxl` for step 0). Record what you find in `data/validation/`.

0. `python3 scripts/v4/validate/extract.py DIR`: pulls Items and Sources out of the workbook.
1. `python3 -I scripts/v4/validate/check.py DIR`, then `python3 -I scripts/v4/validate/analyze.py DIR`: every source looked up in Crossref (exists, title, year, first author, retractions and corrections) and PubMed (its abstract), and every web page loaded. Free; a few minutes.
2. `python3 -I scripts/v4/validate/recheck.py DIR all --yes`, then `summarize.py DIR`: an independent Claude (Opus 5.5) re-checks each row against its sources' abstracts and the tier rules. About 5 cents a row, capped at $8; without `--yes` it prints the estimate and stops. It only sees the Items row and its sources, not the Safety sheet, so check "missing safety" notes against that sheet before acting.
3. Veer reads the person-facing words and the rows Distill can suggest dropping.
4. A qualified expert spot-checks tiers and the Safety sheet.

See `docs/CATALOG-VALIDATION.md` for the 24 October run.
