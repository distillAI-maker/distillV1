"""Build public/assets/data/stack.json from data/Routing-Table_V3.xlsx.

The landing page's "try it on your stack" demo reads this file. It carries only
what the page shows: the item, its monthly cost, where the router sends it on
day one, and the sentence the person reads. The spreadsheet stays the source
of truth; rerun this script whenever it changes.

    python3 scripts/build_data.py
"""
import json
import pathlib
import re

import openpyxl

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "Routing-Table_V3.xlsx"
OUT = ROOT / "public" / "assets" / "data" / "stack.json"

COLS = {
    "key": "Key",
    "name": "Item",
    "kind": "Do, buy, or environment",
    "cat": "Category",
    "cost": "Cost per month (USD)",
    "watch": "Which number we'd watch",
    "tier": "Tier after the effect gate (what the engine uses)",
    "why": "Why it's a day-one drop (Tier 2 only)",
    "group": "Overlap group",
    "line": "What the user reads on day one",
}


def lane(tier: str) -> str:
    """Collapse the engine tier into the four lanes the page draws."""
    t = (tier or "").strip()
    if t.startswith("P"):
        return "yours"
    if t.startswith("2"):
        return "cut"
    if t == "1" or t.startswith("1,"):
        return "test"
    return "call"  # tier 3, including "effect too small"


def main() -> None:
    wb = openpyxl.load_workbook(SRC, read_only=True, data_only=True)
    rows = list(wb["Items"].iter_rows(values_only=True))
    head = [str(h) if h is not None else "" for h in rows[0]]
    idx = {k: head.index(v) for k, v in COLS.items()}
    items = []
    for r in rows[1:]:
        if len(r) <= idx["name"] or not r[idx["name"]]:
            continue
        get = lambda k: r[idx[k]] if idx[k] < len(r) else None
        cost = get("cost")
        line = re.sub(r"\s+", " ", str(get("line") or "")).strip()
        items.append({
            "k": str(get("key")),
            "n": str(get("name")).strip(),
            "c": str(get("cat") or ""),
            "$": round(float(cost)) if cost not in (None, "") else 0,
            "lane": lane(str(get("tier") or "")),
            "tier": str(get("tier") or ""),
            "why": str(get("why") or "") if get("why") not in (None, "None") else "",
            "watch": str(get("watch") or ""),
            "g": str(get("group") or ""),
            "t": line,
        })
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"v": 3, "items": items}, ensure_ascii=False, separators=(",", ":")))
    lanes = {}
    for it in items:
        lanes[it["lane"]] = lanes.get(it["lane"], 0) + 1
    print(f"{len(items)} items -> {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KB) {lanes}")


if __name__ == "__main__":
    main()
