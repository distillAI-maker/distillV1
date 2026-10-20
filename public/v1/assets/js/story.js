/* The story: one phone, four screens. The hero shows the list; each step
   below it changes what the phone shows. Example data throughout. */
import { $, $$, motionOK, finePointer } from './util.js';
import { Reel } from './reels.js';

const TOTAL = 1428;
const STEP_MS = 8;   // seconds per step when the phone plays by itself (phones, tablets)

export function initStory() {
  const story = $('[data-story]');
  if (!story) return;
  const rig = $('[data-rig]', story);
  const phone = $('[data-phone]', story);
  const screens = $$('.scr', phone);
  const steps = $$('.step', story);
  const ticks = $$('[data-ticks] button', story);
  const fills = ticks.map(t => $('b', t));
  const anim = motionOK();
  const r = {
    sN: new Reel($('[data-s-n]', phone)), sC: new Reel($('[data-s-c]', phone)),
    dN: new Reel($('[data-d-n]', phone)), dC: new Reel($('[data-d-c]', phone)),
  };
  const stackRows = $$('[data-rows="stack"] li', phone);
  const cutRows = $$('[data-rows="cut"] li', phone);
  const pill = $('[data-pill]', phone);
  const leftRows = $$('[data-rows="left"] li', phone);
  const today = $('.today', phone);
  const stats = $$('.stats p', phone);
  const nextCard = $('.next', phone);
  const nights = $$('[data-nights] li', phone);
  const tap = $('[data-tap]', phone);
  const check = $('[data-tap] path', phone);
  const stamp = $('[data-stamp]', phone);
  const bars = $$('.cmp__row i', phone);
  const gain = $('.verdict__gain', phone);
  const count = $('[data-count]', phone);

  let cur = -1, tl = null;
  const listeners = [];
  const onShow = fn => listeners.push(fn);

  /* what each screen does when it arrives */
  const play = [
    () => {
      const t = gsap.timeline();
      r.sN.set(0, false); r.sC.set(0, false);
      t.fromTo(stackRows, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: .7, ease: 'out', stagger: .045 }, 0)
        .add(() => { r.sN.set(21); r.sC.set(TOTAL); }, .12);
      return t;
    },
    () => {
      const t = gsap.timeline();
      gsap.set(cutRows, { clearProps: 'height,paddingTop,paddingBottom,opacity,borderBottomWidth' });
      gsap.set(cutRows, { '--strike': 0 });
      gsap.set(pill, { opacity: 0, scale: .8 });
      gsap.set(leftRows, { opacity: 0, y: 10 });
      r.dN.set(21, false); r.dC.set(TOTAL, false);
      let n = 21, c = TOTAL;
      t.fromTo(cutRows, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: .5, ease: 'out', stagger: .035 }, 0);
      cutRows.forEach((li, i) => {
        const at = .5 + i * .27;
        t.to(li, { '--strike': 1, duration: .24, ease: 'inOut' }, at)
          .to(li, { opacity: 0, height: 0, paddingTop: 0, paddingBottom: 0, borderBottomWidth: 0, duration: .34, ease: 'inOut' }, at + .26)
          .add(() => { n -= Number(li.dataset.n || 1); c -= Number(li.dataset.c); r.dN.set(n); r.dC.set(c); }, at + .26);
      });
      const end = .5 + cutRows.length * .27 + .2;
      t.to(pill, { opacity: 1, scale: 1, duration: .5, ease: 'back.out(2.2)' }, end)
        .to(leftRows, { opacity: 1, y: 0, duration: .55, ease: 'out', stagger: .055 }, end + .08);
      return t;
    },
    () => {
      const t = gsap.timeline();
      t.fromTo(today, { opacity: 0, y: 16, scale: .97 }, { opacity: 1, y: 0, scale: 1, duration: .7, ease: 'out' }, 0)
        .fromTo(nights, { scale: .4, opacity: 0 }, { scale: 1, opacity: 1, duration: .45, ease: 'back.out(2)', stagger: { each: .035, grid: [2, 7], from: 'start' } }, .12)
        .set(tap, { scale: 1 }, 0)
        .set(check, { strokeDashoffset: 20 }, 0)
        .to(tap, { scale: .94, duration: .12, ease: 'power2.out' }, 1.15)
        .to(tap, { scale: 1, duration: .6, ease: 'elastic.out(1, .5)' }, 1.27)
        .to(check, { strokeDashoffset: 0, duration: .4, ease: 'out' }, 1.27)
        .fromTo(stats, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: .55, ease: 'out', stagger: .07 }, 1.5);
      return t;
    },
    () => {
      const t = gsap.timeline();
      const n = { v: 0 };
      t.fromTo(stamp, { opacity: 0, scale: 1.8, rotate: -12 }, { opacity: 1, scale: 1, rotate: -3, duration: .5, ease: 'back.out(1.5)' }, .12)
        .fromTo(rig, { x: -5 }, { x: 0, duration: .5, ease: 'elastic.out(1, .3)' }, .42)
        .fromTo(bars, { scaleX: 0 }, { scaleX: 1, duration: 1, ease: 'out', stagger: .12 }, .3)
        .fromTo(gain, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: .6, ease: 'out' }, .55)
        .fromTo(n, { v: 0 }, { v: 74, duration: 1.1, ease: 'out', onUpdate: () => { count.textContent = Math.round(n.v); } }, .55)
        .fromTo(nextCard, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: .6, ease: 'out' }, 1.05);
      return t;
    },
  ];

  function show(i) {
    if (i === cur) return;
    const prev = cur;
    cur = i;
    steps.forEach((s, k) => s.classList.toggle('is-on', k === i));
    ticks.forEach((t, k) => t.setAttribute('aria-current', String(k === i)));
    listeners.forEach(fn => fn(i, prev));
    if (!anim) {
      screens.forEach((s, k) => s.classList.toggle('is-on', k === i));
      fills.forEach((f, k) => { f.style.transform = `scaleX(${k <= i ? 1 : 0})`; });
      return;
    }
    tl?.kill();
    const inS = screens[i], outS = prev >= 0 ? screens[prev] : null;
    const dir = prev > i ? -1 : 1;
    inS.classList.add('is-on');
    tl = gsap.timeline();
    if (outS) {
      tl.to(outS, { opacity: 0, y: -18 * dir, scale: .98, filter: 'blur(4px)', duration: .28, ease: 'power2.in',
        onComplete: () => { outS.classList.remove('is-on'); gsap.set(outS, { clearProps: 'opacity,transform,filter' }); } }, 0)
        .fromTo(rig, { scale: .985 }, { scale: 1, duration: .8, ease: 'back.out(2.5)' }, .1);
    }
    tl.fromTo(inS, { opacity: 0, y: 26 * dir, filter: 'blur(6px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: .6, ease: 'out', clearProps: 'filter' }, outS ? .16 : 0)
      .add(play[i](), outS ? .22 : .05);
  }

  /* the hero headline asks about one thing at a time; the phone points at it */
  onShow(i => { if (i !== 0) stackRows.forEach(li => li.classList.remove('is-hit')); });
  const hit = row => {
    stackRows.forEach((li, k) => li.classList.toggle('is-hit', cur === 0 && k === row));
  };

  // without motion: every screen shows its finished state
  if (!anim) {
    r.dN.set(11, false); r.dC.set(661, false);
    cutRows.forEach(li => { li.hidden = true; });
    leftRows.forEach(li => { li.style.opacity = 1; });
    show(0);
    const mq = matchMedia('(min-width: 1024px)');
    if (window.ScrollTrigger && mq.matches) {
      steps.forEach(st => ScrollTrigger.create({ trigger: st, start: 'top 55%', end: 'bottom 45%', onToggle: self => { if (self.isActive) show(Number(st.dataset.to)); } }));
    }
    ticks.forEach((t, k) => t.addEventListener('click', () => show(k)));
    return { show, hit };
  }

  // the phone rises in, then the list fills
  gsap.fromTo(rig, { y: 90, rotationX: 24, opacity: 0, transformPerspective: 1400, transformOrigin: '50% 100%' },
    { y: 0, rotationX: 0, opacity: 1, duration: 1.6, ease: 'out', delay: .2 });
  gsap.delayedCall(.45, () => show(0));

  const mm = gsap.matchMedia();
  mm.add('(min-width: 1024px)', () => {
    steps.forEach(s => {
      ScrollTrigger.create({ trigger: s, start: 'top 55%', end: 'bottom 45%', onToggle: self => { if (self.isActive) show(Number(s.dataset.to)); } });
    });
    ScrollTrigger.create({ trigger: '.hero', start: 'top top', end: 'bottom 55%', onEnterBack: () => show(0) });

    // the rail fills as you read; its leading edge stays level with the step you're on
    gsap.fromTo('[data-rail]', { scaleY: 0 }, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: '.rail', start: 'top 52%', end: 'bottom 52%', scrub: .3 } });

    // the phone turns slowly as the story scrolls past it
    gsap.fromTo(rig, { rotationY: -6 }, { rotationY: 4, ease: 'none', immediateRender: true,
      scrollTrigger: { trigger: story, start: 'top top', end: 'bottom bottom', scrub: 1 } });

    // each step's title lifts in word by word when it becomes the current one
    const splits = window.SplitText ? steps.map(s => SplitText.create($('.step__t', s), { type: 'words', wordsClass: 'word', tag: 'span' })) : [];
    onShow((i, prev) => {
      const w = splits[i]?.words;
      if (!w) return;
      gsap.fromTo(w, { y: '.45em', opacity: .2 }, { y: 0, opacity: 1, duration: .8, ease: 'out', stagger: .035, overwrite: true });
      gsap.fromTo($('.step__d', steps[i]), { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: .8, ease: 'out', delay: .12, overwrite: true });
    });

    if (finePointer()) {
      const ry = gsap.quickTo(phone, 'rotationY', { duration: .9, ease: 'power3' });
      const rx = gsap.quickTo(phone, 'rotationX', { duration: .9, ease: 'power3' });
      gsap.set(phone, { transformPerspective: 1400 });
      const move = e => { ry((e.clientX / innerWidth - .5) * 8); rx((e.clientY / innerHeight - .5) * -5); };
      addEventListener('pointermove', move, { passive: true });
      return () => { removeEventListener('pointermove', move); splits.forEach(s => s.revert()); };
    }
    return () => splits.forEach(s => s.revert());
  });

  mm.add('(max-width: 1023px)', () => {
    // steps play like stories: each bar fills, then the next step starts
    let fill = null, visible = false;
    const go = i => {
      show(i);
      fill?.kill();
      fills.forEach((f, k) => gsap.set(f, { scaleX: k < i ? 1 : 0 }));
      fill = gsap.fromTo(fills[i], { scaleX: 0 }, { scaleX: 1, duration: STEP_MS, ease: 'none', paused: !visible, onComplete: () => go((i + 1) % screens.length) });
    };
    const clicks = ticks.map((t, k) => { const h = () => go(k); t.addEventListener('click', h); return [t, h]; });

    // swipe across the phone to move between steps
    let sx = 0, sy = 0;
    const down = e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; };
    const up = e => {
      const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy) * 1.4) go((cur + (dx < 0 ? 1 : -1) + screens.length) % screens.length);
    };
    const zone = $('.stage', story);
    zone.addEventListener('touchstart', down, { passive: true });
    zone.addEventListener('touchend', up, { passive: true });

    const io = new IntersectionObserver(es => {
      visible = es.some(e => e.isIntersecting);
      if (fill) visible ? fill.resume() : fill.pause();
    }, { threshold: .35 });
    io.observe(phone);
    gsap.delayedCall(.5, () => go(Math.max(cur, 0)));
    return () => {
      fill?.kill(); io.disconnect();
      clicks.forEach(([t, h]) => t.removeEventListener('click', h));
      zone.removeEventListener('touchstart', down); zone.removeEventListener('touchend', up);
    };
  });
  return { show, hit };
}
