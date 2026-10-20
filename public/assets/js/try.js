/* What's on your list: tap common items, see the stack as one number and what could come off today,
   using the real Routing Table data (public/assets/data/stack.json). */
import { $, $$, money, whenNear, motionOK } from './util.js';
import { Reel } from './reels.js';

const WHY = {
  'dose too low': 'The dose is below what studies used',
  'form not absorbed': 'This form barely absorbs',
  'tested, found nothing': 'Studies found nothing',
  'no way it could work': 'No known way it works',
  'overlaps with something else': 'Does the same job as another',
  'not being used': 'Not being used',
};
const KEEP_FIRST = ['magnesium', 'omega-3', 'collagen', 'meditation apps', 'fitness memberships', 'electrolytes', 'heat and cold', 'massage'];
const SEPARATES = ['zinc-daily', 'vitamin-d3', 'vitamin-b12', 'vitamin-c-daily', 'vitamin-k2', 'b-complex'];
const short = n => n.replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
const lower = s => s.replace(/^([A-Z])(?=[a-z])/, c => c.toLowerCase());
const groups = it => it.g.split(',').map(s => s.trim()).filter(Boolean);
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const words = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const listOf = a => (a.length < 3 ? a.join(' and ') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);

function route(list) {
  const out = new Map(list.map(it => [it.k, { lane: it.lane, why: it.lane === 'cut' ? (WHY[it.why] || 'Not doing much for you') : '', back: it.lane === 'cut' ? it.$ : 0 }]));
  const multi = list.find(i => i.k === 'multivitamin' || i.k === 'greens-powder-ag1-etc');
  if (multi) list.filter(i => SEPARATES.includes(i.k)).forEach(i => out.set(i.k, { lane: 'cut', why: `Already in your ${lower(short(multi.n))}`, back: i.$ }));
  KEEP_FIRST.forEach(g => {
    const inG = list.filter(i => groups(i).includes(g));
    inG.slice(1).forEach(i => out.set(i.k, { lane: 'cut', why: `Same job as your ${lower(short(inG[0].n))}`, back: i.$ }));
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
  const line = $('[data-line]', root), list = $('[data-cut-list]', root), more = $('[data-test]', root);
  let byKey = null, loading = null;
  const picked = [];

  const load = () => loading || (loading = fetch('/assets/data/stack.json')
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(d => { byKey = new Map(d.items.map(i => [i.k, i])); })
    .catch(() => { loading = null; empty.textContent = "The list didn't load. Tap again in a moment."; }));
  whenNear(root, load, '600px 0px 600px 0px');

  function render() {
    const items = picked.map(k => byKey.get(k)).filter(Boolean);
    nReel.set(items.length);
    cReel.set(items.reduce((s, i) => s + i.$, 0));
    if (!items.length) { empty.hidden = false; outBox.hidden = true; return; }
    empty.hidden = true; outBox.hidden = false;

    const r = route(items);
    const cut = items.filter(i => r.get(i.k).lane === 'cut');
    const look = items.filter(i => r.get(i.k).lane === 'test');
    const sum = cut.reduce((s, i) => s + r.get(i.k).back, 0);
    const n = cut.length;

    if (!n) line.innerHTML = "Nothing here looks like noise. <em>That's a good sign.</em>";
    else {
      const count = n === 1 ? 'one of these' : `${words[n] || n} of these`;
      line.innerHTML = `You could let go of <b>${count}</b> today` + (sum ? `, and keep <em>${money(sum)} a month.</em>` : '.');
    }
    list.innerHTML = cut.slice(0, 4).map((i, x) => `<li><span>0${x + 1}</span><b>${esc(short(i.n))}</b><span>${esc(r.get(i.k).why)}</span></li>`).join('') +
      (n > 4 ? `<li><span></span><b>${n - 4} more</b><span></span></li>` : '');
    const rest = [];
    if (look.length) rest.push(`Worth a closer look together: ${esc(listOf(look.map(i => lower(short(i.n)))))}.`);
    if (items.length > n) rest.push('Everything else stays while we get to know you.');
    more.innerHTML = rest.join(' ');

    if (motionOK()) gsap.fromTo(list.children, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: .5, ease: 'out', stagger: .04 });
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
