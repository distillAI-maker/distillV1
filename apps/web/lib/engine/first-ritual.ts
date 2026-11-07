import type { RitualPart } from '@distill/engine/ritual';
import { firstRitualList, type Progress } from '../progress/types';

/**
 * Their first Ritual in Claude's words takes about half a minute, so it starts as soon as every answer
 * is in, and the reveal picks up the same request instead of waiting from zero. Same answers, same
 * request: going back and forward never pays for it twice. A plain fetch, not a server action: Next
 * runs server actions one at a time and drops a pending one's state on navigation.
 */

export type ShapedRitual = { readonly parts: readonly RitualPart[] } | null;

let job: { readonly key: string; readonly shaped: Promise<ShapedRitual> } | null = null;

/** Keys in one order at every depth: saved progress reads back in the schema's order, not the app's. */
const sorted = (_: string, value: unknown) =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))
    : value;

/** What a Ritual is shaped from: not where they've got to in onboarding, or whether they've joined. */
export function signature(progress: Progress): string {
  const rest: Partial<Progress> = { ...progress };
  delete rest.step;
  delete rest.updatedAt;
  delete rest.member;
  delete rest.joinedEmail;
  delete rest.fromJoin;
  delete rest.firstRitual;
  delete rest.region;
  delete rest.exploreHidden;
  delete rest.exploreGoing;
  return JSON.stringify(rest, sorted);
}

export function shapeFirstRitual(progress: Progress, timeZone: string): Promise<ShapedRitual> {
  const key = signature(progress);
  if (job?.key === key) return job.shaped;
  const shaped = fetch('/api/first-ritual', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ progress, timeZone }),
  })
    .then((res) => (res.ok ? (res.json() as Promise<{ parts: RitualPart[] | null }>) : null))
    .then((body) => (body?.parts ? { parts: body.parts } : null))
    .catch(() => null)
    .then((result) => {
      // Nothing came back: the next visit to the page may try again.
      if (!result && job?.key === key) job = null;
      return result;
    });
  job = { key, shaped };
  return shaped;
}

/** "Make it mine": the Ritual they just read is the one they find in the app, until their list changes. */
export function keepFirstRitual(progress: Progress, parts: readonly RitualPart[]): NonNullable<Progress['firstRitual']> {
  return { list: firstRitualList(progress), parts: [...parts] };
}

export function keptFirstRitual(progress: Progress): readonly RitualPart[] | null {
  const kept = progress.firstRitual;
  if (!kept?.parts.length || kept.list !== firstRitualList(progress)) return null;
  return kept.parts as RitualPart[];
}
