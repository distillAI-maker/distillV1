"""Step 1 of validating the V4 catalog: is every source real, and is it the paper we say it is?

For each of the 463 sources:
  DOI  -> Crossref: does it exist; does its title, year and first author match our citation;
          has anything retracted it or raised a concern; then PubMed: its abstract, if indexed.
  URL  -> does the page load; its title.
Reads public databases only. Results go to results.json, one entry per source, saved as it goes.
"""
import json, re, sys, time, threading, html
import urllib.request, urllib.parse, urllib.error
from concurrent.futures import ThreadPoolExecutor

HERE = sys.argv[1]
UA = {'User-Agent': 'DistillCatalogCheck/1.0 (citation verification)'}
data = json.load(open(f'{HERE}/catalog.json'))
sources = data['sources']
out_path = f'{HERE}/results.json'
try:
    results = json.load(open(out_path))
except Exception:
    results = {}
lock = threading.Lock()

class Throttle:
    def __init__(self, per_sec):
        self.gap, self.next, self.lock = 1 / per_sec, 0.0, threading.Lock()
    def wait(self):
        with self.lock:
            now = time.time()
            t = max(now, self.next)
            self.next = t + self.gap
        time.sleep(max(0, t - now))

crossref, ncbi, web = Throttle(8), Throttle(2.5), Throttle(6)

def get(url, throttle, accept=None, tries=3):
    for a in range(tries):
        throttle.wait()
        req = urllib.request.Request(url, headers={**UA, **({'Accept': accept} if accept else {})})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.status, r.read(), r.geturl()
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 504) and a < tries - 1:
                time.sleep(2 * (a + 1)); continue
            return e.code, b'', url
        except Exception as e:
            if a < tries - 1:
                time.sleep(2 * (a + 1)); continue
            return 0, str(e).encode(), url

STOP = set('the and for with from that this into over under after before among between their than were was are its of in on to a an by as at or vs versus'.split())
def words(s):
    s = html.unescape(re.sub(r'<[^>]+>', ' ', s or '')).lower()
    return [w for w in re.findall(r'[a-z0-9]+', s) if len(w) > 2 and w not in STOP]

def title_match(title, citation):
    tw = words(title)
    if not tw: return None
    cw = set(words(citation))
    return round(sum(1 for w in tw if w in cw) / len(tw), 2)

def doi_of(s):
    m = re.search(r'(10\.\d{4,9}/[^\s"<>]+)', str(s))
    return m.group(1).rstrip('.,;)') if m else None

def check(s):
    sid = s['id']
    if sid in results: return
    raw = str(s['doi_or_url']).strip()
    doi = doi_of(raw)
    r = {'id': sid, 'link': raw, 'rows': s['rows'], 'type': s['type'], 'year': s['year'], 'checked_by': s['checked_by'], 'brand_funded': s['brand_funded']}
    if doi:
        r['doi'] = doi
        st, body, _ = get('https://api.crossref.org/works/' + urllib.parse.quote(doi), crossref)
        r['crossref'] = st
        if st == 200:
            m = json.loads(body)['message']
            title = (m.get('title') or [''])[0]
            parts = (m.get('issued') or {}).get('date-parts') or [[None]]
            year = parts[0][0] if parts and parts[0] else None
            authors = [a.get('family', '') for a in m.get('author', []) if a.get('family')]
            r.update({
                'found_title': html.unescape(re.sub(r'<[^>]+>', '', title)),
                'found_year': year,
                'found_journal': (m.get('container-title') or [''])[0],
                'first_author': authors[0] if authors else None,
                'title_match': title_match(title, s['citation']),
                'author_in_citation': (authors[0].lower() in str(s['citation']).lower()) if authors else None,
                'year_gap': (abs(int(s['year']) - int(year)) if (s['year'] and year) else None),
                'notices': [u.get('type') for u in m.get('update-to', [])],
            })
            # Anything published that updates this paper: a retraction, a withdrawal, a concern.
            st2, body2, _ = get('https://api.crossref.org/works?rows=20&filter=updates:' + urllib.parse.quote(doi), crossref)
            if st2 == 200:
                upd = []
                for it in json.loads(body2)['message'].get('items', []):
                    for u in it.get('update-to', []):
                        if u.get('DOI', '').lower() == doi.lower():
                            upd.append(u.get('type'))
                r['updated_by'] = upd
        else:
            st3, _, final = get('https://doi.org/' + doi, web)
            r['doi_resolves'] = st3
            r['doi_lands'] = final
        # PubMed abstract, when the paper is indexed there.
        st4, body4, _ = get('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&term=' + urllib.parse.quote(f'{doi}[DOI]'), ncbi)
        if st4 == 200:
            ids = json.loads(body4).get('esearchresult', {}).get('idlist', [])
            if ids:
                r['pmid'] = ids[0]
                st5, body5, _ = get(f'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&rettype=abstract&retmode=xml&id={ids[0]}', ncbi)
                if st5 == 200:
                    x = body5.decode('utf8', 'replace')
                    abst = ' '.join(html.unescape(re.sub(r'<[^>]+>', '', a)) for a in re.findall(r'<AbstractText[^>]*>(.*?)</AbstractText>', x, re.S))
                    r['abstract'] = abst.strip()
                    r['pubmed_retracted'] = ('Retracted Publication' in x) or ('<CommentsCorrections RefType="RetractionIn"' in x)
                    r['pubmed_concern'] = 'ExpressionOfConcernIn' in x
    else:
        st, body, final = get(raw, web, accept='text/html,application/xhtml+xml')
        r['web'] = st
        r['lands'] = final
        if st == 200:
            t = re.search(rb'<title[^>]*>(.*?)</title>', body, re.S | re.I)
            r['page_title'] = html.unescape(t.group(1).decode('utf8', 'replace')).strip()[:200] if t else ''
            r['title_match'] = title_match(r['page_title'], s['citation'])
    with lock:
        results[sid] = r
        if len(results) % 20 == 0:
            json.dump(results, open(out_path, 'w'), indent=1)
            print(len(results), 'done', flush=True)

with ThreadPoolExecutor(6) as ex:
    list(ex.map(check, sources))
json.dump(results, open(out_path, 'w'), indent=1)
print('finished', len(results))
