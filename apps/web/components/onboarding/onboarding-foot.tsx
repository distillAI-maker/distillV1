'use client';

import { usePathname } from 'next/navigation';
import { Footer } from '../ui';

/** The medical note shows once, at the foot of the first stack screen, not on every step. */
export function OnboardingFoot() {
  const pathname = usePathname();
  const first = (pathname ?? '').split('/').filter(Boolean)[0] ?? '';
  return first === 'stack' ? <Footer /> : null;
}
