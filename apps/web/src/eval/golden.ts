import { readdirSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { z } from 'zod';
import type { CatalogView, ToneRules } from '@distill/catalog';
import type { Database } from '@distill/data';
import {
  MAX_PER_MOMENT,
  validateRitual,
  type Decision,
  type ExploreBank,
  type RitualPart,
  type RitualVersion,
} from '@distill/engine/ritual';
import * as schema from '../../../../packages/data/src/schema';
import type { ClaudeClient } from '../../lib/ai/engine/call';
import { progressSchema, type Progress } from '../../lib/progress/types';
import { Engine, type EngineState } from '../server/engine';
import { EngineStore } from '../server/engine-store';

/**
 * The golden set (eval/people/*.json): 40 people, each a saved Progress, two weeks of what they do
 * and say, and what must and must not happen. Every engine change runs against all of them: the
 * hard gates in vitest with no key (golden.test.ts), the judged run with one (scripts/eval-engine.ts).
 */

const at = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?[+-]\d{2}:\d{2}$/);
export const goldenEventSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('note'), stackItemId: z.string(), at, text: z.string().min(1) }).strict(),
  z.object({ kind: z.literal('answer'), at, q: z.string().min(1), a: z.string().min(1) }).strict(),
  z.object({ kind: z.literal('message'), at, text: z.string().min(1) }).strict(),
  z.object({ kind: z.literal('night'), date: z.iso.date(), sleepMin: z.number().int().min(0).max(900) }).strict(),
  z
    .object({ kind: z.literal('decision-answer'), stackItemId: z.string(), answer: z.enum(['yes', 'not-now', 'theirs']) })
    .strict(),
]);
export type GoldenEvent = z.infer<typeof goldenEventSchema>;

export const goldenPersonSchema = z
  .object({
    id: z.string().regex(/^[a-z]+-\d{2}$/),
    summary: z.string().min(1),
    draftedBy: z.enum(['example', 'Claude', 'Veer', 'Ishan', 'Rohan']),
    covers: z.array(z.string()),
    timeZone: z.string(),
    now: at,
    /** A wearable person's usual night, in minutes. Varies with their life (a new parent, a night nurse). */
    usualSleepMin: z.number().int().min(240).max(600).optional(),
    progress: progressSchema,
    events: z.array(goldenEventSchema).min(1).max(10),
    expect: z
      .object({
        keep: z.array(z.string()),
        clearAllowed: z.array(z.string()),
        clearExpected: z.array(z.string()),
        refer: z.array(z.string()),
        neverTouch: z.array(z.string()),
        neverSay: z.array(z.string()),
        mustMention: z.array(z.string()),
        notes: z.string(),
      })
      .strict(),
  })
  .strict();
export type GoldenPerson = z.infer<typeof goldenPersonSchema>;

const PEOPLE = new URL('../../../../eval/people/', import.meta.url);

export function loadGolden(): GoldenPerson[] {
  return readdirSync(PEOPLE)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => goldenPersonSchema.parse(JSON.parse(readFileSync(new URL(f, PEOPLE), 'utf8'))));
}

/** A Postgres in memory with the app's migrations, for runs that need no network. */
export async function memoryDatabase() {
  const pg = new PGlite();
  await pg.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
    create table public.signups(email text);`);
  for (const file of [
    '202610020001_phase_two.sql',
    '202610020002_phase_four.sql',
    '202610030001_phase_eight.sql',
    '20261006222901_app_journey.sql',
    '20261013000001_app_events.sql',
    '20261021000001_engine.sql',
  ])
    await pg.exec(await readFile(new URL(`../../../../supabase/migrations/${file}`, import.meta.url), 'utf8'));
  const store = new EngineStore(drizzle(pg, { schema }) as unknown as Database);
  return {
    pg,
    store,
    addUser: (id: string) => pg.exec(`insert into auth.users values ('${id}') on conflict do nothing`),
  };
}

/** A stable uuid for a person id, so reruns line up. */
export function userIdFor(personId: string): string {
  let h = 2166136261;
  for (const c of personId) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const hex = (h >>> 0).toString(16).padStart(8, '0');
  return `30000000-0000-4000-8000-0000${hex}`;
}

/** 07:30 local on a date, as an instant, for a night arriving in the morning. */
function morningOf(date: string, timeZone: string): Date {
  const guess = new Date(`${date}T07:30:00Z`);
  const local = new Date(guess.toLocaleString('en-US', { timeZone }));
  const utc = new Date(guess.toLocaleString('en-US', { timeZone: 'UTC' }));
  return new Date(guess.getTime() - (local.getTime() - utc.getTime()));
}

export interface Seen {
  readonly where: 'decision' | 'reply' | 'part' | 'summary';
  readonly text: string;
  /** A part titled in their own words for something on their list ("Detox tea"): their label, not ours. */
  readonly own?: boolean;
}

export interface Transcript {
  readonly person: GoldenPerson;
  readonly userId: string;
  readonly decisions: readonly Decision[];
  readonly versions: readonly RitualVersion[];
  readonly final: EngineState;
  /** Everything the person could read. */
  readonly seen: readonly Seen[];
  readonly replies: readonly { message: string; reply: string; changed: boolean }[];
  /** Events that went nowhere (a decision-answer for something never proposed), for the report. */
  readonly notes: readonly string[];
  readonly calls: number;
  readonly costUsd: number;
}

export interface RunDeps {
  readonly store: EngineStore;
  readonly addUser: (id: string) => Promise<unknown>;
  readonly client: ClaudeClient | null;
  readonly catalog: CatalogView;
  readonly toneRules: Pick<ToneRules, 'bannedPhrases' | 'maxWordsExclusive' | 'gatedMaxWords'>;
  readonly bank: ExploreBank;
}

/** Plays one person: onboarding, their yes to the first Ritual, then two weeks of their events. */
export async function runGolden(person: GoldenPerson, deps: RunDeps): Promise<Transcript> {
  const userId = userIdFor(person.id);
  await deps.addUser(userId);
  let clock = new Date(person.now);
  let progress: Progress = structuredClone(person.progress);
  const wearable = !!progress.dataSource;
  // A wearable person's usual nights: four weeks around their usual (seven hours unless the file
  // says), about 25 minutes either way.
  const usual = person.usualSleepMin ?? 420;
  const nights: { date: string; sleepMin: number }[] = wearable
    ? Array.from({ length: 28 }, (_, i) => {
        const d = new Date(clock.getTime() - (28 - i) * 86_400_000).toISOString().slice(0, 10);
        return { date: d, sleepMin: usual + ((i * 37) % 51) - 25 };
      })
    : [];
  const engine = new Engine({
    store: deps.store,
    loadProgress: async () => progress,
    loadNights: async () => nights,
    client: deps.client,
    catalog: deps.catalog,
    toneRules: deps.toneRules,
    bank: deps.bank,
    now: () => clock,
  });
  const opts = { timeZone: person.timeZone };
  const replies: { message: string; reply: string; changed: boolean }[] = [];
  const notes: string[] = [];

  const first = await engine.run(userId, { kind: 'onboarding' }, opts);
  if (first.versionId) await engine.accept(userId, first.versionId, opts);
  if (wearable) await engine.setNightsShapeMornings(userId, true, opts);

  for (const event of person.events) {
    clock = event.kind === 'night' ? morningOf(event.date, person.timeZone) : 'at' in event ? new Date(event.at) : clock;
    switch (event.kind) {
      case 'note': {
        progress = {
          ...progress,
          items: progress.items.map((i) =>
            i.id === event.stackItemId ? { ...i, notes: [...i.notes, { id: `eval-${i.notes.length}`, text: event.text, at: event.at }] } : i,
          ),
        };
        await engine.run(userId, { kind: 'note', stackItemId: event.stackItemId, text: event.text }, opts);
        break;
      }
      case 'answer':
        progress = { ...progress, asks: [...progress.asks, { q: event.q, a: event.a, at: event.at }] };
        await engine.run(userId, { kind: 'answer', q: event.q, a: event.a }, opts);
        break;
      case 'message': {
        const r = await engine.run(userId, { kind: 'message', text: event.text }, opts);
        replies.push({ message: event.text, reply: r.reply ?? '', changed: !!r.versionId });
        break;
      }
      case 'night': {
        nights.push({ date: event.date, sleepMin: event.sleepMin });
        const r = await engine.run(userId, { kind: 'night', date: event.date, sleepMin: event.sleepMin }, opts);
        if (r.reply) replies.push({ message: `(a ${event.sleepMin}-minute night)`, reply: r.reply, changed: !!r.versionId });
        break;
      }
      case 'decision-answer': {
        const open = (await deps.store.decisions(userId)).filter((d) => d.stackItemId === event.stackItemId && d.status === 'proposed');
        const d = open.find((x) => x.kind === 'clear') ?? open[0];
        if (!d) {
          notes.push(`${event.answer} to ${event.stackItemId}, which had no open proposal`);
          break;
        }
        // The app records a let-go or a "mine" on their list, then tells the engine.
        if (event.answer === 'yes' && d.kind === 'clear' && d.reason !== 'UNLOVED_HABIT')
          progress = { ...progress, items: progress.items.map((i) => (i.id === d.stackItemId ? { ...i, status: 'cut' } : i)) };
        if (event.answer === 'theirs')
          progress = { ...progress, items: progress.items.map((i) => (i.id === d.stackItemId ? { ...i, status: 'kept' } : i)) };
        await engine.run(userId, { kind: 'decision-answer', decisionId: d.id, answer: event.answer }, opts);
        break;
      }
    }
  }

  const final = await engine.state(userId, opts);
  const ownLabels = new Set(
    person.progress.items.flatMap((i) => [i.customName, i.label]).filter((x): x is string => !!x).map((x) => x.toLowerCase()),
  );
  const decisions = await deps.store.decisions(userId);
  const versions = await deps.store.versions(userId);
  const usage = await deps.store.usage(userId, '2000-01-01T00:00:00Z');
  const seen: Seen[] = [
    ...decisions.map((d) => ({ where: 'decision' as const, text: d.line })),
    ...(await deps.store.messages(userId, 200)).filter((m) => m.role === 'companion').map((m) => ({ where: 'reply' as const, text: m.text })),
    ...versions.flatMap((v) =>
      v.parts.flatMap((p) => [
        { where: 'part' as const, text: p.title, own: ownLabels.has(p.title.toLowerCase()) },
        { where: 'part' as const, text: p.why },
      ]),
    ),
    ...(final.ritual.summary ? [{ where: 'summary' as const, text: final.ritual.summary }] : []),
  ].filter((s) => s.text);
  return {
    person,
    userId,
    decisions,
    versions,
    final,
    seen,
    replies,
    notes,
    calls: usage.calls,
    costUsd: usage.costUsd,
  };
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** A phrase as whole words, so "died" never matches "studied". */
export const saysPhrase = (text: string, phrase: string) =>
  new RegExp(`(?<![\\p{L}\\d])${escape(phrase)}(?![\\p{L}\\d])`, 'iu').test(text);

/**
 * The hard gates. Any failure blocks a change: these are the promises Distill makes to people,
 * and none of them depends on Claude.
 */
export function gates(t: Transcript): string[] {
  const p = t.person;
  const fails: string[] = [];
  const clears = t.decisions.filter((d) => d.kind === 'clear' && d.stackItemId);
  const items = new Map(p.progress.items.map((i) => [i.id, i]));
  for (const d of clears) {
    if (p.expect.keep.includes(d.stackItemId!)) fails.push(`proposed clearing ${d.stackItemId}, which must be kept (${d.reason})`);
    else if (!p.expect.clearAllowed.includes(d.stackItemId!)) fails.push(`proposed clearing ${d.stackItemId}, which isn't one to let go (${d.reason})`);
  }
  // From a clinician: outside the edit. No proposals of any kind, and its parts never change.
  const clinician = p.progress.items.filter((i) => i.origin === 'doctor' || i.origin === 'blood test').map((i) => i.id);
  for (const d of t.decisions)
    if (d.stackItemId && clinician.includes(d.stackItemId) && d.kind !== 'keep')
      fails.push(`a ${d.kind} proposal on ${d.stackItemId}, which is from a clinician`);
  // Parts that are theirs or a clinician's come through every engine change exactly as they were.
  const byId = new Map(t.versions.map((v) => [v.id, v]));
  for (const v of t.versions) {
    if (v.cause.trigger === 'edit' || !v.parentId) continue;
    const parent = byId.get(v.parentId);
    if (!parent) continue;
    if (v.scope.kind === 'day') {
      const locked = new Set(parent.parts.filter((x) => x.lock).map((x) => x.id));
      for (const op of v.ops) if ('partId' in op && locked.has(op.partId)) fails.push(`a day change touched ${op.partId}, which is locked`);
      continue;
    }
    for (const before of parent.parts.filter((x) => x.lock && x.status === 'active')) {
      const after = v.parts.find((x) => x.id === before.id);
      // A part leaves only when the thing it stands for left their list.
      const left = before.source.kind === 'stack' && items.get(before.source.stackItemId) && t.final.items[before.source.stackItemId] === undefined;
      if (!after && !left) fails.push(`"${before.title}" (locked) disappeared in version ${v.version}`);
      else if (after && !samePart(before, after) && !left) fails.push(`"${before.title}" (locked) changed in version ${v.version}`);
    }
  }
  for (const phrase of p.expect.neverSay)
    for (const s of t.seen)
      if (!s.own && saysPhrase(s.text, phrase)) fails.push(`said "${phrase}" in a ${s.where}: ${s.text.slice(0, 120)}`);
  const base = t.versions.filter((v) => v.scope.kind === 'base' && v.status === 'accepted').at(-1);
  if (base) {
    const errors = validateRitual({
      parts: base.parts.filter((x) => x.status === 'active'),
      allowed: {
        words: '',
        stackItemIds: new Set(p.progress.items.map((i) => i.id)),
        ideaIds: new Set(),
        peopleIds: new Set(),
        productNames: [],
      },
      perMoment: MAX_PER_MOMENT,
    }).filter((e) => !/quote|their words/i.test(e));
    for (const e of errors) fails.push(`the Ritual: ${e}`);
  }
  return fails;
}

const samePart = (a: RitualPart, b: RitualPart) =>
  a.title === b.title && a.status === b.status && JSON.stringify(a.when) === JSON.stringify(b.when) && a.minutes === b.minutes;

/** How close to a careful friend it came, beyond the gates: what it found, and whom it named. */
export function scores(t: Transcript) {
  const p = t.person;
  const proposed = new Set(t.decisions.filter((d) => d.kind === 'clear' && d.stackItemId).map((d) => d.stackItemId!));
  const referred = new Set(t.decisions.filter((d) => d.kind === 'refer' && d.stackItemId).map((d) => d.stackItemId!));
  const found = p.expect.clearExpected.filter((id) => proposed.has(id));
  const all = t.seen.map((s) => s.text).join('\n');
  return {
    clearRecall: p.expect.clearExpected.length ? found.length / p.expect.clearExpected.length : 1,
    missedClears: p.expect.clearExpected.filter((id) => !proposed.has(id)),
    referRecall: p.expect.refer.length ? p.expect.refer.filter((id) => referred.has(id)).length / p.expect.refer.length : 1,
    mentioned: p.expect.mustMention.filter((m) => saysPhrase(all, m)),
    missingMentions: p.expect.mustMention.filter((m) => !saysPhrase(all, m)),
  };
}
