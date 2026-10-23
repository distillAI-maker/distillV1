'use client';

import { useEngine } from '../../../lib/engine/context';
import { useProgress } from '../../../lib/progress/context';
import { RitualPreview, RitualToday } from './ritual-today';

/** Signed in, Today is today's Ritual. Signed out, it is how their Ritual would start, one tap from keeping it. */
export function TodayScreen() {
  const { ready } = useProgress();
  const { on } = useEngine();
  if (ready && on) return <RitualToday />;
  return <RitualPreview />;
}
