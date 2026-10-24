"""Sort step 1's results: each source fine, worth a look, or wrong; then each catalog row by its sources."""
import json, sys
from collections import Counter, defaultdict

HERE = sys.argv[1]
data = json.load(open(f'{HERE}/catalog.json'))
res = json.load(open(f'{HERE}/results.json'))
items = {i['key']: i for i in data['items']}
cit = {s['id']: s for s in data['sources']}

def verdict(r):
    """('ok' | 'look' | 'wrong' | 'retracted' | 'unchecked', reason)"""
    if r.get('updated_by') and any(u in ('retraction', 'withdrawal', 'removal') for u in r['updated_by']) or r.get('pubmed_retracted'):
        return 'retracted', 'retracted or withdrawn'
    if 'doi' in r:
        if r.get('crossref') != 200:
            if r.get('doi_resolves') == 200:
                return 'look', f"DOI isn't in Crossref but resolves ({r.get('doi_lands', '')[:80]})"
            return 'wrong', f"DOI not found anywhere ({r.get('crossref')}/{r.get('doi_resolves')})"
        tm, gap, au = r.get('title_match'), r.get('year_gap'), r.get('author_in_citation')
        if r.get('updated_by') and any(u for u in r['updated_by']) or r.get('pubmed_concern'):
            return 'look', 'an expression of concern or correction: ' + ', '.join(filter(None, r.get('updated_by') or ['concern']))
        if tm is not None and tm < 0.35:
            return 'wrong', f'DOI points to a different paper: "{r.get("found_title", "")[:110]}"'
        problems = []
        if tm is not None and tm < 0.65: problems.append(f'title only partly matches ("{r.get("found_title", "")[:90]}")')
        if gap is not None and gap > 1: problems.append(f'year {r.get("found_year")}, we say {r.get("year")}')
        if au is False and r.get('first_author'): problems.append(f'first author is {r["first_author"]}, not in our citation')
        if problems: return 'look', '; '.join(problems)
        return 'ok', ''
    w = r.get('web')
    if w == 200: return 'ok', ''
    if w in (401, 403, 406, 429, 0): return 'unchecked', f'the site blocks automatic checks ({w})'
    return 'wrong', f'page does not load ({w})'

out = {sid: verdict(r) for sid, r in res.items()}
c = Counter(v for v, _ in out.values())
print('sources:', dict(c), 'of', len(res))
print('with a PubMed summary:', sum(1 for r in res.values() if r.get('abstract')), 'of', sum(1 for r in res.values() if 'doi' in r), 'DOIs')
by_row = defaultdict(list)
for sid, (v, why) in out.items():
    for k in res[sid]['rows']:
        by_row[k].append((v, sid, why))
rows = []
for k, srcs in by_row.items():
    i = items[k]
    bad = [s for s in srcs if s[0] in ('wrong', 'retracted')]
    look = [s for s in srcs if s[0] == 'look']
    okn = sum(1 for s in srcs if s[0] == 'ok')
    rows.append({'key': k, 'name': i['name'], 'tier': i['evidence_tier'], 'sources': len(srcs), 'ok': okn, 'bad': bad, 'look': look,
                 'unchecked': [s for s in srcs if s[0] == 'unchecked']})
json.dump({'sources': {k: {'verdict': v, 'why': w, **res[k]} for k, (v, w) in out.items()}, 'rows': rows}, open(f'{HERE}/report.json', 'w'), indent=1, default=str)
print('rows with a wrong or retracted source:', sum(1 for r in rows if r['bad']))
print('rows with something to look at:', sum(1 for r in rows if r['look']))
print('A/B rows left with no source that checked out fine:', [r['key'] for r in rows if r['tier'] in ('A', 'B') and r['ok'] == 0])
print()
for v in ('retracted', 'wrong', 'look', 'unchecked'):
    xs = [(sid, w) for sid, (vv, w) in out.items() if vv == v]
    print(f'== {v}: {len(xs)}')
    for sid, w in xs[:60]:
        print(f'  {sid} [{", ".join(res[sid]["rows"])}] {w}')
