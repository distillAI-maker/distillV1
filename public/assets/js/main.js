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

/* The feed's noise, once a visit: what people are sold piles up on ink until it's too much, then
   blurs away and the hero settles. Any tap, key or scroll skips it. Never with motion off. */
const NOISE = [
  'AG1', 'Cold plunge', 'Mouth tape', '10,000 steps', 'Day 1 of 75', 'Red light', '5am club',
  'Magnesium glycinate', 'Zone 2', 'Sea moss', 'Link in bio', 'Sleep tracking', "Lion's mane",
  'Glucose spikes', 'Non-negotiable', 'Grounding mat', 'Creatine', 'What I eat in a day', 'Ice bath',
  'Seed oils', 'My morning routine', 'Peptides', 'Game changer', 'Ashwagandha', 'Stop doing this',
  'HRV', 'Collagen', 'Morning sunlight', 'Cortisol', 'Gut health', 'Fasted cardio', 'Nasal strips',
  'Sleep stack', 'Blue light glasses', 'Protein goals', 'Cold showers', 'Breathwork', 'Walking pad',
  'Biomarkers', 'Sauna',
];

function playNoise(then) {
  const layer = $('[data-noise]');
  let seen = false;
  try { seen = sessionStorage.getItem('distill-noise') === '1'; } catch {}
  if (!layer || (seen && !/[?&]noise=1/.test(location.search))) return then();
  try { sessionStorage.setItem('distill-noise', '1'); } catch {}
  const frac = n => n - Math.floor(n);
  const cols = innerWidth > 760 ? 5 : 3;
  const rows = Math.ceil(NOISE.length / cols);
  const words = NOISE.map((text, i) => {
    const cell = (i * 13) % (rows * cols);
    const row = Math.floor(cell / cols);
    const col = cell % cols;
    const el = document.createElement('span');
    el.textContent = text;
    el.className = i % 7 === 0 ? 'n-lg' : i % 3 === 0 ? 'n-tag' : i % 2 === 0 ? 'n-md' : 'n-sm';
    const w = 100 / cols;
    el.style.setProperty('--x', `${w * (col + .5) + (frac(i * .754) - .5) * w}%`);
    el.style.setProperty('--y', `${5 + (row + .5) * (88 / rows) + (frac(i * .618) - .5) * 4}%`);
    el.dataset.o = String(.2 + frac(i * .7548) * .45);
    layer.append(el);
    return el;
  });
  layer.classList.add('is-on');
  gsap.set(nav, { opacity: 0 });
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    removeEventListener('wheel', skip);
    removeEventListener('keydown', skip);
    removeEventListener('touchmove', skip);
    layer.remove();
    then();
  };
  const tl = gsap.timeline({ onComplete: finish })
    .to(words, { opacity: i => words[i].dataset.o, filter: 'blur(0px)', duration: .6, stagger: .055, startAt: { filter: 'blur(6px)' } })
    .to({}, { duration: .5 })
    .to(words, { filter: 'blur(12px)', opacity: 0, duration: .9, ease: 'power2.in' })
    .to(layer, { opacity: 0, duration: .9, ease: 'power2.out' }, '<.25');
  const skip = () => tl.timeScale(6);
  layer.addEventListener('click', skip);
  addEventListener('wheel', skip, { passive: true });
  addEventListener('keydown', skip);
  addEventListener('touchmove', skip, { passive: true });
}

if (motion) {
  /* hero: the noise first (once a visit), then the image settles, the line rises, the rest follows */
  const heroImg = $('.hero__img img');
  playNoise(() => gsap.timeline({ delay: .05 })
    .fromTo(heroImg, { scale: 1.12 }, { scale: 1, duration: 2.6 }, 0)
    .to('.hero__title .ln > span', { y: 0, duration: 1.4, stagger: .12 }, .25)
    .to('[data-hero-in]', { opacity: 1, duration: 1.2, stagger: .1 }, .6)
    .fromTo(nav, { opacity: 0 }, { opacity: 1, duration: 1 }, .4));
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
