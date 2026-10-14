/* Waitlist in two steps: email, then one tap for the wearable (or skip).
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
    const wearStep = $('[data-step="wear"]', form);
    const input = $('input[type="email"]', form);
    const msg = $('.join__msg', form);
    const say = (state, html) => { form.dataset.state = state; msg.innerHTML = html; };
    let email = '';

    input.addEventListener('input', () => { if (form.dataset.state === 'note') say('', ''); });

    form.addEventListener('submit', e => {
      e.preventDefault();
      email = input.value.trim().toLowerCase();
      if (!EMAIL.test(email)) { say('note', 'That email looks incomplete.'); input.focus(); return; }
      say('', '');
      emailStep.hidden = true;
      wearStep.hidden = false;
      if (window.gsap) gsap.fromTo(wearStep.children, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: .5, ease: 'expo.out', stagger: .06 });
      $('button', wearStep).focus({ preventScroll: true });
    });

    const send = async wearable => {
      $$('button', wearStep).forEach(b => { b.disabled = true; });
      say('busy', 'Saving…');
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 12000);
      try {
        const res = await fetch(`${CFG.url}/rest/v1/${CFG.table}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: CFG.key, Prefer: 'return=minimal' },
          body: JSON.stringify({ email, wearable, source: form.dataset.join, user_agent: navigator.userAgent.slice(0, 400) }),
          signal: ctrl.signal,
        });
        if (res.ok || res.status === 409) {
          wearStep.hidden = true;
          say('ok', `${CHECK}<span>${res.ok ? "You're on the list. We'll email you when your spot opens." : "You're already on the list. We'll be in touch."}</span>`);
        } else throw new Error(String(res.status));
      } catch {
        say('note', 'That didn\'t go through. Try again in a moment, or email <a href="mailto:disttilai@gmail.com">disttilai@gmail.com</a>.');
      } finally {
        clearTimeout(timer);
        $$('button', wearStep).forEach(b => { b.disabled = false; });
      }
    };
    $$('.join__chips button', wearStep).forEach(b => b.addEventListener('click', () => send(b.value)));
    $('[data-skip]', wearStep).addEventListener('click', () => send(null));
  });
}
