'use server';

import { engineCatalog } from '../catalog/engine';
import { catalog } from '../catalog/server';
import { wholeRitual } from '../onboarding/reveal';
import { progressSchema, type Progress } from '../progress/types';
import { previewEngine } from '../../src/server/engine';

function preview(progress: Progress, timeZone?: string) {
  return previewEngine(progress, {
    catalog: engineCatalog(),
    banned: catalog.toneRules.bannedPhrases,
    ...(timeZone ? { timeZone: timeZone.slice(0, 100) } : {}),
  });
}

const whole = (progress: Progress, run: ReturnType<typeof previewEngine>, anchors: boolean) => {
  const view = engineCatalog();
  return wholeRitual(run.parts, progress, run.decisions, {
    evidenceFor: (key) => (key ? view.item(key)?.evidenceFor : undefined),
    banned: catalog.toneRules.bannedPhrases,
    anchors,
  });
};

/**
 * The signed-out preview of a first Ritual, computed on the server from the progress the browser
 * holds. Rules only: no Claude, nothing stored. The catalog and engine never ship to the client.
 */
export async function previewRitual(progress: unknown, timeZone?: string) {
  const parsed = progressSchema.parse(progress);
  const run = preview(parsed, timeZone);
  return { ...run, parts: whole(parsed, run, false).parts };
}

/** The onboarding reveal, rules version: their first Ritual and what the decisions say. Instant. */
export async function revealRitual(progress: unknown, timeZone?: string) {
  const parsed = progressSchema.parse(progress);
  const { parts, notes } = whole(parsed, preview(parsed, timeZone), true);
  return {
    parts,
    notes,
    // Whether a Claude version is worth waiting for (/api/first-ritual).
    shaping: process.env.ENGINE_CLAUDE === 'on' && !!process.env.ANTHROPIC_API_KEY,
  };
}
