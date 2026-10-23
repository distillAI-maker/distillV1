"""Sign off routing-table rows: set them live, with who and when.

    python3 scripts/v4/set_live.py --by Veer --all                  every reviewed row
    python3 scripts/v4/set_live.py --by Veer --all --except kava,cbd
    python3 scripts/v4/set_live.py --by Veer --keys sea-moss,biotin

Only rows already `reviewed` move to `live`. Then run `pnpm catalog:build` and `pnpm eval:gates`.
"""

import argparse
import datetime
import pathlib

from openpyxl import load_workbook

BOOK = pathlib.Path(__file__).resolve().parents[2] / "data" / "Routing-Table_V4.xlsx"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--by", required=True)
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--keys", default="")
    ap.add_argument("--except", dest="skip", default="")
    a = ap.parse_args()
    keys = {k.strip() for k in a.keys.split(",") if k.strip()}
    skip = {k.strip() for k in a.skip.split(",") if k.strip()}
    if not a.all and not keys:
        raise SystemExit("Give --all or --keys")
    wb = load_workbook(BOOK)
    ws = wb["Items"]
    col = {c.value: i + 1 for i, c in enumerate(ws[1])}
    today = datetime.date.today().isoformat()
    done = []
    for r in range(2, ws.max_row + 1):
        key = ws.cell(row=r, column=col["key"]).value
        status = ws.cell(row=r, column=col["status"]).value
        if not key or status != "reviewed" or key in skip or (not a.all and key not in keys):
            continue
        ws.cell(row=r, column=col["status"]).value = "live"
        ws.cell(row=r, column=col["reviewed_by"]).value = a.by
        ws.cell(row=r, column=col["reviewed_on"]).value = today
        done.append(key)
    wb.save(BOOK)
    print(f"{len(done)} rows live, signed by {a.by} on {today}")


if __name__ == "__main__":
    main()
