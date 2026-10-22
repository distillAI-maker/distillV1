import type { CatalogItemView, CatalogView } from '@distill/catalog';
import type { DecideResult, DecisionDraft } from './decide.js';
import { sortParts } from './ritual.js';
import { minutesClock, slotOfClock } from './time.js';
import { DAYS, WEEKDAYS, WEEKEND, type Day, type PersonModel, type RitualPart, type Slot } from './types.js';
import { displayName, usageOf, type StackItemLike } from './usage.js';
import { DAY_ONE_PER_MOMENT, MAX_PER_MOMENT } from './validate.js';

/**
 * The Ritual, placed by rules. This is the skeleton every Ritual starts from, with or without
 * Claude: every kept thing goes where the routing table says it belongs, and nothing is invented.
 * Claude's compose step then names, pairs and orders these parts in their words, and may add a
 * part only from a quote of theirs. Day one stays small, because the engine knows least then.
 */

const WEEKDAY_WORDS: [RegExp, Day[]][] = [
  [/\bweekdays?\b|\bwork ?days?\b/i, [...WEEKDAYS]],
  [/\bweekends?\b/i, [...WEEKEND]],
  [/\b(every ?day|daily|each day|every morning|every night|nightly)\b/i, [...DAYS]],
  [/\bmondays?\b/i, ['mon']],
  [/\b(tuesdays?|tues)\b/i, ['tue']],
  [/\b(wednesdays?|weds)\b/i, ['wed']],
  [/\b(thursdays?|thurs)\b/i, ['thu']],
  [/\bfridays?\b/i, ['fri']],
  [/\bsaturdays?\b/i, ['sat']],
  [/\bsundays?\b/i, ['sun']],
];
const SLOT_WORDS: [RegExp, Slot][] = [
  [/\b(before bed|bedtime|at night|nights?|late)\b/i, 'night'],
  [/\b(evenings?|after work|dinner|tonight)\b/i, 'evening'],
  [/\b(lunch|midday|noon|afternoons?)\b/i, 'midday'],
  [/\b(mornings?|sunrise|wake|breakfast|before work|early)\b/i, 'morning'],
];

/** When something happens, read from their words: days, a time of day, a clock time. */
export function whenFromWords(text: string): { days?: Day[]; slot?: Slot; at?: string } {
  const out: { days?: Day[]; slot?: Slot; at?: string } = {};
  const days = new Set<Day>();
  for (const [pattern, ds] of WEEKDAY_WORDS) if (pattern.test(text)) ds.forEach((d) => days.add(d));
  if (days.size) out.days = DAYS.filter((d) => days.has(d));
  const clock = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b|\bat\s+(\d{1,2}):(\d{2})\b/i.exec(text);
  if (clock) {
    const h = Number(clock[1] ?? clock[4]);
    const m = Number(clock[2] ?? clock[5] ?? 0);
    const pm = (clock[3] ?? '').toLowerCase() === 'pm';
    const hour = clock[3] ? (h % 12) + (pm ? 12 : 0) : h;
    if (hour >= 5 && hour <= 23) {
      out.at = minutesClock(hour * 60 + m);
      out.slot = slotOfClock(out.at);
    }
  }
  // "Wine night" and "movie night" name an evening out, and "a few nights a week" is how often, not when.
  const plain = text
    .replace(/\b(wine|movie|date|game|girls'?|guys'?|quiz|pizza|taco|family|poker|trivia|karaoke) nights?\b/gi, ' ')
    .replace(/\b(a few|a couple of|some|most|two|three|four|five|\d) nights?( a week)?\b/gi, ' ')
    .replace(/\bnights? (out|in|off)\b/gi, ' ');
  if (!out.slot) for (const [pattern, slot] of SLOT_WORDS) if (pattern.test(plain)) {
    out.slot = slot;
    break;
  }
  return out;
}

/** Time words say when, not what: "Morning run" is matched on nothing, "Morning meditation" on "meditation". */
const NOT_A_THING = new Set(['morning', 'mornings', 'evening', 'evenings', 'before', 'after', 'daily', 'every', 'night', 'nights', 'tablets', 'minutes']);

/**
 * The phrase of their ideal day that names this thing ("morning meditation"), if any. Something in
 * the day they describe as their best happens every day unless they say otherwise; without this,
 * a thing with no frequency was placed once a week. More than half the name's words must be in the
 * phrase, so one shared word ("Morning sleep check", "Sleep through the night") isn't a mention.
 */
export function idealDayMention(idealDay: string, name: string): string | undefined {
  const stem = (w: string) => w.toLowerCase().replace(/ll/g, 'l').slice(0, 6);
  const stems = (name.match(/[a-z]{5,}/gi) ?? []).filter((w) => !NOT_A_THING.has(w.toLowerCase())).map(stem);
  if (!stems.length || !idealDay.trim()) return undefined;
  const phrases = idealDay.split(/[.;,!?]\s*|\s+(?:then|and then)\s+/i).map((p) => p.trim()).filter(Boolean);
  return phrases.find((p) => {
    const words = new Set((p.match(/[a-z]{5,}/gi) ?? []).map(stem));
    return stems.filter((s) => words.has(s)).length * 2 > stems.length;
  });
}

const WHY: Record<string, string> = {
  THEIRS: "This one's yours, and it stays exactly as it is.",
  LOVED: 'You love this one, so it keeps its place.',
  EVIDENCE_REGULAR: "One of the well-founded things you do, even on days you can't feel it.",
  TRAINS: "Doing real work for your training, even when you can't feel it.",
  NOTHING_TO_CLEAR: 'Part of your days as they are.',
};

/** Where a row naturally sits, when they haven't told us. */
function placement(view: CatalogItemView | undefined): { slot: Slot; weekendOnly: boolean } {
  const m = view?.moments ?? ['any'];
  const weekendOnly = m.length === 1 && m[0] === 'weekend';
  const first = m.find((x) => x !== 'any' && x !== 'weekend');
  if (first) return { slot: first, weekendOnly };
  if (!view) return { slot: 'evening', weekendOnly };
  if (view.area === 'sleep') return { slot: 'night', weekendOnly };
  if (view.kind === 'supplement' || view.kind === 'food-drink') return { slot: 'morning', weekendOnly };
  if (view.area === 'mind' || view.area === 'skin') return { slot: 'morning', weekendOnly };
  return { slot: weekendOnly ? 'morning' : 'evening', weekendOnly };
}

const RANK: Record<string, number> = { THEIRS: 5, LOVED: 4, TRAINS: 3, EVIDENCE_REGULAR: 3, NOTHING_TO_CLEAR: 1 };

export interface ComposeInput {
  readonly person: PersonModel;
  readonly stack: readonly StackItemLike[];
  readonly decided: DecideResult;
  readonly catalog: CatalogView;
  /** Day one: three parts a moment at most. */
  readonly firstCompose: boolean;
}

export function partIdFor(stackItemId: string): string {
  return `part:${stackItemId}`;
}

/** Everyone they named in this thing's name or notes. */
function peopleIn(person: PersonModel, text: string): string[] {
  return person.people
    .filter((p) => new RegExp(`\\b${p.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text))
    .map((p) => p.id);
}

export function composeByRules(input: ComposeInput): { parts: RitualPart[]; summary: string } {
  const { person, catalog, decided } = input;
  const cap = input.firstCompose ? DAY_ONE_PER_MOMENT : MAX_PER_MOMENT;
  const keepOf = new Map<string, DecisionDraft>();
  const clearing = new Set<string>();
  for (const d of decided.decisions) {
    if (!d.stackItemId) continue;
    if (d.kind === 'keep') keepOf.set(d.stackItemId, d);
    if (d.kind === 'clear' || d.kind === 'refer') clearing.add(d.stackItemId);
  }
  const outside = new Set(decided.clinicianIds);
  const candidates: { part: RitualPart; rank: number }[] = [];
  for (const s of [...input.stack].sort((a, b) => a.id.localeCompare(b.id))) {
    if (s.status === 'cut' || s.dataSource || outside.has(s.id) || clearing.has(s.id)) continue;
    const view = catalog.item(s.itemKey);
    // Less than weekly lives in their collection, not in mornings, nights and weekends.
    if (view && (view.cadence === 'monthly' || view.cadence === 'occasional')) continue;
    const keep = keepOf.get(s.id);
    const reason = keep?.reason ?? (person.values[s.id]?.attachment === 'theirs' ? 'THEIRS' : 'NOTHING_TO_CLEAR');
    const words = [s.customName ?? '', s.label ?? '', ...s.notes.map((n) => n.text)].join(' . ');
    // Their words first, then the row's own name ("Reading before bed"), then where the row sits.
    const own = whenFromWords(words);
    // A row's name gives a time of day ("Morning workout"), never a clock time ("before 8am" isn't when they run).
    type When = ReturnType<typeof whenFromWords>;
    const fromName: When = view ? whenFromWords(view.name) : {};
    const named: When = { ...(fromName.slot ? { slot: fromName.slot } : {}), ...(fromName.days ? { days: fromName.days } : {}) };
    const usage = usageOf(s, view);
    // Their ideal day fills in how often only when nothing else says: their own count (19 times in
    // 30 days is about 4 a week, not daily) and a weekly row's cadence come first.
    const mention =
      own.days || usage.perMonth !== null || view?.cadence === 'weekly'
        ? undefined
        : idealDayMention(person.identity.idealDay, displayName(s, view));
    const inDay: When = mention ? whenFromWords(mention) : {};
    const said = {
      ...named,
      ...inDay,
      ...own,
      slot: own.slot ?? inDay.slot ?? named.slot,
      days: own.days ?? (mention ? (inDay.days ?? [...DAYS]) : named.days),
    };
    const place = placement(view);
    const weekly = view?.cadence === 'weekly' || (!view && !said.days);
    const perWeek = weekly
      ? Math.max(1, Math.min(7, Math.round((usage.perMonth ?? 4) / 4.3)))
      : undefined;
    const days: Day[] = said.days ?? (place.weekendOnly ? [...WEEKEND] : weekly ? [] : [...DAYS]);
    const people = peopleIn(person, words);
    const part: RitualPart = {
      id: partIdFor(s.id),
      when: {
        slot: said.slot ?? place.slot,
        days,
        ...(said.at ? { at: said.at } : {}),
        ...(!days.length && perWeek ? { perWeek } : {}),
      },
      order: 0,
      title: displayName(s, view),
      ...(view?.kind === 'movement' || view?.ritualRole === 'anchor' ? { minutes: 45 } : {}),
      ...(people.length ? { people } : {}),
      area: view?.area ?? 'mind',
      why: WHY[reason] ?? WHY.NOTHING_TO_CLEAR!,
      source: { kind: 'stack', stackItemId: s.id, itemKey: s.itemKey },
      ...(view && (view.tier === 'A' || view.tier === 'B') && s.itemKey
        ? { evidence: { itemKey: s.itemKey, tier: view.tier } }
        : {}),
      status: 'active',
      lock: reason === 'THEIRS' ? 'theirs' : null,
    };
    if (!part.when.days.length && !part.when.perWeek) part.when = { ...part.when, perWeek: 1 };
    candidates.push({ part, rank: (RANK[reason] ?? 1) + (view?.ritualRole === 'anchor' ? 0.5 : 0) + (people.length ? 1 : 0) });
  }
  // Keep each moment within the cap: theirs and loved first, then anchors, then the well-founded.
  candidates.sort((a, b) => b.rank - a.rank || a.part.id.localeCompare(b.part.id));
  const kept: RitualPart[] = [];
  const count = new Map<string, number>();
  const keyOf = (d: Day, slot: Slot) => `${d}:${momentKey(d, slot)}`;
  const roomIn = (k: string) => (count.get(k) ?? 0) < cap;
  for (const { part } of candidates) {
    const fixedDays = part.when.days;
    if (!fixedDays.length) {
      const k = `flex:${part.when.slot}`;
      if (!roomIn(k) && !part.lock) continue;
      count.set(k, (count.get(k) ?? 0) + 1);
      kept.push(part);
      continue;
    }
    // A full Saturday doesn't push a daily thing out of every weekday: it keeps the days with room.
    const days = part.lock ? fixedDays : fixedDays.filter((d) => roomIn(keyOf(d, part.when.slot)));
    if (!days.length) continue;
    for (const d of days) count.set(keyOf(d, part.when.slot), (count.get(keyOf(d, part.when.slot)) ?? 0) + 1);
    kept.push(days.length === fixedDays.length ? part : { ...part, when: { ...part.when, days } });
  }
  const parts = sortParts(kept).map((p, i) => ({ ...p, order: i }));
  return {
    parts,
    summary: parts.length
      ? 'Your mornings, nights and weekends, built around what you keep.'
      : 'Your Ritual starts with what you love. Tell Distill about a morning you like.',
  };
}

function momentKey(day: Day, slot: Slot): string {
  if (day === 'sat' || day === 'sun') return day;
  return slot === 'morning' || slot === 'midday' ? 'morning' : 'night';
}
