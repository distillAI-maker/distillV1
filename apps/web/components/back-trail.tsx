'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect } from 'react';

/**
 * The pages this tab has been through, so Back can step back through the browser's history instead
 * of pushing a new page on top. Pushing made the phone's own back gesture (and the browser's)
 * bounce forward again: Back from the invitation to the reveal, then the system back went to the
 * invitation, not the study.
 */
const KEY = 'distill.trail';
const MAX = 50;

function read(): string[] {
  try {
    const raw = JSON.parse(sessionStorage.getItem(KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((p): p is string => typeof p === 'string') : [];
  } catch {
    return [];
  }
}

function write(trail: string[]) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(trail.slice(-MAX)));
  } catch {
    // Private windows can refuse storage; Back then simply pushes, as before.
  }
}

/** A move through history: back one if it lands on the page before, else forward one. */
function moved(path: string) {
  const trail = read();
  if (trail.at(-1) === path) return;
  if (trail.at(-2) === path) trail.pop();
  else trail.push(path);
  write(trail);
}

/** Keeps the trail. Mounted once, in the root layout. */
export function BackTrail() {
  const pathname = usePathname();
  useEffect(() => {
    const onPop = () => moved(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  // Every other change of page is a step forward (a history move was already counted above).
  useEffect(() => {
    if (!pathname) return;
    const trail = read();
    if (trail.at(-1) !== pathname) write([...trail, pathname]);
  }, [pathname]);
  return null;
}

/** Back to a page: through history when it's the page they came from, else straight there. */
export function useGoBack() {
  const router = useRouter();
  return useCallback(
    (target: string) => {
      if (read().at(-2) === target && window.history.length > 1) router.back();
      else router.push(target);
    },
    [router],
  );
}
