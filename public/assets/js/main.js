import { $, $$, motionOK, finePointer } from './util.js';
import { initTry } from './try.js';
import { initJoin } from './join.js';

const root = document.documentElement;
window.distillReady = true;
const hasGsap = !!(window.gsap && window.ScrollTrigger);
const motion = hasGsap && motionOK();

if (hasGsap) {
  gsap.registerPlugin(ScrollTrigger);
  gsap.registerEase('out', gsap.parseEase('expo.out'));
  gsap.defaults({ ease: 'out' });
}
if (!motion) root.classList.remove('mo');

if (motion && finePointer() && window.Lenis) {
  const lenis = new Lenis({ autoRaf: false, lerp: .1, anchors: { offset: -60 } });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(t => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}

initJoin();
initTry();

/* ── Your Standard shows today's date ── */
const today = $('[data-today]');
if (today) {
  const d = new Date();
  today.textContent = `${d.toLocaleDateString('en-GB', { weekday: 'long' })} · ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}`;
}

/* ── how it works: one phone, its screen follows the step you're reading.
   On a phone-sized screen each step gets its own copy of that screen instead. ── */
const how = $('[data-how]');
if (how) {
  const steps = $$('.how__step', how);
  const screens = $$('.scr', how);
  const phone = $('[data-phone]', how);
  steps.forEach((step, i) => {
    const copy = phone.cloneNode(true);
    copy.removeAttribute('data-phone');
    copy.classList.add('phone--inline');
    copy.setAttribute('aria-hidden', 'true');
    $$('.scr', copy).forEach((s, j) => (j === i ? s.classList.add('is-on') : s.remove()));
    step.append(copy);
  });
  const show = i => {
    steps.forEach((s, j) => s.classList.toggle('is-on', j === i));
    screens.forEach((s, j) => s.classList.toggle('is-on', j === i));
  };
  show(0);
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) show(steps.indexOf(e.target));
  }), { rootMargin: '-45% 0px -45% 0px' });
  steps.forEach(s => io.observe(s));
}

/* ── nav: a hairline once you scroll; tucks away while you read down ── */
const nav = $('[data-nav]');
let lastY = scrollY;
const onScroll = () => {
  const y = scrollY;
  nav.classList.toggle('is-solid', y > 10);
  nav.classList.toggle('is-hidden', y > lastY && y > 500 && !nav.contains(document.activeElement));
  lastY = y;
};
addEventListener('scroll', onScroll, { passive: true });
onScroll();

if (motion) {
  /* hero: the line rises, the rest follows */
  gsap.timeline({ delay: .05 })
    .to('.hero__title .ln > span', { y: 0, duration: 1.4, stagger: .12 }, .1)
    .to('[data-hero-in]', { opacity: 1, duration: 1.2, stagger: .1 }, .45)
    .fromTo('.phone--hero', { y: 60 }, { y: 0, duration: 1.8 }, .45);

  const rise = (targets, trigger, vars = {}) => gsap.from(targets, {
    opacity: 0, y: 26, duration: 1.2, stagger: .08, ...vars,
    scrollTrigger: { trigger, start: 'top 86%', once: true },
  });
  rise('.try__pick > *', '.try');
  rise('.tally', '.tally', { y: 36 });
  rise('.founding__copy > *', '.founding');

  /* the founding card tips up into view, then leans toward the pointer */
  const card = $('[data-card]');
  if (card) {
    const face = $('.member', card);
    gsap.from(card, { rotationX: 28, y: 80, opacity: 0, transformPerspective: 1200, transformOrigin: '50% 100%', duration: 1.6,
      scrollTrigger: { trigger: '.founding', start: 'top 80%', once: true } });
    if (finePointer()) {
      const ry = gsap.quickTo(face, 'rotationY', { duration: .8, ease: 'power3' });
      const rx = gsap.quickTo(face, 'rotationX', { duration: .8, ease: 'power3' });
      const zone = card.closest('section');
      zone.addEventListener('pointermove', e => {
        const r = card.getBoundingClientRect();
        ry(gsap.utils.clamp(-1, 1, (e.clientX - (r.left + r.width / 2)) / r.width) * 10);
        rx(gsap.utils.clamp(-1, 1, (e.clientY - (r.top + r.height / 2)) / r.height) * -8);
      });
      zone.addEventListener('pointerleave', () => { ry(0); rx(0); });
    }
  }

  document.fonts?.ready.then(() => ScrollTrigger.refresh());
  addEventListener('load', () => ScrollTrigger.refresh());
}

/* motion switch */
const toggle = $('[data-motion-toggle]');
const off = root.dataset.motion === 'off';
toggle.textContent = `Motion: ${off ? 'off' : 'on'}`;
toggle.setAttribute('aria-pressed', String(off));
toggle.addEventListener('click', () => { try { localStorage.setItem('distill-motion', off ? 'on' : 'off'); } catch {} location.reload(); });
