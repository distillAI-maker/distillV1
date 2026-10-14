import { $, $$, motionOK, finePointer } from './util.js';
import { initStory } from './story.js';
import { initTry } from './try.js';
import { initJoin } from './join.js';
import { Reel } from './reels.js';

const root = document.documentElement;
const hasGsap = !!(window.gsap && window.ScrollTrigger);
const motion = hasGsap && motionOK();

if (hasGsap) {
  gsap.registerPlugin(ScrollTrigger, ...[window.SplitText, window.CustomEase].filter(Boolean));
  // one pair of curves for the whole page: a long, soft arrival and a firm move
  if (window.CustomEase) {
    CustomEase.create('out', '0.22, 1, 0.36, 1');
    CustomEase.create('inOut', '0.77, 0, 0.175, 1');
  } else {
    gsap.registerEase('out', gsap.parseEase('expo.out'));
    gsap.registerEase('inOut', gsap.parseEase('power4.inOut'));
  }
  gsap.defaults({ ease: 'out' });
}

let lenis = null;
if (motion && finePointer() && window.Lenis) {
  lenis = new Lenis({ autoRaf: false, lerp: .1, anchors: { offset: -20 } });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(t => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}

initJoin();
const story = initStory();
initTry();

/* ── hero: the headline rises in, then keeps asking about one thing at a time ── */
const words = $$('[data-rot] .rot__w');
if (motion) {
  const lines = $$('.hero .hl__in');
  gsap.set(lines, { yPercent: 112 });
  gsap.set('.hero__sub, .hero .join, .hero .facts li', { opacity: 0, y: 18 });
  root.classList.add('go');
  gsap.timeline({ delay: .1 })
    .to(lines, { yPercent: 0, duration: 1.2, stagger: .09 }, 0)
    .to('.hero__sub', { opacity: 1, y: 0, duration: 1 }, .4)
    .to('.hero .join', { opacity: 1, y: 0, duration: 1 }, .52)
    .to('.hero .facts li', { opacity: 1, y: 0, duration: .9, stagger: .07, clearProps: 'transform' }, .64)
    .from('.nav', { opacity: 0, duration: .8, clearProps: 'opacity' }, .2);

  document.fonts.ready.then(() => {
    if (!window.SplitText || words.length < 2) return;
    const split = words.map(w => SplitText.create(w, { type: 'words,chars', tag: 'span', charsClass: 'ch', aria: 'none' }));
    let i = 0, live = true;
    ScrollTrigger.create({ trigger: '.hero', start: 'top bottom', end: 'bottom top', onToggle: self => { live = self.isActive; } });
    const next = () => {
      if (live && !document.hidden) {
        const a = i, b = (i + 1) % words.length;
        i = b;
        words[b].classList.add('is-on');
        story?.hit(Number(words[b].dataset.row));
        gsap.timeline()
          .to(split[a].chars, { yPercent: -45, opacity: 0, filter: 'blur(6px)', duration: .34, ease: 'power2.in', stagger: .012 }, 0)
          .fromTo(split[b].chars, { yPercent: 55, opacity: 0, filter: 'blur(8px)' }, { yPercent: 0, opacity: 1, filter: 'blur(0px)', duration: .75, stagger: .024 }, .3)
          .add(() => { words[a].classList.remove('is-on'); gsap.set(split[a].chars, { yPercent: 0, opacity: 1, filter: 'none' }); }, .62);
      }
      loop.restart(true);
    };
    const loop = gsap.delayedCall(2.8, next);
    story?.hit(Number(words[0].dataset.row));
  });
} else {
  story?.hit(-1);
}

/* ── nav: a hairline once you scroll, hidden while reading down ── */
if (hasGsap) {
  const nav = $('[data-nav]');
  ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate: self => {
      const y = self.scroll();
      nav.classList.toggle('is-scrolled', y > 8);
      nav.classList.toggle('is-hidden', self.direction === 1 && y > 600 && !nav.contains(document.activeElement));
    },
  });
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
  addEventListener('load', () => ScrollTrigger.refresh());
}

if (motion) {
  /* section headings rise out of their own lines */
  document.fonts.ready.then(() => {
    $$('[data-lines]').forEach(el => SplitText.create(el, {
      type: 'lines', mask: 'lines', linesClass: 'line', autoSplit: true,
      onSplit: self => gsap.from(self.lines, { yPercent: 110, duration: 1.2, stagger: .08, scrollTrigger: { trigger: el, start: 'top 88%', once: true } }),
    }));
  });
  const rise = (targets, trigger, vars = {}) => gsap.from(targets, {
    opacity: 0, y: 24, duration: 1, stagger: .06, ...vars,
    scrollTrigger: { trigger, start: 'top 86%', once: true },
  });

  /* the band of things people pay for: drifts on its own, runs with your scroll */
  const track = $('[data-band]');
  if (track) {
    track.innerHTML += track.innerHTML;
    const tw = gsap.to(track, { xPercent: -50, duration: 60, ease: 'none', repeat: -1, paused: true });
    tw.totalTime(tw.duration() * 200);
    const speed = { v: 1 };
    const apply = () => tw.timeScale(speed.v);
    ScrollTrigger.create({
      trigger: track, start: 'top bottom', end: 'bottom top',
      onToggle: self => (self.isActive ? tw.resume() : tw.pause()),
      onUpdate: self => {
        const v = self.getVelocity();
        const dir = v < 0 ? -1 : 1;
        const target = dir * gsap.utils.clamp(1, 7, Math.abs(v) / 220);
        gsap.to(speed, { v: target, duration: .25, ease: 'power2.out', overwrite: true, onUpdate: apply,
          onComplete: () => gsap.to(speed, { v: dir, duration: 1.4, ease: 'power2.out', onUpdate: apply }) });
      },
    });
  }

  /* try it: the panel grows into place as it scrolls up */
  gsap.fromTo('.try', { scale: .93, y: 40 }, { scale: 1, y: 0, ease: 'none', scrollTrigger: { trigger: '.try', start: 'top bottom', end: 'top 45%', scrub: .6 } });
  rise('.try__sub', '.try');
  rise('[data-chips] button', '[data-chips]', { y: 16, scale: .94, duration: .7, stagger: .025 });
  rise('.result', '.result', { y: 36 });

  /* pricing: the card tips up into view; the price rolls in */
  const card = $('[data-card]');
  if (card) {
    const face = $('.member', card);
    gsap.fromTo(card, { rotationX: 32, y: 110, scale: .88, opacity: 0, transformPerspective: 1200, transformOrigin: '50% 100%' },
      { rotationX: 0, y: 0, scale: 1, opacity: 1, ease: 'none', scrollTrigger: { trigger: '.pricing', start: 'top bottom', end: 'top 30%', scrub: .7 } });
    const float = gsap.to(face, { y: -10, duration: 3.2, ease: 'sine.inOut', yoyo: true, repeat: -1, paused: true });
    ScrollTrigger.create({ trigger: card, start: 'top bottom', end: 'bottom top', onToggle: self => (self.isActive ? float.play() : float.pause()) });
    if (finePointer()) {
      const ry = gsap.quickTo(face, 'rotationY', { duration: .7, ease: 'power3' });
      const rx = gsap.quickTo(face, 'rotationX', { duration: .7, ease: 'power3' });
      const zone = card.closest('section');
      zone.addEventListener('pointermove', e => {
        const r = card.getBoundingClientRect();
        ry(gsap.utils.clamp(-1, 1, (e.clientX - (r.left + r.width / 2)) / r.width) * 12);
        rx(gsap.utils.clamp(-1, 1, (e.clientY - (r.top + r.height / 2)) / r.height) * -9);
      });
      zone.addEventListener('pointerleave', () => { ry(0); rx(0); });
    }
  }
  // the price rolls up while its heading fades in, so the reel is never read at $0
  const priceEl = $('[data-price]');
  const price = priceEl && new Reel(priceEl);
  price?.set(0, false);
  rise('.pricing__copy .h2', '.pricing__copy', { y: 30, onStart: () => price?.set(20) });
  rise('.checks li', '.checks', { x: -14, y: 0, stagger: .09, duration: .8 });
  rise('.pricing__copy .btn', '.pricing__copy .btn', { y: 16 });

  /* questions and the close */
  gsap.set('.faq details', { opacity: 0, y: 22 });
  ScrollTrigger.batch('.faq details', {
    start: 'top 92%', once: true,
    onEnter: batch => gsap.to(batch, { opacity: 1, y: 0, duration: .8, stagger: .07 }),
  });
  rise('.final__sub, .final .join', '.final', { stagger: .1 });

  /* primary buttons lean toward the pointer and give under a press */
  if (finePointer()) {
    $$('.btn:not(.btn--sm)').forEach(b => {
      b.classList.add('mag');
      const xTo = gsap.quickTo(b, 'x', { duration: .6, ease: 'power3' });
      const yTo = gsap.quickTo(b, 'y', { duration: .6, ease: 'power3' });
      const sTo = gsap.quickTo(b, 'scale', { duration: .16, ease: 'power2.out' });
      let r = null;
      b.addEventListener('pointerenter', () => { r = b.getBoundingClientRect(); });
      b.addEventListener('pointermove', e => {
        if (!r) return;
        xTo((e.clientX - r.left - r.width / 2) * .24);
        yTo((e.clientY - r.top - r.height / 2) * .32);
      });
      b.addEventListener('pointerleave', () => { r = null; xTo(0); yTo(0); sTo(1); });
      b.addEventListener('pointerdown', () => sTo(.96));
      b.addEventListener('pointerup', () => sTo(1));
    });
  }
}

/* tab title while away */
const title = document.title;
document.addEventListener('visibilitychange', () => { document.title = document.hidden ? 'Still 21 things in there. Distill' : title; });

/* motion switch */
const toggle = $('[data-motion-toggle]');
const off = root.dataset.motion === 'off';
toggle.textContent = `Motion: ${off ? 'off' : 'on'}`;
toggle.setAttribute('aria-pressed', String(off));
toggle.addEventListener('click', () => { try { localStorage.setItem('distill-motion', off ? 'on' : 'off'); } catch {} location.reload(); });
