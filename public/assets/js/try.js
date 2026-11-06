/* What's on your list: tap what you take or do, and the app's own engine says what could go and why,
   what comes down to how it feels, what's worth changing and what's well-founded (POST /api/try on
   the app; nothing is stored). Everything is a proposal, and the engine always protects what's
   well-founded, so the page can take each tap as something a feed sold them. */
import { $, $$, money, motionOK, whenNear } from './util.js';
import { Reel } from './reels.js';

const APP = new URLSearchParams(location.search).get('api') || 'https://distill-app-nu.vercel.app';
const ROWS = 6;   // what the panel lists before it says "and n more"; the whole list is the app's
const words = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const perMonth = i => (i.monthly ? `${money(i.monthly)}/mo` : '');

export function initTry() {
  const root = $('[data-try]');
  if (!root) return;
  const chips = $$('[data-chips] button', root);
  const label = new Map(chips.map(c => [c.dataset.k, c.textContent.trim()]));
  const nReel = new Reel($('[data-t-n]', root));
  const cReel = new Reel($('[data-t-c]', root));
  const unit = $('[data-t-unit]', root);
  const empty = $('[data-empty]', root), outBox = $('[data-out]', root);
  const line = $('[data-line]', root), list = $('[data-cut-list]', root), groups = $('[data-groups]', root);
  const note = $('[data-note-line]', root);
  const peek = $('[data-peek]', root), peekText = $('[data-peek-text]', root);
  const picked = [];
  const unfelt = new Set();   // "Not really" on "Can you feel it doing something for you?"
  let asked = 0, timer = 0, onScreen = new Set();
  const name = i => label.get(i.key) || i.name;

  function count(n) {
    nReel.set(n);
    unit.textContent = n === 1 ? 'thing' : 'things';
  }

  function ask() {
    clearTimeout(timer);
    count(picked.length);
    if (!picked.length) {
      asked++;   // whatever is still on its way is about a list that no longer exists
      root.removeAttribute('aria-busy');
      return render(null);
    }
    timer = setTimeout(async () => {
      const mine = ++asked;
      root.setAttribute('aria-busy', 'true');
      try {
        const res = await fetch(`${APP}/api/try`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: picked.map(key => ({ key, feed: true, ...(unfelt.has(key) ? { feels: false } : {}) })) }),
        });
        if (!res.ok) throw new Error(String(res.status));
        const r = await res.json();
        if (mine === asked) render(r);
      } catch {
        if (mine === asked) failed();
      } finally {
        if (mine === asked) root.removeAttribute('aria-busy');
      }
    }, 120);
  }

  function failed() {
    empty.hidden = true; outBox.hidden = false; note.hidden = true; peek.hidden = true;
    line.textContent = "We couldn't read your list just now. Tap again in a moment.";
    list.innerHTML = ''; groups.innerHTML = '';
    onScreen = new Set();
  }

  function headline(items, go, look, adjust, back) {
    const n = go.length;
    if (n) {
      const which = items.length === 1 ? 'this' : n === items.length ? (n === 2 ? 'both of these' : 'all of these') : `${words[n] || n} of these`;
      const sum = back ? `, and keep <em>${money(back)} a month.</em><span class="tally__year">That's ${money(back * 12)} a year.</span>` : '.';
      return `You could let go of <b>${which}</b>${sum}`;
    }
    const one = look.length === 1;
    if (look.length) return `The studies are mixed on ${one ? 'this' : 'these'}. <em>It comes down to whether you can feel ${one ? 'it' : 'them'}.</em>`;
    if (adjust.length) return `Nothing has to go. <em>${adjust.length === 1 ? 'One small change keeps' : 'A few small changes keep'} what you like.</em>`;
    return "Nothing here looks like noise. <em>That's a good sign.</em>";
  }

  /* the reason, and the simpler thing that does the same job when there is one */
  const reason = i => `<small>${esc(i.why)}</small>${i.instead ? `<small class="tally__instead">→ ${esc(i.instead)}</small>` : ''}`;

  function letGoRows(go) {
    const sorted = [...go].sort((a, b) => b.monthly - a.monthly);
    // What they answered themselves always stays in view, so it can be taken back.
    const shown = sorted.filter((i, x) => x < ROWS || unfelt.has(i.key));
    const rest = sorted.filter(i => !shown.includes(i));
    const rows = shown.map((i, x) => `<li data-row="go:${esc(i.key)}"><span>${String(x + 1).padStart(2, '0')}</span><b>${esc(name(i))}${reason(i)}</b><span>${perMonth(i)}</span>${
      unfelt.has(i.key) ? `<button type="button" class="tally__undo" data-unfelt="${esc(i.key)}">Undo</button>` : ''}</li>`);
    if (rest.length) {
      const sum = rest.reduce((s, i) => s + i.monthly, 0);
      rows.push(`<li class="tally__rest" data-row="rest"><span></span><b>${rest.length} more</b><span>${sum ? `${money(sum)}/mo` : ''}</span></li>`);
    }
    return rows.join('');
  }

  function group(title, sub, rows) {
    if (!rows.length) return '';
    return `<section class="tally__group"><h3 class="tally__head">${title}</h3>${sub ? `<p class="tally__sub">${sub}</p>` : ''}<ul class="tally__rows">${rows.join('')}</ul></section>`;
  }

  function render(r) {
    const items = r ? r.items : [];
    count(r ? items.length : picked.length);
    cReel.set(items.reduce((s, i) => s + i.monthly, 0));
    const of = status => items.filter(i => i.status === status);
    const go = of('go'), look = of('look'), adjust = of('adjust'), founded = of('founded'), stays = of('stays');
    const back = r ? r.back : 0;

    peek.hidden = !picked.length;
    peekText.textContent = go.length
      ? `${words[go.length] ? words[go.length][0].toUpperCase() + words[go.length].slice(1) : go.length} could go${back ? `, ${money(back)} a month back` : ''}`
      : `${picked.length} on your list`;

    if (!items.length) {
      empty.hidden = false; outBox.hidden = true;
      list.innerHTML = ''; groups.innerHTML = '';
      onScreen = new Set();
      return;
    }
    empty.hidden = true; outBox.hidden = false; note.hidden = false;

    // Tapping "Not really" redraws its row elsewhere; keep the keyboard on it.
    const focused = document.activeElement?.dataset?.unfelt;
    line.innerHTML = headline(items, go, look, adjust, back);
    list.innerHTML = letGoRows(go);
    groups.innerHTML = [
      group(look.length === 1 ? 'Can you feel it working?' : 'Can you feel these working?', go.length ? 'The studies are mixed, so your experience decides.' : '',
        look.map(i => `<li data-row="look:${esc(i.key)}"><b>${esc(name(i))}<small>${esc(i.why)}</small><span class="tally__money">${perMonth(i)}</span></b><button type="button" class="chip chip--small" data-unfelt="${esc(i.key)}">Not really</button></li>`)),
      group('Keep it, change it', '', adjust.map(i => `<li data-row="adjust:${esc(i.key)}"><b>${esc(name(i))}${reason(i)}</b></li>`)),
      group('Well-founded', '', founded.map(i => `<li data-row="founded:${esc(i.key)}"><b>${esc(name(i))}<small>${esc(i.why)}</small></b></li>`)),
      group('Yours', 'The rest stays, shaped into your Ritual.', stays.map(i => `<li data-row="stays:${esc(i.key)}"><b>${esc(name(i))}</b></li>`)),
    ].join('');
    if (focused) $(`[data-unfelt="${CSS.escape(focused)}"]`, outBox)?.focus();

    // Only what just arrived moves; everything already there holds still.
    const rows = $$('[data-row]', outBox);
    const fresh = rows.filter(el => !onScreen.has(el.dataset.row));
    onScreen = new Set(rows.map(el => el.dataset.row));
    if (fresh.length && motionOK()) gsap.fromTo(fresh, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: .5, ease: 'out', stagger: .04, clearProps: 'opacity,transform' });
  }

  outBox.addEventListener('click', e => {
    const b = e.target.closest('[data-unfelt]');
    if (!b) return;
    const k = b.dataset.unfelt;
    if (unfelt.has(k)) unfelt.delete(k); else unfelt.add(k);
    ask();
  });

  chips.forEach(c => {
    c.setAttribute('aria-pressed', 'false');
    c.addEventListener('click', () => {
      const k = c.dataset.k, at = picked.indexOf(k);
      if (at >= 0) { picked.splice(at, 1); unfelt.delete(k); } else picked.push(k);
      c.setAttribute('aria-pressed', String(at < 0));
      ask();
    });
  });

  // The first tap shouldn't wait for the app to wake up.
  whenNear(root, () => {
    fetch(`${APP}/api/try`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"items":[]}' }).catch(() => {});
  }, '0px 0px 40% 0px');
}
