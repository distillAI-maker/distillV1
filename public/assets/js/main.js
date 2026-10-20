import { $, $$, motionOK, finePointer } from './util.js';
import { initTry } from './try.js';
import { initJoin } from './join.js';
import { initStory } from './story.js';

const root = document.documentElement;
window.distillReady = true;
const hasGsap = !!(window.gsap && window.ScrollTrigger);
const motion = hasGsap && motionOK();

if (hasGsap) {
  gsap.registerPlugin(ScrollTrigger, ...[window.SplitText].filter(Boolean));
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
initStory();

/* ── the rituals can be kept, one tap at a time ── */
$$('[data-ritual]').forEach(card => {
  const steps = $$('.ritual__list button', card);
  const note = $('[data-note]', card);
  const rest = note.textContent;
  steps.forEach(b => b.addEventListener('click', () => {
    b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'));
    const done = steps.every(s => s.getAttribute('aria-pressed') === 'true');
    card.classList.toggle('is-done', done);
    note.textContent = done ? note.dataset.done : rest;
  }));
});

/* ── nav: light over the hero, linen once you're reading; tucks away while you scroll down ── */
const nav = $('[data-nav]');
const hero = $('.hero');
let lastY = scrollY;
const onScroll = () => {
  const y = scrollY;
  nav.classList.toggle('is-solid', y > hero.offsetHeight - 70);
  nav.classList.toggle('is-hidden', y > lastY && y > hero.offsetHeight && !nav.contains(document.activeElement));
  lastY = y;
};
addEventListener('scroll', onScroll, { passive: true });
onScroll();

if (motion) {
  /* hero: the image settles, the line rises, the rest follows */
  const heroImg = $('.hero__img img');
  gsap.timeline({ delay: .05 })
    .fromTo(heroImg, { scale: 1.12 }, { scale: 1, duration: 2.6 }, 0)
    .to('.hero__title .ln > span', { y: 0, duration: 1.4, stagger: .12 }, .25)
    .to('[data-hero-in]', { opacity: 1, duration: 1.2, stagger: .1 }, .6)
    .from(nav, { opacity: 0, duration: 1 }, .4);
  gsap.to(heroImg, { yPercent: 8, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });

  /* headings rise out of their own lines, then go back to plain text so they reflow freely */
  document.fonts.ready.then(() => {
    if (!window.SplitText) return;
    $$('[data-lines]').forEach(el => {
      const split = SplitText.create(el, { type: 'lines', mask: 'lines', linesClass: 'line' });
      gsap.from(split.lines, {
        yPercent: 110, duration: 1.4, stagger: .1, onComplete: () => split.revert(),
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
      });
    });
  });

  const rise = (targets, trigger, vars = {}) => gsap.from(targets, {
    opacity: 0, y: 26, duration: 1.2, stagger: .08, ...vars,
    scrollTrigger: { trigger, start: 'top 86%', once: true },
  });
  $$('[data-rise]').forEach(el => rise(el, el));
  $$('[data-stagger]').forEach(el => rise(el.children, el, { stagger: .12 }));
  rise('[data-chips] button', '[data-chips]', { y: 14, duration: .9, stagger: .025 });
  rise('.tally', '.tally', { y: 36 });

  /* the interlude image drifts a little slower than the page */
  $$('[data-drift]').forEach(img => gsap.fromTo(img, { yPercent: -5 }, {
    yPercent: 5, ease: 'none', scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
  }));

  /* the founding card tips up into view, then leans toward the pointer */
  const card = $('[data-card]');
  if (card) {
    const face = $('.member', card);
    gsap.from(card, { rotationX: 28, y: 80, opacity: 0, transformPerspective: 1200, transformOrigin: '50% 100%', duration: 1.6,
      scrollTrigger: { trigger: '.founding', start: 'top 80%', once: true } });
    gsap.to('.seal', { rotation: 369, duration: 40, ease: 'none', repeat: -1 });
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
