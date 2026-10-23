/* What's on your list: tap what you take or do, and the app's own engine says what could go, what's
   well-founded and what's worth a look (POST /api/try on the app; nothing is stored). Where it
   matters, it asks the app's first question: did it come from a feed? */
import { $, $$, money, motionOK } from './util.js';
import { Reel } from './reels.js';

const APP = new URLSearchParams(location.search).get('api') || 'https://distill-app-nu.vercel.app';
const words = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const lower = s => s.replace(/^([A-Z])(?=[a-z])/, c => c.toLowerCase());
const listOf = a => (a.length < 3 ? a.join(' and ') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);

export function initTry() {
  const root = $('[data-try]');
  if (!root) return;
  const chips = $$('[data-chips] button', root);
  const label = new Map(chips.map(c => [c.dataset.k, c.textContent.trim()]));
  const nReel = new Reel($('[data-t-n]', root));
  const cReel = new Reel($('[data-t-c]', root));
  const empty = $('[data-empty]', root), outBox = $('[data-out]', root);
  const line = $('[data-line]', root), list = $('[data-cut-list]', root), more = $('[data-test]', root);
  const feedBox = $('[data-feed]', root), feedChips = $('[data-feed-chips]', root);
  const picked = [];
  const feed = new Set();
  let asked = 0, timer = 0, last = null;

  function ask() {
    clearTimeout(timer);
    if (!picked.length) { last = null; return render(null); }
    timer = setTimeout(async () => {
      const mine = ++asked;
      root.setAttribute('aria-busy', 'true');
      try {
        const res = await fetch(`${APP}/api/try`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: picked.map(key => ({ key, feed: feed.has(key) })) }),
        });
        if (!res.ok) throw new Error(String(res.status));
        const r = await res.json();
        if (mine === asked) { last = r; render(r); }
      } catch {
        if (mine === asked) failed();
      } finally {
        if (mine === asked) root.removeAttribute('aria-busy');
      }
    }, 120);
  }

  function failed() {
    empty.hidden = true; outBox.hidden = false; feedBox.hidden = true;
    line.textContent = "We couldn't read your list just now. Tap again in a moment.";
    list.innerHTML = ''; more.textContent = '';
  }

  function render(r) {
    const items = r ? r.items : [];
    nReel.set(items.length);
    cReel.set(items.reduce((s, i) => s + i.monthly, 0));
    if (!items.length) { empty.hidden = false; outBox.hidden = true; return; }
    empty.hidden = true; outBox.hidden = false;
    const name = i => label.get(i.key) || i.name;
    const go = items.filter(i => i.status === 'go');
    const look = items.filter(i => i.status === 'look');
    const founded = items.filter(i => i.status === 'founded');
    const adjust = items.filter(i => i.status === 'adjust');
    const n = go.length;

    if (n) line.innerHTML = `You could let go of <b>${n === 1 ? 'one of these' : `${words[n] || n} of these`}</b>` +
      (r.back ? `, and keep <em>${money(r.back)} a month.</em>` : '.');
    else if (look.length) line.innerHTML = 'Nothing to let go of yet.';
    else line.innerHTML = "Nothing here looks like noise. <em>That's a good sign.</em>";

    list.innerHTML = go.map((i, x) => `<li><span>${String(x + 1).padStart(2, '0')}</span><b>${esc(name(i))}<small>${esc(i.why)}</small></b><span>${i.monthly ? `${money(i.monthly)}/mo` : ''}</span></li>`).join('');

    // The app's first question, only where the answer changes something.
    const askable = items.filter(i => i.status === 'look' || feed.has(i.key));
    feedBox.hidden = !askable.length;
    feedChips.innerHTML = askable.map(i => `<button type="button" class="chip chip--small" data-feed-k="${esc(i.key)}" aria-pressed="${feed.has(i.key)}">${esc(name(i))}</button>`).join('');

    const rest = [];
    if (founded.length) rest.push(`Well-founded: ${esc(listOf(founded.map(i => lower(name(i)))))}.`);
    if (adjust.length) rest.push(`Worth keeping, done a little differently: ${esc(listOf(adjust.map(i => lower(name(i)))))}.`);
    if (items.some(i => i.status === 'stays')) rest.push('The rest stays, shaped into your Ritual.');
    more.innerHTML = rest.join(' ');

    if (motionOK()) gsap.fromTo(list.children, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: .5, ease: 'out', stagger: .04 });
  }

  feedChips.addEventListener('click', e => {
    const b = e.target.closest('[data-feed-k]');
    if (!b) return;
    const k = b.dataset.feedK;
    if (feed.has(k)) feed.delete(k); else feed.add(k);
    b.setAttribute('aria-pressed', String(feed.has(k)));
    ask();
  });

  chips.forEach(c => {
    c.setAttribute('aria-pressed', 'false');
    c.addEventListener('click', () => {
      const k = c.dataset.k, at = picked.indexOf(k);
      if (at >= 0) { picked.splice(at, 1); feed.delete(k); } else picked.push(k);
      c.setAttribute('aria-pressed', String(at < 0));
      ask();
    });
  });
}
