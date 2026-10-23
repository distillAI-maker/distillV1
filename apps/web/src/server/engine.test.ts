import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as schema from '../../../../packages/data/src/schema';
import type { Database } from '@distill/data';
import { checkLine, DAY_ONE_PER_MOMENT } from '@distill/engine/ritual';
import { catalogView, v3 } from '../../../../packages/engine/src/ritual/test-support';
import type { ClaudeClient } from '../../lib/ai/engine/call';
import { CRISIS_REPLY, REPLY_FALLBACK } from '../../lib/ai/engine/reply';
import { emptyProgress, type Progress, type StackItem } from '../../lib/progress/types';
import { CAPS, Engine, FIXED_LINES, matchItem, previewCompose, previewEngine, type EngineDeps } from './engine';
import { EngineStore } from './engine-store';
import { engineRoute } from './engine-routes';
import { nightsFor } from './engine-deps';

const alice = '20000000-0000-4000-8000-000000000001';
let pg: PGlite, store: EngineStore;
let clock = new Date('2026-10-21T19:00:00Z'); // noon in Los Angeles, a Wednesday
let progress: Progress;
let nights: { date: string; sleepMin?: number }[] = [];

beforeAll(async () => {
  pg = new PGlite();
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
  store = new EngineStore(drizzle(pg, { schema }) as unknown as Database);
}, 30000);
beforeEach(async () => {
  await pg.exec(`reset role; delete from auth.users; insert into auth.users values ('${alice}');`);
  clock = new Date('2026-10-21T19:00:00Z');
  progress = jake();
  nights = [];
});
afterAll(async () => {
  await pg?.close();
});

function item(id: string, itemKey: string, over: Partial<StackItem> = {}): StackItem {
  return {
    id,
    itemKey,
    monthlyCost: catalogView.item(itemKey)?.costMonthUsd ?? 10,
    answers: {},
    chips: {},
    unknown: [],
    status: 'listed',
    notes: [],
    position: 0,
    ...over,
  };
}
function jake(): Progress {
  return {
    ...emptyProgress(),
    step: 'done',
    name: 'Jake',
    lifeText: 'Up at 6 for a run along the Hudson, deep work until lunch, dinner with Sam. Slow Saturday mornings.',
    goals: ['sleep (general)'],
    items: [
      item('ag1', 'greens-powder-ag1-etc', { origin: 'online', position: 0 }),
      item('cr', 'creatine-monohydrate', { answers: { dose: 5, doseUnit: 'g' }, position: 1 }),
      item('sun', 'sunscreen-daily-spf-30', { position: 2 }),
      item('mel', 'melatonin', { position: 3 }),
    ],
  };
}

/** A stand-in for the SDK: answers from a script, in order, and records what was asked. */
function fakeClient() {
  const answers: unknown[] = [];
  const requests: { model: string }[] = [];
  const reply = async (body: never) => {
    const b = body as { model: string };
    requests.push(b);
    if (!answers.length) throw new Error('nothing scripted');
    return {
      content: [{ type: 'text', text: JSON.stringify(answers.shift()) }],
      stop_reason: 'end_turn',
      model: b.model,
      usage: { input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    };
  };
  const client: ClaudeClient = { messages: { create: reply }, beta: { messages: { create: reply } } };
  return { client, answers, requests };
}

function engine(client: ClaudeClient | null = null) {
  const deps: EngineDeps = {
    store,
    loadProgress: async () => progress,
    loadNights: async () => nights,
    client,
    catalog: catalogView,
    toneRules: v3.toneRules,
    bank: { version: 1, ideas: [] },
    now: () => clock,
  };
  return new Engine(deps);
}

/** Onboarding with Claude off, then "This is my Ritual". */
async function settled() {
  const e = engine();
  const first = await e.run(alice, { kind: 'onboarding' });
  return e.accept(alice, first.versionId!);
}

const tonight = {
  intent: 'plan',
  trigger: {
    kind: 'message',
    when: { phrase: 'tonight', start: { kind: 'tonight' }, end: null },
    dates: ['2026-10-21'],
    moments: ['night'],
    durability: 'once',
    load: 'lighter',
    mentions: { people: [], places: [] },
  },
  season: null,
  safety: 'ok',
  condition: null,
  stack: null,
};

describe('the first Ritual', () => {
  it('is composed by rules when Claude is off, waits for their yes, and stays small on day one', async () => {
    const e = engine();
    const first = await e.run(alice, { kind: 'onboarding' });
    expect(first.state.ritual.status).toBe('proposed');
    const proposed = first.state.ritual.proposed!;
    expect(proposed.parts.length).toBeGreaterThan(0);
    for (const day of ['mon', 'sat'] as const)
      for (const slot of ['morning', 'night'] as const)
        expect(proposed.parts.filter((p) => p.when.slot === slot && p.when.days.includes(day)).length).toBeLessThanOrEqual(DAY_ONE_PER_MOMENT);
    expect(first.state.ritual.today.parts).toEqual([]);
    const ag1 = first.state.decisions.find((d) => d.stackItemId === 'ag1')!;
    expect(`${ag1.kind}:${ag1.reason}`).toBe('clear:BORROWED_WEAK');
    expect(checkLine(ag1.line, { toneRules: v3.toneRules, allowedNumbers: ['99'], names: ['AG1', 'Jake'], maxWords: 40 })).toEqual([]);
    const accepted = await e.accept(alice, first.versionId!);
    expect(accepted.state.ritual.status).toBe('accepted');
    expect(accepted.state.ritual.today.parts.length).toBeGreaterThan(0);
    await expect(e.undo(alice, first.versionId!)).rejects.toThrow();
  });
  it('logs today’s one thing once a day, with the chance it had of being drawn', async () => {
    const e = engine();
    await settled();
    const a = await e.state(alice);
    const b = await e.state(alice);
    expect(b.today).toEqual(a.today);
    const shown = await store.events(alice, ['today.shown'], '2000-01-01T00:00:00Z');
    expect(shown).toHaveLength(1);
    expect(shown[0]!.payload.propensity).toBeGreaterThan(0);
  });
  it('stays the same proposal while it waits, brought up to date when their list changes', async () => {
    const e = engine();
    const first = await e.run(alice, { kind: 'onboarding' });
    const creatine = first.state.ritual.proposed!.parts.find((p) => p.source.kind === 'stack' && p.source.stackItemId === 'cr');
    progress = { ...progress, items: progress.items.map((i) => (i.id === 'cr' ? { ...i, status: 'cut' } : i)) };
    const second = await e.run(alice, { kind: 'stack-change' });
    expect(second.state.ritual.status).toBe('proposed');
    if (creatine) expect(second.state.ritual.proposed!.parts.find((p) => p.id === creatine.id)!.status).toBe('removed');
    expect((await store.versions(alice)).filter((v) => v.status === 'proposed')).toHaveLength(1);
  });
});

describe('a message', () => {
  it('about tonight lightens tomorrow morning, says only what it did, and can be undone', async () => {
    await settled();
    const { client, answers, requests } = fakeClient();
    const e = engine(client);
    const before = await e.state(alice);
    const target = before.ritual.week[1]!.parts.find((p) => p.moment === 'morning' && !p.lock)!;
    expect(target).toBeDefined();
    const said = 'Have a great night out. Your morning starts later, at 9:30.';
    answers.push(tonight, { ops: [] }, { reply: said, ops: [{ op: 'move', partId: target.id, at: '09:30' }], ongoing: false, ask: null });
    const r = await e.run(alice, { kind: 'message', text: 'out late with the team tonight' });
    expect(requests.map((q) => q.model)).toEqual(['claude-haiku-5-5', 'claude-opus-5-5', 'claude-opus-5-5']);
    expect(r.reply).toBe(said);
    const tomorrow = r.state.ritual.week[1]!;
    expect(tomorrow.changed).toBe(true);
    expect(tomorrow.parts.find((p) => p.id === target.id)!.when.at).toBe('09:30');
    expect(r.state.ritual.today.changed).toBe(false);
    expect(r.state.ritual.lastChange).toMatchObject({ versionId: r.versionId, scope: 'day', undoable: true });
    expect(r.state.thread.map((m) => m.role)).toEqual(['person', 'companion']);
    const undone = await e.undo(alice, r.versionId!);
    expect(undone.state.ritual.week[1]!.changed).toBe(false);
    const calls = await store.events(alice, ['llm.call'], '2000-01-01T00:00:00Z');
    expect(calls.map((c) => c.payload.step)).toEqual(['classify', 'update-person', 'reshape']);
    // The log keeps the shape of what they said, never the words.
    const logged = await store.events(alice, ['event.message'], '2000-01-01T00:00:00Z');
    expect(JSON.stringify(logged)).not.toMatch(/team/);
  });
  it('from someone who may be in danger gets the fixed reply and a person, never a reshape', async () => {
    await settled();
    const { client, answers } = fakeClient();
    answers.push({ ...tonight, intent: 'feeling', trigger: null });
    const versions = (await store.versions(alice)).length;
    const r = await engine(client).run(alice, { kind: 'message', text: "honestly I don't want to be alive some days" });
    expect(r.reply).toBe(CRISIS_REPLY);
    expect(await store.events(alice, ['safety.crisis'], '2000-01-01T00:00:00Z')).toHaveLength(1);
    expect(await store.versions(alice)).toHaveLength(versions);
  });
  it('past the day’s cap, Claude is not called and the rules answer', async () => {
    await settled();
    for (let i = 0; i < CAPS.callsPerDay; i++) await store.log({ userId: alice, kind: 'llm.call', payload: { step: 'classify' } });
    const { client, answers, requests } = fakeClient();
    answers.push(tonight);
    const r = await engine(client).run(alice, { kind: 'message', text: 'out late with the team tonight' });
    expect(requests).toHaveLength(0);
    expect(r.reply).toBe(REPLY_FALLBACK);
  });
  it('before they say yes to a Ritual changes nothing and says so', async () => {
    await engine().run(alice, { kind: 'onboarding' });
    const { client, answers } = fakeClient();
    answers.push(tonight, { ops: [] });
    const r = await engine(client).run(alice, { kind: 'message', text: 'out late with the team tonight' });
    expect(r.reply).toBe(FIXED_LINES.noRitualYet);
  });
});

describe('their own edits and answers', () => {
  it('an edit applies at once with no model, for today on, and never rewrites a past day', async () => {
    const settledState = (await settled()).state;
    const e = engine();
    const part = settledState.ritual.today.parts.find((p) => !p.lock)!;
    const r = await e.run(alice, { kind: 'edit', scope: 'base', ops: [{ op: 'move', partId: part.id, at: '07:10' }] });
    expect(r.state.ritual.today.parts.find((p) => p.id === part.id)!.when.at).toBe('07:10');
    expect(r.state.ritual.lastChange).toMatchObject({ scope: 'base', undoable: true });
    await expect(e.run(alice, { kind: 'edit', scope: 'day', date: '2026-10-20', ops: [{ op: 'skip', partId: part.id }] })).rejects.toThrow(/past/);
  });
  it('a yes to a clear counts the money, and is not asked again', async () => {
    const s = (await settled()).state;
    const e = engine();
    const ag1 = s.decisions.find((d) => d.stackItemId === 'ag1' && d.kind === 'clear')!;
    const r = await e.run(alice, { kind: 'decision-answer', decisionId: ag1.id, answer: 'yes' });
    expect(r.state.money.back).toBe(ag1.money);
    expect(r.state.decisions.filter((d) => d.stackItemId === 'ag1' && d.status === 'proposed')).toEqual([]);
    await expect(e.run(alice, { kind: 'decision-answer', decisionId: ag1.id, answer: 'yes' })).rejects.toThrow();
  });
  it('“this is mine” makes it theirs for good, and its part is locked', async () => {
    const s = (await settled()).state;
    const e = engine();
    const ag1 = s.decisions.find((d) => d.stackItemId === 'ag1' && d.kind === 'clear')!;
    const r = await e.run(alice, { kind: 'decision-answer', decisionId: ag1.id, answer: 'theirs' });
    expect(r.state.decisions.find((d) => d.stackItemId === 'ag1' && d.status === 'proposed')?.reason ?? 'THEIRS').toBe('THEIRS');
    expect((await store.person(alice))!.values.ag1!.attachment).toBe('theirs');
    for (const p of r.state.ritual.week.flatMap((d) => d.parts))
      if (p.source.kind === 'stack' && p.source.stackItemId === 'ag1') expect(p.lock).toBe('theirs');
  });
  it('a part they let go leaves the week from today; earlier days keep it', async () => {
    const s = (await settled()).state;
    const e = engine();
    const creatine = s.ritual.today.parts.find((p) => p.source.kind === 'stack' && p.source.stackItemId === 'cr');
    if (!creatine) return;
    clock = new Date('2026-10-23T19:00:00Z');
    progress = { ...progress, items: progress.items.map((i) => (i.id === 'cr' ? { ...i, status: 'cut' } : i)) };
    const r = await e.run(alice, { kind: 'stack-change' });
    expect(r.state.ritual.today.parts.some((p) => p.id === creatine.id)).toBe(false);
    const versions = await store.versions(alice);
    const { ritualOn } = await import('@distill/engine/ritual');
    expect(ritualOn(versions, '2026-10-22').parts.some((p) => p.id === creatine.id)).toBe(true);
  });
});

describe('triggers from their data', () => {
  it('three days of skipped mornings offer a lighter morning, which waits for their yes', async () => {
    await settled();
    const { client, answers } = fakeClient();
    const e = engine(client);
    clock = new Date('2026-10-24T19:00:00Z'); // a Saturday; Wednesday to Friday had mornings
    const versions = await store.versions(alice);
    const { ritualOn, partsInMoment } = await import('@distill/engine/ritual');
    const mornings = (date: string) => partsInMoment(ritualOn(versions, date).parts, date, 'morning');
    const target = mornings('2026-10-26').find((p) => !p.lock)!;
    answers.push({
      reply: 'Mornings have been full lately. I can start them a little later, at 8:30, if you want that.',
      ops: [{ op: 'move', partId: target.id, at: '08:30' }],
      ongoing: true,
      ask: null,
    });
    let last;
    for (const date of ['2026-10-21', '2026-10-22', '2026-10-23'])
      for (const p of mornings(date)) last = await e.run(alice, { kind: 'part', partId: p.id, date, done: false });
    expect(last!.reply).toMatch(/8:30/);
    expect(last!.state.ritual.proposed).toMatchObject({ status: 'proposed', cause: { trigger: 'slip' } });
    const accepted = await e.accept(alice, last!.state.ritual.proposed!.id);
    expect(accepted.state.ritual.week[1]!.parts.find((p) => p.id === target.id)!.when.at).toBe('08:30');
    // Silence never counts: a part nobody ticked is not a slip.
    expect(await store.events(alice, ['ritual.reshaped'], '2000-01-01T00:00:00Z')).toHaveLength(1);
  });
  it('a short night shapes the morning only for people who turned it on', async () => {
    clock = new Date('2026-10-21T14:00:00Z'); // 7am in Los Angeles
    const s = (await settled()).state;
    nights = Array.from({ length: 20 }, (_, i) => ({ date: `2026-10-${String(1 + i).padStart(2, '0')}`, sleepMin: 420 + (i % 3) * 10 }));
    const { client, answers, requests } = fakeClient();
    const e = engine(client);
    const off = await e.run(alice, { kind: 'night', date: '2026-10-21', sleepMin: 300 });
    expect(off.reply).toBeUndefined();
    expect(requests).toHaveLength(0);
    expect((await e.setNightsShapeMornings(alice, true)).state.person.nightsShapeMornings).toBe(true);
    const target = s.ritual.today.parts.find((p) => p.moment === 'morning' && !p.lock)!;
    const said = 'Short night, so your morning starts later, at 9:30.';
    answers.push({ reply: said, ops: [{ op: 'move', partId: target.id, at: '09:30' }], ongoing: false, ask: null });
    const on = await e.run(alice, { kind: 'night', date: '2026-10-21', sleepMin: 300 });
    expect(on.reply).toBe(said);
    expect(on.state.ritual.today.parts.find((p) => p.id === target.id)!.when.at).toBe('09:30');
    // At most once every few days, however short the next night is.
    const again = await e.run(alice, { kind: 'night', date: '2026-10-21', sleepMin: 280 });
    expect(again.reply).toBeUndefined();
    expect(requests).toHaveLength(1);
  });
  it('rejects a check-off for a part that is not in that day, or a day too far back', async () => {
    const s = (await settled()).state;
    const e = engine();
    await expect(e.run(alice, { kind: 'part', partId: 'part:nope', date: '2026-10-21', done: true })).rejects.toThrow(/no_such_part/);
    await expect(e.run(alice, { kind: 'part', partId: s.ritual.today.parts[0]!.id, date: '2026-10-01', done: true })).rejects.toThrow(/range/);
    const done = await e.run(alice, { kind: 'part', partId: s.ritual.today.parts[0]!.id, date: '2026-10-21', done: true });
    expect(done.state.ritual.today.parts[0]!.check).toBe('done');
  });
});

describe('helpers', () => {
  it('every fixed line passes the same checks Claude’s lines must pass', () => {
    for (const line of Object.values(FIXED_LINES))
      expect(checkLine(line, { toneRules: v3.toneRules, allowedNumbers: [], names: [], maxWords: 50 }), line).toEqual([]);
  });
  it('finds the thing a message names, not everything with "the" in it', () => {
    expect(matchItem(progress, catalogView, 'the AG1')).toBe('ag1');
    expect(matchItem(progress, catalogView, 'creatine')).toBe('cr');
    expect(matchItem(progress, catalogView, 'the')).toBeUndefined();
  });
  it('the signed-out preview runs the same rules and stores nothing', async () => {
    const before = (await store.versions(alice)).length;
    const p = previewEngine(progress, { catalog: catalogView, now: clock });
    expect(p.parts.length).toBeGreaterThan(0);
    expect(p.decisions.find((d) => d.stackItemId === 'ag1')!.line.length).toBeGreaterThan(0);
    expect(await store.versions(alice)).toHaveLength(before);
  });
  it('the signed-out reveal takes Claude’s shaping with a client, stores nothing, and is null without one', async () => {
    const deps = { catalog: catalogView, toneRules: v3.toneRules, now: clock };
    expect(await previewCompose(progress, { ...deps, client: null })).toBeNull();
    const rules = previewEngine(progress, { catalog: catalogView, now: clock });
    const creatine = rules.parts.find((p) => p.source.kind === 'stack' && p.source.stackItemId === 'cr')!;
    expect(creatine).toBeDefined();
    const { client, answers } = fakeClient();
    answers.push({
      parts: [{ id: creatine.id, title: 'Creatine with breakfast', why: null, at: null, days: null }],
      additions: [],
      summary: 'Your mornings and nights, built around what you keep.',
    });
    const before = (await store.versions(alice)).length;
    const shaped = await previewCompose(progress, { ...deps, client });
    expect(shaped!.from).toBe('claude');
    expect(shaped!.parts.find((p) => p.id === creatine.id)!.title).toBe('Creatine with breakfast');
    expect(await store.versions(alice)).toHaveLength(before);
  });
});

describe('the API', () => {
  it('takes the person from the session only, and refuses anything else in a body', async () => {
    const e = engine();
    await expect(engineRoute(e, 'run', 'POST', { event: { kind: 'onboarding', userId: 'someone-else' } }, alice, null)).rejects.toThrow();
    await expect(engineRoute(e, 'message', 'POST', { text: 'x'.repeat(2001) }, alice, null)).rejects.toThrow();
    await expect(engineRoute(e, 'nope', 'POST', {}, alice, null)).rejects.toThrow(/not_found/);
    const r = (await engineRoute(e, 'run', 'POST', { event: { kind: 'onboarding' } }, alice, 'America/New_York')) as { state: { ritual: { status: string } } };
    expect(r.state.ritual.status).toBe('proposed');
    expect((await store.person(alice))!.timeZone).toBe('America/New_York');
  });
  it('checks last night once when the app opens, and never an old night', async () => {
    await settled();
    const e = engine();
    nights = Array.from({ length: 18 }, (_, i) => ({ date: `2026-10-${String(1 + i).padStart(2, '0')}`, sleepMin: 430 }));
    expect(await e.checkNight(alice)).toBeNull(); // the newest is three nights ago
    nights = [...nights, { date: '2026-10-21', sleepMin: 300 }];
    expect(await e.checkNight(alice)).not.toBeNull();
    expect(await e.checkNight(alice)).toBeNull();
    expect(await store.events(alice, ['night.checked'], '2000-01-01T00:00:00Z')).toHaveLength(1);
  });
  it('reads the demo person’s nights from the synthetic generator', async () => {
    const demo = await nightsFor(null as never, alice, { ...progress, dataSource: 'demo' }, '2026-10-21');
    expect(demo.length).toBeGreaterThanOrEqual(28);
    expect(demo.every((n) => n.date <= '2026-10-22')).toBe(true);
    expect(await nightsFor(null as never, alice, progress, '2026-10-21')).toEqual([]);
  });
});
