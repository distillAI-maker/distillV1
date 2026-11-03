'use client';

import { useEngine } from '../../../lib/engine/context';
import { useProgress } from '../../../lib/progress/context';
import { RitualPreviewTab, RitualTab } from './ritual-tab';

/** Signed in, the Ritual tab is today's Ritual from the engine. Signed out, how it would start. */
export function RitualScreen() {
  const { ready } = useProgress();
  const { on } = useEngine();
  if (ready && on) return <RitualTab />;
  return <RitualPreviewTab />;
}
