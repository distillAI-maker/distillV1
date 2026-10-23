/* The Founding 100: one email, saved straight away, then "You're in."
   Posts to the Supabase `signups` table, which only allows inserts for this key. */
import { $, $$ } from './util.js';

const CFG = {
  url: 'https://hzwiikkttligpmkvondy.supabase.co',
  key: 'sb_publishable_LnnDGCp21cdBGXzoBx-yZQ_MDoWAubE',
  table: 'signups',
};
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CHECK = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M3 7.4l2.6 2.6L11 4.6"/></svg>';

export function initJoin() {
  $$('form[data-join]').forEach(form => {
    const emailStep = $('[data-step="email"]', form);
    const input = $('input[type="email"]', form);
    const button = $('button[type="submit"]', form);
    const msg = $('.join__msg', form);
    const say = (state, html) => { form.dataset.state = state; msg.innerHTML = html; };
    let busy = false;

    input.addEventListener('input', () => { if (form.dataset.state === 'note') say('', ''); });

    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (busy) return;
      const email = input.value.trim().toLowerCase();
      if (!EMAIL.test(email)) { say('note', 'That email looks a little short. Mind checking it?'); input.focus(); return; }
      busy = true;
      button.disabled = true;
      say('busy', 'Saving…');
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 12000);
      try {
        const res = await fetch(`${CFG.url}/rest/v1/${CFG.table}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: CFG.key, Prefer: 'return=minimal' },
          body: JSON.stringify({ email, wearable: null, source: form.dataset.join, user_agent: navigator.userAgent.slice(0, 400) }),
          signal: ctrl.signal,
        });
        if (res.ok || res.status === 409) {
          emailStep.hidden = true;
          say('ok', `${CHECK}<span>${res.ok ? "You're in. We'll write when your spot opens." : "You're already on the list. We'll write when your spot opens."}</span>`);
        } else throw new Error(String(res.status));
      } catch {
        say('note', 'That didn\'t go through. Try again in a moment, or write to <a href="mailto:disttilai@gmail.com">disttilai@gmail.com</a>.');
      } finally {
        clearTimeout(timer);
        busy = false;
        button.disabled = false;
      }
    });
  });
}
