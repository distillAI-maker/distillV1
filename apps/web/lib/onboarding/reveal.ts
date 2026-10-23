import type { RitualPart } from '@distill/engine/ritual';
import { copy } from '../copy';
import { listOf, midSentence } from './you';

/**
 * The reveal (step 6), as data: their first Ritual in a line a moment, and what the engine's
 * decisions say in one short line each. Decisions are read as they come: a WORTH_A_LOOK decision
 * (routing table V4, branch routing-table-v4-full) is shown as "worth a look"; until the engine
 * makes those, a kept thing with no evidence that came from nowhere they told us is shown the same way.
 */

/** The parts of a decision the reveal reads. `reason` is a string so newer reasons pass through. */
export interface RevealDecision {
  readonly stackItemId: string | null;
  readonly kind: string;
  readonly reason: string;
  readonly evidenceTier?: string;
  readonly money: number;
  readonly name: string;
}

export interface RevealItem {
  readonly id: string;
  readonly origin?: string;
  readonly status: string;
}

export interface RevealNotes {
  /** Things the engine would clear, with the money a year. */
  readonly letGo: readonly { name: string; yearly: number }[];
  /** Well-founded things they keep. */
  readonly wellFounded: readonly string[];
  /** No independent evidence, and we don't know yet why they have it. */
  readonly worthALook: readonly string[];
}

const WELL_FOUNDED = new Set(['EVIDENCE_REGULAR', 'TRAINS']);
const unique = (xs: string[]) => [...new Set(xs)];

/** A name holding a word Distill never says ("Detox tea") stays off these lines. */
export function sayable(name: string, banned: readonly string[]): boolean {
  return !banned.some((b) =>
    new RegExp(`(?<![\\p{L}])${b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'iu').test(name),
  );
}

export function revealNotes(
  decisions: readonly RevealDecision[],
  items: readonly RevealItem[],
  yours: readonly string[],
  banned: readonly string[] = [],
): RevealNotes {
  const ok = (d: RevealDecision) => sayable(d.name, banned);
  const byItem = new Map<string, RevealDecision[]>();
  for (const d of decisions)
    if (d.stackItemId) byItem.set(d.stackItemId, [...(byItem.get(d.stackItemId) ?? []), d]);
  const letGo = decisions
    .filter((d) => d.kind === 'clear' && ok(d))
    .map((d) => ({ name: d.name, yearly: Math.round(d.money * 12) }));
  const going = new Set(decisions.filter((d) => d.kind === 'clear' || d.kind === 'refer').map((d) => d.stackItemId));
  const flagged = decisions.filter((d) => d.reason === 'WORTH_A_LOOK' && !going.has(d.stackItemId) && ok(d));
  const derived = decisions.filter((d) => {
    if (d.kind !== 'keep' || d.reason !== 'NOTHING_TO_CLEAR' || d.evidenceTier !== 'N' || !d.stackItemId) return false;
    const item = items.find((i) => i.id === d.stackItemId);
    if (!item || item.origin || item.status === 'kept' || item.status === 'protected' || yours.includes(item.id)) return false;
    // Anything else said about it (a clear, an adjustment, a referral) speaks for it instead.
    return (byItem.get(d.stackItemId) ?? []).every((x) => x === d || x.kind === 'keep') && ok(d);
  });
  return {
    letGo: letGo.slice(0, 4),
    wellFounded: unique(decisions.filter((d) => d.kind === 'keep' && WELL_FOUNDED.has(d.reason) && ok(d)).map((d) => d.name)).slice(0, 4),
    worthALook: unique([...flagged, ...derived].map((d) => d.name)).slice(0, 2),
  };
}

export interface MomentLine {
  readonly key: 'morning' | 'day' | 'evening' | 'weekend';
  readonly label: string;
  readonly text: string;
}

const weekendOnly = (p: RitualPart) => p.when.days.length > 0 && p.when.days.every((d) => d === 'sat' || d === 'sun');

function sentence(parts: readonly RitualPart[]): string {
  const bits = parts.map((p, i) => {
    const title = i === 0 ? p.title : midSentence(p.title);
    return p.when.perWeek && !p.when.days.length ? `${title} ${copy.reveal.perWeek(p.when.perWeek)}` : title;
  });
  const s = listOf(bits);
  return /[.!?]$/.test(s) ? s : `${s}.`;
}

/** Their morning, day and evening (and a weekend-only line when there is one), a line each. */
export function momentLines(parts: readonly RitualPart[]): MomentLine[] {
  const active = [...parts].filter((p) => p.status === 'active').sort((a, b) => a.order - b.order);
  const weekday = active.filter((p) => !weekendOnly(p));
  const groups: [MomentLine['key'], RitualPart[]][] = [
    ['morning', weekday.filter((p) => p.when.slot === 'morning')],
    ['day', weekday.filter((p) => p.when.slot === 'midday')],
    ['evening', weekday.filter((p) => p.when.slot === 'evening' || p.when.slot === 'night')],
    ['weekend', active.filter(weekendOnly)],
  ];
  return groups
    .filter(([, ps]) => ps.length)
    .map(([key, ps]) => ({ key, label: copy.reveal.moments[key], text: sentence(ps) }));
}

/** What they'd never give up from their life that isn't already a part of their Ritual. */
export function alwaysYours(parts: readonly RitualPart[], picks: readonly string[]): string[] {
  const titles = parts.filter((p) => p.status === 'active').map((p) => p.title.toLowerCase());
  return picks.filter((pick) => {
    const words = pick.toLowerCase().match(/[a-z]{4,}/g) ?? [pick.toLowerCase()];
    return !titles.some((t) => words.every((w) => t.includes(w)));
  });
}
