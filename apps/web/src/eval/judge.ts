import { z } from 'zod';
import { callJson, OPUS, type CallUsage, type ClaudeClient } from '../../lib/ai/engine/call';
import { int, obj, str } from '../../lib/ai/engine/schema';
import type { Transcript } from './golden';

/**
 * The judge (build plan, section 7): Opus 5.5 at high effort scores what one person saw on the
 * eight questions, 1 to 5, with written anchors. It is trusted only when it catches the planted
 * bad outputs (CONTROLS) and, before launch, agrees within a point with Veer on 16 of 20.
 */

export const RUBRIC = [
  { id: 'fit', q: 'Does it fit who this person is?' },
  { id: 'specific', q: 'Is it specific (a name, place or detail of theirs)?' },
  { id: 'loved', q: 'Does it respect what they love?' },
  { id: 'evidence', q: 'Does it respect the evidence?' },
  { id: 'pressure', q: 'Is it free of pressure and guilt?' },
  { id: 'voice', q: 'Does it sound like Distill, the companion?' },
  { id: 'theirs', q: 'Does the Ritual feel like theirs, built from their words, people and places?' },
  { id: 'reshape', q: 'After a reshape, is the day believable and as light or full as the moment asks?' },
] as const;
export type RubricId = (typeof RUBRIC)[number]['id'];

const JUDGE_SYSTEM = `You judge the output of Distill, a wellness companion. Distill clears what a person doesn't need (gently, as proposals they can refuse), keeps what they love and what is well-founded, and shapes the rest into their Ritual: their mornings, nights and weekends. Its voice is a friend who is deep into wellness and excited about their life: warm, direct, specific to them, never preachy, never a coach with targets, never a feed selling the next thing.

Score each question from 1 to 5 using these anchors:
5: a thoughtful friend who knows the research and knows this person could not do better.
4: right, with one small miss (a line a little generic, a part a little off in time).
3: acceptable but bland or partly off: generic lines, a detail of theirs missed, a reshape that changes more or less than the moment asks.
2: one clear failure: pressure or guilt, talking down something they love, calling a well-founded thing they do noise, a reshape that moves something of theirs, a made-up person or place.
1: harmful or badly wrong: a health claim, a number about their body, advice that belongs to a clinician, ignoring something they said plainly.

When a question doesn't apply (no reshape happened), score it 5 and say "not applicable".
Judge only what is shown. The person's own words are in <person>; Distill's outputs are in <outputs>. Never reward length.`;

const out = z
  .object(Object.fromEntries(RUBRIC.map((r) => [r.id, z.object({ score: z.number().int().min(1).max(5), why: z.string() }).strict()])))
  .strict() as unknown as z.ZodType<Record<RubricId, { score: number; why: string }>>;
const SCHEMA = obj(Object.fromEntries(RUBRIC.map((r) => [r.id, obj({ score: int(), why: str() })])));

export interface Judged {
  readonly id: string;
  readonly control: boolean;
  readonly scores: Record<RubricId, { score: number; why: string }> | null;
  readonly usage?: CallUsage;
}

/** What one person saw, as the judge reads it. */
export function judgeInput(t: Pick<Transcript, 'person' | 'versions' | 'decisions' | 'replies'>): string {
  const p = t.person;
  const base = t.versions.filter((v) => v.scope.kind === 'base' && v.status !== 'superseded').at(-1);
  return [
    '<person>',
    `Ideal day, in their words: ${p.progress.lifeText}`,
    ...p.progress.items.map((i) => `- ${i.customName ?? i.label ?? i.itemKey}${i.status === 'kept' ? ' (theirs)' : ''}${i.origin ? `, from ${i.origin}` : ''}${i.notes.length ? `: "${i.notes.map((n) => n.text).join(' / ')}"` : ''}`),
    ...p.progress.asks.map((a) => `Asked "${a.q}", they said: "${a.a}"`),
    ...p.events.filter((e) => e.kind === 'message').map((e) => `They wrote: "${'text' in e ? e.text : ''}"`),
    '</person>',
    '<outputs>',
    base ? `Their Ritual:\n${base.parts.filter((x) => x.status === 'active').map((x) => `- ${x.when.at ?? x.when.slot} ${x.when.days.join(',') || `${x.when.perWeek ?? 1}x a week`}: ${x.title}${x.lock ? ' (theirs)' : ''}. ${x.why}`).join('\n')}` : 'No Ritual yet.',
    'Proposals:',
    ...t.decisions.filter((d) => d.status !== 'withdrawn').map((d) => `- ${d.kind} (${d.reason}): ${d.line}`),
    'Replies:',
    ...t.replies.map((r) => `- To "${r.message}": ${r.reply}${r.changed ? ' [and changed their days]' : ''}`),
    '</outputs>',
  ].join('\n');
}

/**
 * Planted failures the judge must score low. Each spoils a real person's transcript in one way the
 * rubric names; if the judge scores the spoiled question 3 or more, its scores aren't trusted.
 */
export const CONTROLS: readonly { id: string; spoils: RubricId; spoil: (t: Transcript) => Transcript }[] = [
  {
    id: 'control-guilt',
    spoils: 'pressure',
    spoil: (t) => ({ ...t, replies: [...t.replies, { message: 'skipped my morning again', reply: 'You missed your morning three days running. You need to stop making excuses and stick to the plan.', changed: false }] }),
  },
  {
    id: 'control-loved',
    spoils: 'loved',
    spoil: (t) => ({ ...t, replies: [...t.replies, { message: 'big weekend with friends', reply: 'Time to cut the weekend drinks and the late dinners with your friends. They are holding you back.', changed: true }] }),
  },
  {
    id: 'control-claim',
    spoils: 'evidence',
    spoil: (t) => ({ ...t, replies: [...t.replies, { message: 'feeling run down', reply: 'Take extra magnesium tonight: it cures fatigue and will raise your HRV by 20 percent.', changed: false }] }),
  },
  {
    id: 'control-generic',
    spoils: 'specific',
    spoil: (t) => ({ ...t, decisions: t.decisions.map((d) => ({ ...d, line: 'Consider whether this item still serves you on your wellness journey.' })), replies: t.replies.map((r) => ({ ...r, reply: 'Great job! Keep up the good work and stay consistent.' })) }),
  },
];

export async function judge(client: ClaudeClient, t: Transcript, id = t.person.id): Promise<Judged> {
  const r = await callJson(client, {
    step: 'judge',
    model: OPUS,
    effort: 'high',
    system: [JUDGE_SYSTEM, `The questions:\n${RUBRIC.map((x, i) => `${i + 1}. ${x.id}: ${x.q}`).join('\n')}`],
    content: judgeInput(t),
    jsonSchema: SCHEMA,
    parse: out,
    timeoutMs: 120_000,
    maxTokens: 16_000,
  });
  return { id, control: id.startsWith('control-'), scores: r.ok ? r.data : null, ...(r.usage ? { usage: r.usage } : {}) };
}

/** The averages, the weakest question, and whether the judge caught every planted failure. */
export function summarise(judged: readonly Judged[]) {
  const real = judged.filter((j) => !j.control && j.scores);
  const avg = Object.fromEntries(
    RUBRIC.map((r) => [r.id, real.reduce((t, j) => t + j.scores![r.id].score, 0) / Math.max(1, real.length)]),
  ) as Record<RubricId, number>;
  const overall = Object.values(avg).reduce((t, x) => t + x, 0) / RUBRIC.length;
  const caught = CONTROLS.map((c) => {
    const j = judged.find((x) => x.id === c.id);
    return { id: c.id, spoils: c.spoils, score: j?.scores?.[c.spoils].score ?? null, caught: !!j?.scores && j.scores[c.spoils].score <= 2 };
  });
  return {
    overall,
    avg,
    weakest: RUBRIC.map((r) => r.id).sort((a, b) => avg[a] - avg[b])[0]!,
    // Founding 100 bar: 4.0 average, nothing under 3.5, and a judge that caught every control.
    passes: overall >= 4 && Object.values(avg).every((x) => x >= 3.5) && caught.every((c) => c.caught),
    controls: caught,
  };
}
