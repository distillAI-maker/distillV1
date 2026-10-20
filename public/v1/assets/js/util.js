export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const seg = (p, a, b) => clamp((p - a) / (b - a), 0, 1);
export const easeOut = t => 1 - Math.pow(1 - t, 3);
export const easeInOut = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const money = n => '$' + Math.round(n).toLocaleString('en-US');

export const motionOK = () =>
  !matchMedia('(prefers-reduced-motion: reduce)').matches &&
  document.documentElement.dataset.motion !== 'off' &&
  !!window.gsap;

export const finePointer = () => matchMedia('(hover: hover) and (pointer: fine)').matches;

/** Run fn once when el comes within `margin` of the viewport. */
export function whenNear(el, fn, margin = '0px 0px -15% 0px') {
  if (!el) return;
  if (!('IntersectionObserver' in window)) return fn();
  const io = new IntersectionObserver(entries => {
    if (entries.some(e => e.isIntersecting)) { io.disconnect(); fn(); }
  }, { rootMargin: margin });
  io.observe(el);
}
