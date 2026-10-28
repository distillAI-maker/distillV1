import { decide, tierFor, type DecideInput } from './decide.js';
import { BORROWED_ORIGINS, displayName, trainsOf, usageOf, type StackItemLike } from './usage.js';

/**
 * Questions worth asking. Each row has a question a friend would ask, but a question is only worth
 * someone's minute when the answer changes what Distill does. So every candidate is run through the
 * decide step once per possible answer, and only questions whose answers lead to different places
 * survive, ranked by what is at stake.
 */

export type QuestionPatch =
  | { readonly kind: 'answers'; readonly stackItemId: string; readonly set: Readonly<Record<string, unknown>> }
  | {
      readonly kind: 'origin';
      readonly stackItemId: string;
      readonly origin: 'online' | 'friend' | 'podcast' | 'doctor' | 'other';
    }
  | {
      readonly kind: 'attachment';
      readonly stackItemId: string;
      readonly attachment: 'loved' | 'neutral' | 'borrowed' | 'theirs';
    }
  /** They don't know or would rather not say: nothing changes, and the question rests a while. */
  | { readonly kind: 'unsure'; readonly stackItemId: string };

/** The last button on every question card. */
export const NOT_SURE = 'Not sure';
const notSure = (stackItemId: string): QuestionOption => ({ label: NOT_SURE, patch: { kind: 'unsure', stackItemId } });

export interface QuestionOption {
  readonly label: string;
  readonly patch: QuestionPatch;
}

export interface QuestionDraft {
  /** `q:${stackItemId}:${variable}`. */
  readonly id: string;
  readonly stackItemId: string;
  readonly variable: 'origin' | 'trains' | 'usage' | 'company' | 'feel';
  readonly name: string;
  readonly text: string;
  readonly options: readonly QuestionOption[];
  /** What is at stake: money a clear could give back, protection of something well-founded. */
  readonly value: number;
}

/** The input with one answer applied, as if they had told us. */
export function withPatch(input: DecideInput, patch: QuestionPatch): DecideInput {
  if (patch.kind === 'unsure') return input;
  const stack = input.stack.map((s) => {
    if (s.id !== patch.stackItemId) return s;
    if (patch.kind === 'answers') return { ...s, answers: { ...s.answers, ...patch.set } };
    if (patch.kind === 'origin') return { ...s, origin: patch.origin };
    return s;
  });
  if (patch.kind !== 'attachment') return { ...input, stack };
  const current = input.person.values[patch.stackItemId];
  return {
    ...input,
    stack,
    person: {
      ...input.person,
      values: {
        ...input.person.values,
        [patch.stackItemId]: {
          attachment: patch.attachment,
          reasons: current?.reasons ?? [],
          from: 'answer',
        },
      },
    },
  };
}

/**
 * What happens to the item, at the level that matters to the person: it stays (kept, or outside the
 * edit), it's proposed for clearing, it's adjusted, or it goes to a dermatologist.
 */
function outcomeFor(input: DecideInput, stackItemId: string): string {
  const result = decide(input);
  if (result.clinicianIds.includes(stackItemId)) return 'stays';
  const mine = result.decisions.filter((d) => d.stackItemId === stackItemId);
  if (mine.some((d) => d.kind === 'refer')) return 'refer';
  if (mine.some((d) => d.kind === 'clear')) return 'clear';
  if (mine.some((d) => d.kind === 'curate' && (d.reason === 'ADJUST_DOSE' || d.reason === 'ADJUST_FORM')))
    return 'adjust';
  return 'stays';
}

function candidates(input: DecideInput, s: StackItemLike): Omit<QuestionDraft, 'value'>[] {
  const v = input.catalog.item(s.itemKey);
  const name = displayName(s, v);
  const out: Omit<QuestionDraft, 'value'>[] = [];
  const attachment = input.person.values[s.id]?.attachment ?? 'unknown';
  if (!s.origin && attachment === 'unknown')
    out.push({
      id: `q:${s.id}:origin`,
      stackItemId: s.id,
      variable: 'origin',
      name,
      // The item's own wording when the catalog has it; the buttons are the same either way.
      text: v?.originQuestion || `Where did ${name} come from?`,
      options: [
        { label: 'A feed or an ad', patch: { kind: 'origin', stackItemId: s.id, origin: 'online' } },
        { label: 'A friend', patch: { kind: 'origin', stackItemId: s.id, origin: 'friend' } },
        { label: 'A podcast', patch: { kind: 'origin', stackItemId: s.id, origin: 'podcast' } },
        { label: 'My doctor', patch: { kind: 'origin', stackItemId: s.id, origin: 'doctor' } },
        { label: 'I found it myself', patch: { kind: 'origin', stackItemId: s.id, origin: 'other' } },
        notSure(s.id),
      ],
    });
  if (v && v.evidenceRequires === 'trains' && trainsOf(s, input.stack) === null)
    out.push({
      id: `q:${s.id}:trains`,
      stackItemId: s.id,
      variable: 'trains',
      name,
      // Fixed, so the words always fit the buttons. The catalog's human_question is background for Claude.
      text: 'Do you lift or train hard most weeks?',
      options: [
        { label: 'Yes, most weeks', patch: { kind: 'answers', stackItemId: s.id, set: { trains: true } } },
        { label: 'Not really', patch: { kind: 'answers', stackItemId: s.id, set: { trains: false } } },
        notSure(s.id),
      ],
    });
  const usage = usageOf(s, v);
  if (usage.unused === null && usage.regular === null && s.monthlyCost > 0) {
    const weekly = v?.cadence === 'weekly' || v?.kind === 'service';
    out.push({
      id: `q:${s.id}:usage`,
      stackItemId: s.id,
      variable: 'usage',
      name,
      // You go to a class or a clinic; you use a massage gun.
      text: v?.kind === 'service' && !/\b(app|apps|delivery|box|subscription)\b/i.test(`${name} ${v.name}`) ? `How often did you go to ${name} last month?` : weekly ? `How often did you use ${name} last month?` : `How often do you use ${name} these days?`,
      options: weekly
        ? [
            { label: 'Not once', patch: { kind: 'answers', stackItemId: s.id, set: { visitsLast30Days: 0 } } },
            { label: 'Once or twice', patch: { kind: 'answers', stackItemId: s.id, set: { visitsLast30Days: 2 } } },
            { label: 'About weekly', patch: { kind: 'answers', stackItemId: s.id, set: { visitsLast30Days: 4 } } },
            { label: 'More than that', patch: { kind: 'answers', stackItemId: s.id, set: { visitsLast30Days: 10 } } },
            notSure(s.id),
          ]
        : [
            { label: 'Most days', patch: { kind: 'answers', stackItemId: s.id, set: { usesLast30Days: 25 } } },
            { label: 'A few times a week', patch: { kind: 'answers', stackItemId: s.id, set: { usesLast30Days: 12 } } },
            { label: 'Now and then', patch: { kind: 'answers', stackItemId: s.id, set: { usesLast30Days: 4 } } },
            { label: 'Not lately', patch: { kind: 'answers', stackItemId: s.id, set: { usesLast30Days: 0 } } },
            notSure(s.id),
          ],
    });
  }
  // Mixed evidence and it costs money: whether they can feel it is what decides (Veer, 25 Oct).
  if (
    v &&
    FELT_KINDS.has(v.kind) &&
    (attachment === 'unknown' || attachment === 'neutral') &&
    tierFor(v, s, input.stack) === 'C' &&
    s.monthlyCost > 0 &&
    s.answers.feels === undefined &&
    v.evidenceDirection !== 'cost'
  )
    out.push({
      id: `q:${s.id}:feel`,
      stackItemId: s.id,
      variable: 'feel',
      name,
      text: `Can you feel ${name} doing something for you?`,
      options: [
        { label: 'Yes, I can tell', patch: { kind: 'answers', stackItemId: s.id, set: { feels: true } } },
        { label: 'Not really', patch: { kind: 'answers', stackItemId: s.id, set: { feels: false } } },
        notSure(s.id),
      ],
    });
  // Only for things people really share (drinks, a late dinner, the afternoon coffee): never
  // "Is Celsius more about the company?".
  // Never once they've told us about it in their own words ("in my hand all day at my desk").
  if (v && attachment === 'unknown' && !s.notes.length && v.clearWhen.includes('UNLOVED_HABIT') && v.kind !== 'practice' && v.whyLoved.some((w) => w === 'connection' || w === 'belonging'))
    out.push({
      id: `q:${s.id}:company`,
      stackItemId: s.id,
      variable: 'company',
      name,
      // Fixed, so the words always fit the buttons.
      text: `Is ${name} more about the company, or a habit on your own?`,
      options: [
        // Shared with people they love: theirs, and Distill leaves it alone (Veer, 25 Oct).
        { label: 'Mostly with people I love', patch: { kind: 'attachment', stackItemId: s.id, attachment: 'theirs' } },
        { label: 'Mostly on my own', patch: { kind: 'attachment', stackItemId: s.id, attachment: 'neutral' } },
        notSure(s.id),
      ],
    });
  return out;
}

/** Questions whose answers would change a decision, most at stake first. */
export function valuableQuestions(input: DecideInput, limit = 10): QuestionDraft[] {
  const out: QuestionDraft[] = [];
  const base = decide(input);
  const outside = new Set(base.clinicianIds);
  for (const s of input.stack) {
    if (s.status === 'cut' || s.dataSource || outside.has(s.id)) continue;
    if (base.theirsIds.includes(s.id)) continue;
    for (const q of candidates(input, s)) {
      const outcomes = q.options.map((o) => outcomeFor(withPatch(input, o.patch), s.id));
      const distinct = new Set(outcomes);
      if (distinct.size < 2) continue;
      const clears = outcomes.includes('clear');
      // Unknowns already default to keeping things, so what an answer can change is money and safety.
      const value =
        10 +
        (clears ? Math.min(Math.max(0, s.monthlyCost), 300) / 3 : 0) +
        (outcomes.includes('refer') ? 15 : 0) +
        (s.origin && BORROWED_ORIGINS.has(s.origin) ? 5 : 0);
      out.push({ ...q, value });
    }
  }
  // One question per thing at a time, the one that settles most first: how often comes before
  // "can you feel it" (unused makes feeling moot), and the rest wait their turn.
  const one = new Map<string, QuestionDraft>();
  for (const q of out) {
    const had = one.get(q.stackItemId);
    if (!had || ORDER.indexOf(q.variable) < ORDER.indexOf(had.variable)) one.set(q.stackItemId, q);
  }
  return [...one.values()].sort((a, b) => b.value - a.value || a.id.localeCompare(b.id)).slice(0, limit);
}

const ORDER: readonly QuestionDraft['variable'][] = ['origin', 'usage', 'trains', 'company', 'feel'];

/** Things whose point is how they make you feel. Never a service (meal delivery, an app, a class). */
const FELT_KINDS = new Set(['supplement', 'food-drink', 'topical', 'device', 'practice', 'movement']);
