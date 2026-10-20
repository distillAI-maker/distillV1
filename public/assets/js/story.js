/* The story: one phone, four screens, sitting on a persimmon sun. Each step changes what the phone
   shows; on phones and tablets it plays by itself like stories. Example data throughout.
   Ported from the earlier landing page's story so the motion carries over. */
import { $, $$, motionOK, finePointer } from './util.js';
import { Reel } from './reels.js';

const TOTAL = 1428;
const STEP_MS = 8;            // seconds per step when the phone plays by itself
const DESKTOP = '(min-width: 981px)';

export function initStory() {
  const story = $('[data-story]');
  if (!story) return;
  const rig = $('[data-rig]', story);
  const sun = $('.sun', story);
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
  const photo = $('[data-photo]', phone);
  const ritualRows = $$('[data-ritual-rows] li', phone);
  const progress = $('[data-progress]', phone);
  const msgs = $$('[data-msg]', phone);
  const typing = $('[data-typing]', phone);
  const reshape = $('[data-reshape]', phone);
  const olds = reshape ? $$('s', reshape) : [];
  const news = reshape ? $$('b', reshape) : [];

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
        t.to(li, { '--strike': 1, duration: .24, ease: 'power3.inOut' }, at)
          .to(li, { opacity: 0, height: 0, paddingTop: 0, paddingBottom: 0, borderBottomWidth: 0, duration: .34, ease: 'power3.inOut' }, at + .26)
          .add(() => { n -= Number(li.dataset.n || 1); c -= Number(li.dataset.c); r.dN.set(n); r.dC.set(c); }, at + .26);
      });
      const end = .5 + cutRows.length * .27 + .2;
      t.to(pill, { opacity: 1, scale: 1, duration: .5, ease: 'back.out(2.2)' }, end)
        .to(leftRows, { opacity: 1, y: 0, duration: .55, ease: 'out', stagger: .055 }, end + .08);
      return t;
    },
    () => {
      const t = gsap.timeline();
      ritualRows.forEach(li => li.classList.remove('is-done'));
      gsap.set(progress, { width: '0%' });
      t.fromTo(photo, { opacity: 0, scale: 1.06 }, { opacity: 1, scale: 1, duration: 1.1, ease: 'out' }, 0)
        .fromTo(ritualRows, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: .6, ease: 'out', stagger: .08 }, .25);
      [0, 1].forEach((k, j) => {
        const at = 1.2 + j * .9;
        const dot = $('i', ritualRows[k]);
        t.to(dot, { scale: .8, duration: .12, ease: 'power2.out' }, at)
          .add(() => ritualRows[k].classList.add('is-done'), at + .12)
          .to(dot, { scale: 1, duration: .6, ease: 'elastic.out(1, .5)' }, at + .12)
          .to(progress, { width: `${(k + 1) * 33.4}%`, duration: .6, ease: 'out' }, at + .12);
      });
      return t;
    },
    () => {
      // Friday night: one text in, a warm reply, and Saturday quietly reshapes itself
      const t = gsap.timeline();
      reshape.classList.remove('is-done');
      gsap.set(msgs, { opacity: 0 });
      gsap.set(typing, { opacity: 0, display: 'none' });
      gsap.set(reshape, { opacity: 0, y: 16 });
      gsap.set(olds, { '--strike': 0, opacity: 1 });
      gsap.set(news, { opacity: 0, x: -6 });
      t.fromTo(msgs[0], { opacity: 0, y: 12, scale: .96, transformOrigin: '100% 100%' }, { opacity: 1, y: 0, scale: 1, duration: .55, ease: 'back.out(1.6)' }, .15)
        .set(typing, { display: 'flex' }, .9)
        .fromTo(typing, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: .35, ease: 'out' }, .9)
        .to(typing, { opacity: 0, duration: .2 }, 2)
        .set(typing, { display: 'none' }, 2.2)
        .fromTo(msgs[1], { opacity: 0, y: 12, scale: .96, transformOrigin: '0% 100%' }, { opacity: 1, y: 0, scale: 1, duration: .55, ease: 'back.out(1.6)' }, 2.2)
        .to(reshape, { opacity: 1, y: 0, duration: .7, ease: 'out' }, 3);
      olds.forEach((o, i) => {
        const at = 3.6 + i * .5;
        t.to(o, { '--strike': 1, duration: .3, ease: 'power3.inOut' }, at)
          .to(o, { opacity: 0, duration: .25 }, at + .32)
          .to(news[i], { opacity: 1, x: 0, duration: .5, ease: 'out' }, at + .36);
      });
      return t;
    },
  ];

  function finished() {
    r.sN.set(21, false); r.sC.set(TOTAL, false);
    r.dN.set(11, false); r.dC.set(TOTAL - 767, false);
    cutRows.forEach(li => { li.hidden = true; });
    ritualRows.slice(0, 2).forEach(li => li.classList.add('is-done'));
    if (progress) progress.style.width = '66.8%';
    reshape?.classList.add('is-done');
    if (typing) typing.style.display = 'none';
  }

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

  // without motion: every screen shows its finished state
  if (!anim) {
    finished();
    show(0);
    if (window.ScrollTrigger && matchMedia(DESKTOP).matches) {
      steps.forEach(st => ScrollTrigger.create({ trigger: st, start: 'top 55%', end: 'bottom 45%', onToggle: self => { if (self.isActive) show(Number(st.dataset.to)); } }));
    }
    ticks.forEach((t, k) => t.addEventListener('click', () => show(k)));
    return;
  }

  // the sun rises, the phone tips up onto it, then the list fills
  gsap.set(rig, { opacity: 0 });
  ScrollTrigger.create({
    trigger: '.stage', start: 'top 75%', once: true,
    onEnter: () => {
      gsap.fromTo(sun, { scale: .55, opacity: 0 }, { scale: 1, opacity: 1, duration: 1.6, ease: 'out' });
      gsap.fromTo(rig, { y: 90, rotationX: 24, opacity: 0, transformPerspective: 1400, transformOrigin: '50% 100%' },
        { y: 0, rotationX: 0, opacity: 1, duration: 1.6, ease: 'out', delay: .1 });
      gsap.delayedCall(.4, () => { if (cur < 0) show(0); });
    },
  });

  const mm = gsap.matchMedia();
  mm.add(DESKTOP, () => {
    steps.forEach(s => {
      ScrollTrigger.create({ trigger: s, start: 'top 55%', end: 'bottom 45%', onToggle: self => { if (self.isActive) show(Number(s.dataset.to)); } });
    });

    // the rail fills as you read; its leading edge stays level with the step you're on
    gsap.fromTo('[data-rail]', { scaleY: 0 }, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: '.rail', start: 'top 52%', end: 'bottom 52%', scrub: .3 } });

    // the phone turns slowly as the story scrolls past it; the sun drifts the other way
    gsap.fromTo(rig, { rotationY: -6 }, { rotationY: 4, ease: 'none', immediateRender: false,
      scrollTrigger: { trigger: story, start: 'top top', end: 'bottom bottom', scrub: 1 } });
    gsap.fromTo(sun, { yPercent: 4 }, { yPercent: -4, ease: 'none', immediateRender: false,
      scrollTrigger: { trigger: story, start: 'top top', end: 'bottom bottom', scrub: 1 } });

    // each step's title lifts in word by word when it becomes the current one
    const splits = window.SplitText ? steps.map(s => SplitText.create($('.step__t', s), { type: 'words', wordsClass: 'word', tag: 'span' })) : [];
    onShow(i => {
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

  mm.add('(max-width: 980px)', () => {
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
      if (Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy) * 1.4) go((Math.max(cur, 0) + (dx < 0 ? 1 : -1) + screens.length) % screens.length);
    };
    const zone = $('.stage', story);
    zone.addEventListener('touchstart', down, { passive: true });
    zone.addEventListener('touchend', up, { passive: true });

    const io = new IntersectionObserver(es => {
      visible = es.some(e => e.isIntersecting);
      if (visible && !fill) go(Math.max(cur, 0));
      else if (fill) visible ? fill.resume() : fill.pause();
    }, { threshold: .35 });
    io.observe(phone);
    return () => {
      fill?.kill(); io.disconnect();
      clicks.forEach(([t, h]) => t.removeEventListener('click', h));
      zone.removeEventListener('touchstart', down); zone.removeEventListener('touchend', up);
    };
  });
}
