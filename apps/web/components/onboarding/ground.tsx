'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/** The screens where the person writes or chooses sit on the bronze dusk; the name on paper; the rest on night. */
const dusk = new Set(['stack', 'life', 'questions']);
const paper = new Set(['name']);

export function Ground() {
  const pathname = usePathname();
  useEffect(() => {
    const first = (pathname ?? '').split('/').filter(Boolean)[0] ?? '';
    document.body.dataset.ground = dusk.has(first) ? 'dusk' : paper.has(first) ? 'paper' : 'night';
    return () => {
      delete document.body.dataset.ground;
    };
  }, [pathname]);
  return null;
}
