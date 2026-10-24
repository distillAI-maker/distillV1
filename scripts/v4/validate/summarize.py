"""Sort step 2's verdicts: what to fix first, by how much harm a mistake would do."""
import json, sys
from collections import Counter

HERE = sys.argv[1]
cat = {i['key']: i for i in json.load(open(f'{HERE}/catalog.json'))['items']}
rc = json.load(open(f'{HERE}/recheck.json'))

def weight(k, r):
    """Higher = fix sooner. A wrong grade on something Distill can suggest dropping (D/N), or a grade
    that's too low on something that works, hurts people most; then a grade too high (protects noise);
    then overstated words; then the rest."""
    t = cat[k]['evidence_tier']
    w = {'wrong': 30, 'look': 10, 'fine': 0}[r['overall']]
    if r['tier_verdict'] == 'too_low': w += 25
    if r['tier_verdict'] == 'too_high': w += 15 if t in ('A', 'B') else 8
    if t in ('D', 'N'): w += 8
    if r['words_ok'] == 'no': w += 6
    if r['rules_ok'] == 'no': w += 10
    if r['claim_supported'] == 'no': w += 12
    return w

rows = []
for k, v in rc.items():
    r = v['review']
    if not r: continue
    rows.append({'key': k, 'name': cat[k]['name'], 'tier': cat[k]['evidence_tier'], 'w': weight(k, r), **r})
rows.sort(key=lambda x: -x['w'])
print('rows reviewed:', len(rows), ' cost: $%.2f' % sum(v['cost'] for v in rc.values()))
print('overall:', dict(Counter(r['overall'] for r in rows)))
print('tier:', dict(Counter(r['tier_verdict'] for r in rows)))
print('claim supported:', dict(Counter(r['claim_supported'] for r in rows)))
print('words ok:', dict(Counter(r['words_ok'] for r in rows)), ' rules ok:', dict(Counter(r['rules_ok'] for r in rows)))
print('population fit:', dict(Counter(r['population_fit'] for r in rows)))
moves = Counter((r['tier'], r['suggested_tier']) for r in rows if r['tier_verdict'] in ('too_high', 'too_low'))
print('suggested tier moves:', dict(moves))
print()
for r in rows:
    if r['overall'] == 'fine' and r['w'] < 10: continue
    print(f"[{r['w']:>2}] {r['overall'].upper():5} {r['tier']}->{r['suggested_tier'] if r['suggested_tier'] != 'same' else r['tier']}  {r['name']}")
    print('      ', r['one_line'])
json.dump(rows, open(f'{HERE}/recheck-sorted.json', 'w'), indent=1)
