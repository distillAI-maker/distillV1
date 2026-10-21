import type { QuestionDraft } from './questions.js';
import { daysBetween } from './time.js';
import type { Decision, Season } from './types.js';

/**
 * Today's one thing (replaces pickDaily). Rules choose the kind of thing worth a minute today; when
 * the rules rank several candidates as equal, one is picked at random and the chance is logged, so
 * that by December the data can say what else might have worked. Nobody feels the difference: the
 * shuffle is only ever between things the rules consider equally good.
 */

export type TodayKind =
  | 'refer'
  | 'clear'
  | 'adjust'
  | 'question'
  | 'more'
  | 'explore'
  | 'curate'
  | 'keep'
  | 'learn'
  | 'celebrate';

export interface TodayCandidate {
  readonly id: string;
  readonly kind: TodayKind;
  /** A decision id, a question id, a place id, or the question text for 'learn'. */
  readonly ref: string;
  readonly stackItemId?: string;
  /** Priority class: the rules' ordering of kinds. Higher wins. */
  readonly cls: number;
  /** Within a class: money at stake, information value, newness. */
  readonly score: number;
}

export interface TodayHistory {
  readonly date: string;
  readonly kind: TodayKind;
  readonly ref: string;
}

export interface PickTodayInput {
  readonly personId: string;
  readonly today: string;
  readonly season: Season;
  readonly decisions: readonly Decision[];
  readonly questions: readonly QuestionDraft[];
  readonly history: readonly TodayHistory[];
  /** Places not yet asked about in "Anything we haven't seen?". */
  readonly moreLeft: readonly string[];
  readonly exploreOpen: boolean;
  /** An identity question for the picture, when there is one left. */
  readonly learnQuestion?: string;
}

export interface TodayPick {
  readonly pick: TodayCandidate | null;
  /** Every eligible candidate, for the exposure log. */
  readonly candidates: readonly TodayCandidate[];
  /** The chance this pick had, given the rules: 1 when the rules alone decided. */
  readonly propensity: number;
  readonly why: string;
}

/** Classes, highest first. Safety, then clearing (the core job), then what makes clearing easier. */
export const CLASS: Record<TodayKind, number> = {
  refer: 90,
  clear: 70,
  adjust: 65,
  more: 62,
  question: 60,
  explore: 50,
  curate: 45,
  keep: 40,
  learn: 30,
  celebrate: 20,
};

/** What each season leaves room for. Busy weeks get small, kind things; unwell gets quiet. */
const ALLOWED: Record<Season, ReadonlySet<TodayKind>> = {
  steady: new Set(Object.keys(CLASS) as TodayKind[]),
  energised: new Set(Object.keys(CLASS) as TodayKind[]),
  busy: new Set<TodayKind>(['refer', 'question', 'keep', 'celebrate']),
  stressed: new Set<TodayKind>(['refer', 'keep', 'celebrate', 'learn']),
  travelling: new Set<TodayKind>(['refer', 'keep', 'celebrate']),
  low: new Set<TodayKind>(['refer', 'keep', 'celebrate', 'learn']),
  unwell: new Set<TodayKind>(['refer', 'celebrate']),
};

/** Days before the same thing can be offered again. */
export const REPEAT_DAYS = 5;
/** If clearing is waiting and none was offered in this many days, today is a clearing day. */
export const CLEAR_FLOOR_DAYS = 3;
/** Within a class, scores this close are equal, and the pick between them is a fair draw. */
export const TIE = 1;

/** A small seeded generator, so a person's draw for a date is the same on every rebuild. */
function seeded(seed: string): () => number {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

function candidatesFrom(input: PickTodayInput): TodayCandidate[] {
  const out: TodayCandidate[] = [];
  for (const d of input.decisions) {
    if (d.status !== 'proposed') continue;
    const base = { id: `decision:${d.id}`, ref: d.id, ...(d.stackItemId ? { stackItemId: d.stackItemId } : {}) };
    if (d.kind === 'refer') out.push({ ...base, kind: 'refer', cls: CLASS.refer, score: 0 });
    else if (d.kind === 'clear')
      out.push({
        ...base,
        kind: 'clear',
        cls: CLASS.clear,
        // Money first, then the weaker the case for it, the easier the conversation.
        score: Math.min(d.money, 300) / 10 + (d.evidenceTier === 'N' ? 3 : d.evidenceTier === 'D' ? 2 : 0),
      });
    else if (d.kind === 'curate' && (d.reason === 'ADJUST_DOSE' || d.reason === 'ADJUST_FORM'))
      out.push({ ...base, kind: 'adjust', cls: CLASS.adjust, score: 0 });
    else if (d.kind === 'curate') out.push({ ...base, kind: 'curate', cls: CLASS.curate, score: 0 });
    else if (d.kind === 'keep' && (d.reason === 'EVIDENCE_REGULAR' || d.reason === 'TRAINS'))
      out.push({ ...base, kind: 'keep', cls: CLASS.keep, score: d.evidenceTier === 'A' ? 2 : 1 });
    else if (d.kind === 'keep' && (d.reason === 'THEIRS' || d.reason === 'LOVED'))
      out.push({ ...base, kind: 'celebrate', cls: CLASS.celebrate, score: 0 });
  }
  for (const q of input.questions)
    out.push({
      id: `question:${q.id}`,
      kind: 'question',
      ref: q.id,
      stackItemId: q.stackItemId,
      cls: CLASS.question,
      score: q.value / 10,
    });
  const lastMore = input.history.filter((h) => h.kind === 'more').map((h) => h.date).sort().at(-1);
  if (input.moreLeft.length && (!lastMore || daysBetween(lastMore, input.today) >= 2))
    out.push({ id: `more:${input.moreLeft[0]}`, kind: 'more', ref: input.moreLeft[0]!, cls: CLASS.more, score: 0 });
  if (input.exploreOpen) out.push({ id: 'explore:ask', kind: 'explore', ref: 'ask', cls: CLASS.explore, score: 0 });
  if (input.learnQuestion)
    out.push({ id: `learn:${input.learnQuestion}`, kind: 'learn', ref: input.learnQuestion, cls: CLASS.learn, score: 0 });
  return out;
}

export function pickToday(input: PickTodayInput): TodayPick {
  const allowed = ALLOWED[input.season];
  const recent = (ref: string) =>
    input.history.some((h) => h.ref === ref && daysBetween(h.date, input.today) < REPEAT_DAYS);
  // Clearing is the core job, with a rhythm: never two days running, and never more than three
  // days without it while something is waiting to be let go.
  const lastClear = input.history.filter((h) => h.kind === 'clear').map((h) => h.date).sort().at(-1);
  const sinceClear = lastClear ? daysBetween(lastClear, input.today) : Infinity;
  const clearClass = sinceClear <= 1 ? 35 : sinceClear >= CLEAR_FLOOR_DAYS ? 80 : CLASS.clear;
  const candidates = candidatesFrom(input)
    .filter((c) => allowed.has(c.kind) && !recent(c.ref))
    .map((c) => (c.kind === 'clear' ? { ...c, cls: clearClass } : c));
  if (!candidates.length) return { pick: null, candidates: [], propensity: 1, why: 'quiet day' };
  const top = Math.max(...candidates.map((c) => c.cls));
  const inClass = candidates.filter((c) => c.cls === top);
  const best = Math.max(...inClass.map((c) => c.score));
  const ties = inClass.filter((c) => best - c.score <= TIE).sort((a, b) => a.id.localeCompare(b.id));
  const draw = seeded(`${input.personId}:${input.today}`)();
  const pick = ties[Math.min(ties.length - 1, Math.floor(draw * ties.length))]!;
  return {
    pick,
    candidates,
    propensity: 1 / ties.length,
    why: ties.length > 1 ? `fair draw among ${ties.length} equal ${pick.kind} options` : `rules: ${pick.kind}`,
  };
}
