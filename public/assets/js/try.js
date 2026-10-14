/* What's on your list: tap common items, see what the day-one sort would do,
   using the real Routing Table data (public/assets/data/stack.json). */
import { $, $$, money, whenNear } from './util.js';
import { Reel } from './reels.js';

const WHY = {
  'dose too low': 'Dose too low',
  'form not absorbed': 'Form not absorbed',
  'tested, found nothing': 'Tested, found nothing',
  'no way it could work': 'No known way it works',
  'overlaps with something else': 'Same job as something else',
  'not being used': 'Not being used',
};
const KEEP_FIRST = ['magnesium', 'omega-3', 'collagen', 'meditation apps', 'fitness memberships', 'electrolytes', 'heat and cold', 'massage'];
const SEPARATES = ['zinc-daily', 'vitamin-d3', 'vitamin-b12', 'vitamin-c-daily', 'vitamin-k2', 'b-complex'];
const short = n => n.replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
const groups = it => it.g.split(',').map(s => s.trim()).filter(Boolean);
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function route(list) {
  const out = new Map(list.map(it => [it.k, { lane: it.lane, why: it.lane === 'cut' ? (WHY[it.why] || 'No test needed') : '', back: it.lane === 'cut' ? it.$ : 0 }]));
  const multi = list.find(i => i.k === 'multivitamin' || i.k === 'greens-powder-ag1-etc');
  if (multi) list.filter(i => SEPARATES.includes(i.k)).forEach(i => out.set(i.k, { lane: 'cut', why: `Covered by ${short(multi.n)}`, back: i.$ }));
  KEEP_FIRST.forEach(g => {
    const inG = list.filter(i => groups(i).includes(g));
    inG.slice(1).forEach(i => out.set(i.k, { lane: 'cut', why: `Same job as ${short(inG[0].n)}`, back: i.$ }));
  });
  return out;
}

export function initTry() {
  const root = $('[data-try]');
  if (!root) return;
  const chips = $$('[data-chips] button', root);
  const nReel = new Reel($('[data-t-n]', root));
  const cReel = new Reel($('[data-t-c]', root));
  const empty = $('[data-empty]', root), outBox = $('[data-out]', root);
  const cutN = $('[data-cut-n]', root), back = $('[data-back]', root);
  const list = $('[data-cut-list]', root), test = $('[data-test]', root);
  let byKey = null, loading = null;
  const picked = [];

  const load = () => loading || (loading = fetch('/assets/data/stack.json')
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(d => { byKey = new Map(d.items.map(i => [i.k, i])); })
    .catch(() => { loading = null; empty.textContent = "The item list didn't load. Tap again in a moment."; }));
  whenNear(root, load, '600px 0px 600px 0px');

  function render() {
    const items = picked.map(k => byKey.get(k)).filter(Boolean);
    nReel.set(items.length);
    cReel.set(items.reduce((s, i) => s + i.$, 0));
    if (!items.length) { empty.hidden = false; outBox.hidden = true; return; }
    empty.hidden = true; outBox.hidden = false;
    const r = route(items);
    const cut = items.filter(i => r.get(i.k).lane === 'cut');
    const tests = items.filter(i => r.get(i.k).lane === 'test');
    const sum = cut.reduce((s, i) => s + r.get(i.k).back, 0);
    cutN.textContent = cut.length === 1 ? '1 thing' : `${cut.length} things`;
    back.textContent = `${money(sum)} a month back.`;
    back.hidden = !cut.length;
    list.innerHTML = cut.slice(0, 4).map(i => `<li><span>${esc(short(i.n))}</span><span>${esc(r.get(i.k).why)}</span></li>`).join('') +
      (cut.length > 4 ? `<li><span>${cut.length - 4} more</span><span></span></li>` : '');
    test.textContent = tests.length ? `Worth testing on you: ${tests.map(i => short(i.n)).join(', ')}.` : '';
    if (window.gsap && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.fromTo(list.children, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: .45, ease: 'expo.out', stagger: .04 });
    }
  }

  chips.forEach(c => {
    c.setAttribute('aria-pressed', 'false');
    c.addEventListener('click', async () => {
      await load();
      if (!byKey) return;
      const k = c.dataset.k, at = picked.indexOf(k);
      if (at >= 0) picked.splice(at, 1); else picked.push(k);
      c.setAttribute('aria-pressed', String(at < 0));
      render();
    });
  });
}
