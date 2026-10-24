"""Step 2 of validating the V4 catalog: a fresh Claude, which didn't write the catalog, re-checks every
row against its sources' published summaries (fetched from PubMed in step 1) and our own definitions.

  python3 recheck.py DIR [key,key,...]   only these rows (a trial run)
  python3 recheck.py DIR all --yes      every row

Results go to DIR/recheck.json as they arrive; reruns skip rows already done. Stops if spend passes
the cap. The API key is read from apps/web/.env.local and never printed.
"""
import json, re, sys, time, threading, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor

HERE, which = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else '')
CAP_USD = 8.0
MODEL = 'claude-opus-5-5'
PRICE_IN, PRICE_OUT = 4 / 1e6, 20 / 1e6
import pathlib
ENV = pathlib.Path(__file__).resolve().parents[3] / 'apps' / 'web' / '.env.local'
KEY = next((m.group(1).strip().strip('"\'') for m in (re.match(r'^ANTHROPIC_API_KEY=(.+)$', l.strip()) for l in open(ENV)) if m), None)
if not KEY: sys.exit('No ANTHROPIC_API_KEY in apps/web/.env.local')

cat = json.load(open(f'{HERE}/catalog.json'))
res = json.load(open(f'{HERE}/results.json'))
items = cat['items']
src = {s['id']: s for s in cat['sources']}
out_path = f'{HERE}/recheck.json'
try: done = json.load(open(out_path))
except Exception: done = {}
lock = threading.Lock()
spent = sum(d.get('cost', 0) for d in done.values())

SYSTEM = """You are an independent evidence reviewer for Distill, a wellness companion. Another AI wrote the catalog row below from sources it opened. Check it, strictly and fairly, against the sources' published summaries and the grading rules. You did not write it, and you are not trying to agree with it.

Grading rules (the catalog's own definitions):
- Tier A: meta-analyses or several consistent RCTs in healthy adults, for the claim in evidence_for. Protects the thing when done regularly, even when unfelt.
- Tier B: RCTs agree but are small, short or in a narrower group. Protects it when done regularly.
- Tier C: studies disagree, or are small and short. Neither protects nor clears.
- Tier D: mechanism, animal studies or anecdote only. Can be let go when borrowed (from a feed) and unloved.
- Tier N: no independent studies; brand-funded only counts as none. Can be let go when borrowed and unloved.
- evidence_requires + tier_otherwise: when the tier only holds for some people (creatine needs training).
- Direction: some rows grade evidence of a COST (alcohol, nicotine, late caffeine). Those carry UNLOVED_HABIT in clear_when and must never protect via EVIDENCE_REGULAR.
- A and B need at least one independent (not brand-funded) source.
- The people are healthy adults, 22 to 45, most without a diagnosis. Evidence only in patients, the elderly, or deficient people doesn't make something A or B for them.

What matters most: a tier that's too HIGH protects something useless; a tier that's too LOW lets Distill suggest dropping something that works. Wrong safety-relevant claims are the worst error. Person-facing words (evidence_summary, human_question, fits_instead) must not overstate or misstate the evidence.

Where a source has no summary (a guidance page, or not indexed), judge only from the row's own paraphrase and say so; don't invent its content. Be concise and concrete. Answer only with the JSON the schema asks for."""

TOOL = {
    'name': 'record_review',
    'description': 'Record the review of one catalog row.',
    'input_schema': {
        'type': 'object',
        'properties': {
            'sources': {'type': 'array', 'items': {'type': 'object', 'properties': {
                'id': {'type': 'string'},
                'finding_matches': {'type': 'string', 'enum': ['yes', 'partly', 'no', 'cannot_tell']},
                'note': {'type': 'string', 'description': 'Only when not yes: what differs, in one sentence.'}},
                'required': ['id', 'finding_matches'], 'additionalProperties': False}},
            'claim_supported': {'type': 'string', 'enum': ['yes', 'partly', 'no'], 'description': 'Do the sources support evidence_for and evidence_summary as written?'},
            'claim_note': {'type': 'string'},
            'tier_verdict': {'type': 'string', 'enum': ['right', 'too_high', 'too_low', 'unsure']},
            'suggested_tier': {'type': 'string', 'enum': ['A', 'B', 'C', 'D', 'N', 'same']},
            'tier_note': {'type': 'string'},
            'population_fit': {'type': 'string', 'enum': ['yes', 'partly', 'no'], 'description': 'Is the evidence about healthy adults like ours?'},
            'rules_ok': {'type': 'string', 'enum': ['yes', 'no'], 'description': 'Do keep_when / clear_when / evidence_requires follow from the tier and direction?'},
            'rules_note': {'type': 'string'},
            'words_ok': {'type': 'string', 'enum': ['yes', 'no'], 'description': 'Are evidence_summary, human_question and fits_instead accurate and not overstated?'},
            'words_note': {'type': 'string'},
            'overall': {'type': 'string', 'enum': ['fine', 'look', 'wrong']},
            'one_line': {'type': 'string', 'description': 'One plain sentence a non-scientist founder can act on.'},
        },
        'additionalProperties': False,
        'required': ['sources', 'claim_supported', 'tier_verdict', 'suggested_tier', 'population_fit', 'rules_ok', 'words_ok', 'overall', 'one_line'],
    },
}

ROW_FIELDS = ['key', 'name', 'kind', 'area', 'evidence_tier', 'evidence_for', 'evidence_requires', 'tier_otherwise', 'evidence_summary',
              'dose_min', 'dose_typical', 'dose_unit', 'studied_forms', 'keep_when', 'clear_when', 'never_clear', 'human_question', 'fits_instead', 'cost_month_usd', 'overlaps']

def prompt(row):
    ids = [x for x in re.split(r'[,; ]+', str(row['sources'])) if x]
    parts = ['<row>', json.dumps({k: row.get(k, '') for k in ROW_FIELDS}, ensure_ascii=False, default=str), '</row>', '<sources>']
    for sid in ids:
        s, r = src.get(sid, {}), res.get(sid, {})
        abstract = (r.get('abstract') or '').strip()
        parts.append(json.dumps({
            'id': sid, 'citation': s.get('citation'), 'type': s.get('type'), 'year': s.get('year'), 'population': s.get('population'),
            'brand_funded': s.get('brand_funded'), 'our_paraphrase': s.get('finding'),
            'published_summary': abstract[:3500] if abstract else '(none available: judge from our paraphrase only)',
        }, ensure_ascii=False, default=str))
    parts.append('</sources>')
    return '\n'.join(parts)

def call(row):
    global spent
    body = json.dumps({
        'model': MODEL, 'max_tokens': 6000, 'system': SYSTEM,
        'output_config': {'effort': 'medium', 'format': {'type': 'json_schema', 'schema': TOOL['input_schema']}},
        'messages': [{'role': 'user', 'content': prompt(row)}],
    }).encode()
    for attempt in range(4):
        req = urllib.request.Request('https://api.anthropic.com/v1/messages', data=body, headers={
            'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                m = json.loads(r.read())
            u = m.get('usage', {})
            cost = u.get('input_tokens', 0) * PRICE_IN + u.get('output_tokens', 0) * PRICE_OUT
            text = ''.join(b.get('text', '') for b in m['content'] if b.get('type') == 'text')
            review = json.loads(text) if text else None
            return review, cost, u
        except urllib.error.HTTPError as e:
            msg = e.read().decode('utf8', 'replace')[:300]
            if e.code in (429, 500, 502, 503, 529) and attempt < 3:
                time.sleep(5 * (attempt + 1)); continue
            raise RuntimeError(f'API {e.code}: {msg}')

def run(row):
    global spent
    k = row['key']
    if k in done: return
    with lock:
        if spent >= CAP_USD:
            return
    try:
        review, cost, usage = call(row)
    except Exception as e:
        print('FAILED', k, str(e)[:200], flush=True); return
    with lock:
        spent += cost
        done[k] = {'review': review, 'cost': round(cost, 4), 'tokens_in': usage.get('input_tokens'), 'tokens_out': usage.get('output_tokens')}
        json.dump(done, open(out_path, 'w'), indent=1)
        print(f'{len(done)} {k} {review.get("overall") if review else "?"} ${spent:.2f}', flush=True)

if which == 'all':
    if '--yes' not in sys.argv:
        sys.exit(f'Would review {len([i for i in items if i["key"] not in done])} rows, about ${0.025 * len(items):.2f}. Add --yes.')
    todo = items
else:
    keys = set(which.split(','))
    todo = [i for i in items if i['key'] in keys]
with ThreadPoolExecutor(4) as ex:
    list(ex.map(run, todo))
print(f'finished: {len(done)} rows, ${spent:.2f}')
