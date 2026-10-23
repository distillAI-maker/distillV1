'use server';

import { headers } from 'next/headers';
import { engineCatalog } from '../catalog/engine';
import { catalog } from '../catalog/server';
import { revealNotes } from '../onboarding/reveal';
import { progressSchema } from '../progress/types';
import { previewCompose, previewEngine } from '../../src/server/engine';
import { engineClient } from '../../src/server/engine-deps';

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

/** The onboarding reveal, rules version: their first Ritual and what the decisions say. Instant. */
export async function revealRitual(progress: unknown, timeZone?: string) {
  const parsed = progressSchema.parse(progress);
  const preview = previewEngine(parsed, {
    catalog: engineCatalog(),
    banned: catalog.toneRules.bannedPhrases,
    ...(timeZone ? { timeZone: timeZone.slice(0, 100) } : {}),
  });
  return {
    parts: preview.parts,
    notes: revealNotes(preview.decisions, parsed.items, parsed.dayOne.yours, catalog.toneRules.bannedPhrases),
    // Whether a Claude version is worth waiting for.
    shaping: claudeOn(),
  };
}

const claudeOn = () => process.env.ENGINE_CLAUDE === 'on' && !!process.env.ANTHROPIC_API_KEY;

/**
 * Anyone can reach the reveal signed out, so Claude's version is rationed: a few per address an
 * hour and a ceiling a day on each server instance. Past either, the rules version stays.
 */
const PER_ADDRESS_HOUR = 3;
const PER_INSTANCE_DAY = 200;
const seen = new Map<string, number[]>();
let day = { date: '', count: 0 };

function allowed(address: string, now = Date.now()): boolean {
  const date = new Date(now).toISOString().slice(0, 10);
  if (day.date !== date) day = { date, count: 0 };
  if (day.count >= PER_INSTANCE_DAY) return false;
  const recent = (seen.get(address) ?? []).filter((t) => now - t < 3_600_000);
  if (recent.length >= PER_ADDRESS_HOUR) return false;
  seen.set(address, [...recent, now]);
  if (seen.size > 5000) seen.delete(seen.keys().next().value!);
  day.count += 1;
  return true;
}

/**
 * The onboarding reveal, Claude's version: the rules draft named and paired in their words. Null
 * when Claude is off (ENGINE_CLAUDE), rationed out, or when Claude's version fell back to rules.
 */
export async function shapeRitual(progress: unknown, timeZone?: string) {
  if (!claudeOn()) return null;
  const h = await headers();
  const address = (h.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown';
  if (!allowed(address)) return null;
  const shaped = await previewCompose(progressSchema.parse(progress), {
    catalog: engineCatalog(),
    toneRules: catalog.toneRules,
    client: engineClient(),
    ...(timeZone ? { timeZone: timeZone.slice(0, 100) } : {}),
  });
  return shaped && shaped.from === 'claude' ? { parts: shaped.parts } : null;
}
