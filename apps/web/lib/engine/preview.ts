'use server';

import { engineCatalog } from '../catalog/engine';
import { catalog } from '../catalog/server';
import { progressSchema } from '../progress/types';
import { previewEngine } from '../../src/server/engine';

/**
 * The signed-out preview of a first Ritual, computed on the server from the progress the browser
 * holds. Rules only: no Claude, nothing stored. The catalog and engine never ship to the client.
 */
export async function previewRitual(progress: unknown, timeZone?: string) {
  return previewEngine(progressSchema.parse(progress), {
    catalog: engineCatalog(),
    banned: catalog.toneRules.bannedPhrases,
    ...(timeZone ? { timeZone: timeZone.slice(0, 100) } : {}),
  });
}
