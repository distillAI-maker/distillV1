'use client';

import { useEffect, useState } from 'react';

function motionOff(): boolean {
  if (typeof window === 'undefined') return true;
  return getComputedStyle(document.documentElement).getPropertyValue('--motion').trim() === '0';
}

/** Counts from 0 to `to` over 600ms, the one authored moment of day one. Static with reduced motion. */
export function CountUp({ to, format }: { to: number; format: (n: number) => string }) {
  const [n, setN] = useState(() => (motionOff() ? to : 0));
  useEffect(() => {
    if (motionOff()) {
      setN(to);
      return;
    }
    const t0 = performance.now();
    let frame = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / 600);
      const eased = 1 - Math.pow(1 - k, 3);
      setN(Math.round(eased * to));
      if (k < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [to]);
  return <span>{format(n)}</span>;
}
