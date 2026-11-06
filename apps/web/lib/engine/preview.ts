'use server';

import { engineCatalog } from '../catalog/engine';
import { catalog } from '../catalog/server';
import { revealNotes, withAnchors, withDetail } from '../onboarding/reveal';
import { bedClockSaid, people, wakeClockSaid, wakeSaid } from '../onboarding/you';
import { progressSchema, type Progress } from '../progress/types';
import { previewEngine } from '../../src/server/engine';

/** The rules draft with everything rules can say about it, and what the decisions say. */
function detailed(progress: Progress, preview: ReturnType<typeof previewEngine>) {
  const view = engineCatalog();
  const notes = revealNotes(preview.decisions, progress.items, progress.dayOne.yours, catalog.toneRules.bannedPhrases);
  const parts = withDetail(preview.parts, {
    wake: wakeClockSaid(progress),
    bed: bedClockSaid(progress),
    evidenceFor: (key) => (key ? view.item(key)?.evidenceFor : undefined),
    wellFounded: notes.wellFounded,
  });
  return { notes, parts };
}

function preview(progress: Progress, timeZone?: string) {
  return previewEngine(progress, {
    catalog: engineCatalog(),
    banned: catalog.toneRules.bannedPhrases,
    ...(timeZone ? { timeZone: timeZone.slice(0, 100) } : {}),
  });
}

/**
 * The signed-out preview of a first Ritual, computed on the server from the progress the browser
 * holds. Rules only: no Claude, nothing stored. The catalog and engine never ship to the client.
 */
export async function previewRitual(progress: unknown, timeZone?: string) {
  const parsed = progressSchema.parse(progress);
  const run = preview(parsed, timeZone);
  return { ...run, parts: detailed(parsed, run).parts };
}

/** The onboarding reveal, rules version: their first Ritual and what the decisions say. Instant. */
export async function revealRitual(progress: unknown, timeZone?: string) {
  const parsed = progressSchema.parse(progress);
  const { parts, notes } = detailed(parsed, preview(parsed, timeZone));
  return {
    parts: withAnchors(parts, {
      wake: wakeClockSaid(parsed),
      wakeLabel: wakeSaid(parsed),
      bed: bedClockSaid(parsed),
      ...(people(parsed) ? { people: people(parsed)! } : {}),
    }),
    notes,
    // Whether a Claude version is worth waiting for (/api/first-ritual).
    shaping: process.env.ENGINE_CLAUDE === 'on' && !!process.env.ANTHROPIC_API_KEY,
  };
}
