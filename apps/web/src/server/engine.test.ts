import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { vi } from 'vitest';
import * as schema from '../../../../packages/data/src/schema';
import type { Database } from '@distill/data';
import { checkLine, DAY_ONE_PER_MOMENT, type ExploreBank, type RitualPart } from '@distill/engine/ritual';
import { catalogView, v3 } from '../../../../packages/engine/src/ritual/test-support';
import type { ClaudeClient } from '../../lib/ai/engine/call';
import { CRISIS_REPLY, REPLY_FALLBACK } from '../../lib/ai/engine/reply';
import { emptyProgress, firstRitualList, progressSchema, type Progress, type StackItem } from '../../lib/progress/types';
import realRitual from './__fixtures__/real-first-ritual.json';
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

function engine(client: ClaudeClient | null = null, over: Partial<EngineDeps> = {}) {
  const deps: EngineDeps = {
    store,
    loadProgress: async () => progress,
    loadNights: async () => nights,
    client,
    catalog: catalogView,
    toneRules: v3.toneRules,
    bank: { version: 1, ideas: [] },
    now: () => clock,
    ...over,
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
  it('rests a question they answered “Not sure”, and changes nothing they told us', async () => {
    // AG1 with no origin: "where did it come from?" decides whether to suggest letting it go.
    progress = { ...progress, items: progress.items.map((i) => (i.id === 'ag1' ? { ...i, origin: undefined } : i)) };
    const e = engine();
    await settled();
    await e.state(alice);
    const candidates = async () =>
      ((await store.events(alice, ['today.shown'], '2000-01-01T00:00:00Z')).at(-1)!.payload.candidates as { id: string }[]).map((c) => c.id);
    expect(await candidates()).toContain('question:q:ag1:origin');
    await e.run(alice, { kind: 'question-answer', questionId: 'q:ag1:origin', label: 'Not sure' });
    expect(progress.items.find((i) => i.id === 'ag1')!.origin).toBeUndefined();
    clock = new Date('2026-10-22T19:00:00Z');
    await e.state(alice);
    expect(await candidates()).not.toContain('question:q:ag1:origin');
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

describe('Explore', () => {
  /** Stands in for a real search: the page it returned, then Claude's answer. */
  const searching = (events: unknown[]) => {
    const create = vi.fn(async () => ({
      content: [
        { type: 'web_search_tool_result', content: [{ type: 'web_search_result', url: 'https://race.example/half', title: 't', encrypted_content: 'x' }] },
        { type: 'text', text: JSON.stringify({ events }) },
      ],
      stop_reason: 'end_turn',
      model: 'claude-sonnet-5-5',
      usage: { input_tokens: 1000, output_tokens: 200, server_tool_use: { web_search_requests: 1 } },
    }));
    return { client: { messages: { create }, beta: { messages: { create } } } as unknown as ClaudeClient, create };
  };
  const race = (date: string) => ({ thread: 'running', kind: 'race', title: 'Hudson Half', date, when: null, where: 'New York', url: 'https://race.example/half', why: 'Your Hudson run, with a finish line.' });

  it('looks once a week, and what they say yes to goes on that day and counts as a goal', async () => {
    await settled();
    const before = await engine().state(alice);
    expect(before.explore).toMatchObject({ available: false, events: [], going: [] });
    const date = before.ritual.week[3]!.date;
    const { client, create } = searching([race(date)]);
    const found = await engine(client).exploreFeed(alice, 'New York');
    expect(create).toHaveBeenCalledTimes(1);
    expect(found.state.explore).toMatchObject({ region: 'New York', fresh: true, available: true });
    const event = found.state.explore.events[0]!;
    expect(event.title).toBe('Hudson Half');
    // The same week, the same place: nothing to pay for.
    await engine(client).exploreFeed(alice, 'New York');
    expect(create).toHaveBeenCalledTimes(1);

    const yes = await engine().exploreGo(alice, event.id, 'in');
    expect(yes.state.explore.events).toEqual([]);
    expect(yes.state.explore.going).toEqual([expect.objectContaining({ title: 'Hudson Half', past: false })]);
    expect(yes.state.ritual.week[3]!.parts.map((p) => p.title)).toContain('Hudson Half');
    expect(yes.state.knows).toContainEqual(expect.objectContaining({ group: 'toward', text: 'Hudson Half' }));
    const how = await engine().exploreGo(alice, event.id, 'loved');
    expect(how.state.explore.going).toEqual([]);
  });
  it('never shows again what they said no to, and tells the search to skip it', async () => {
    await settled();
    const date = (await engine().state(alice)).ritual.week[3]!.date;
    const { client, create } = searching([race(date)]);
    const found = await engine(client).exploreFeed(alice, 'New York');
    const no = await engine().exploreGo(alice, found.state.explore.events[0]!.id, 'no');
    expect(no.state.explore.events).toEqual([]);
    await engine(client).exploreFeed(alice, 'Boston');
    expect(create).toHaveBeenCalledTimes(2);
    expect(JSON.stringify((create.mock.calls as unknown[][])[1]![0])).toContain('<skip>Hudson Half</skip>');
  });
  it('never runs two searches at once', async () => {
    await settled();
    const { client, create } = searching([]);
    // The log stamps real time, so the engine's clock has to be on real time here.
    clock = new Date();
    await store.log({ userId: alice, kind: 'explore.search', payload: { region: 'New York' } });
    await engine(client).exploreFeed(alice, 'New York');
    expect(create).not.toHaveBeenCalled();
    clock = new Date(clock.getTime() + 4 * 60_000);
    await engine(client).exploreFeed(alice, 'New York');
    expect(create).toHaveBeenCalledTimes(1);
  });
  it('spends nothing with Claude off, or with the search switched off', async () => {
    await settled();
    expect((await engine().exploreFeed(alice, 'New York')).state.explore.events).toEqual([]);
    vi.stubEnv('ENGINE_EXPLORE_SEARCH', 'off');
    const { client, create } = searching([]);
    await engine(client).exploreFeed(alice, 'New York');
    expect(create).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });
});

describe('the Ritual they said yes to', () => {
  const allDays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
  /** What the reveal keeps: the same parts as the rules, in Claude's words, with the anchors added. */
  const kept = (): RitualPart[] => [
    { id: 'part:wake', when: { slot: 'morning', days: [...allDays], at: '07:00' }, order: 0, title: 'Up at 7:00', area: 'sleep', why: 'Claude wrote this.', source: { kind: 'engine', rule: 'wake' }, status: 'active', lock: null },
    ...previewEngine(jake(), { catalog: catalogView, now: clock }).parts.map((p, i) => ({ ...p, order: i + 1, title: `${p.title}, your way`, why: `Claude on ${p.title}.`, when: { ...p.when, days: [...allDays] } })),
    { id: 'part:friends', when: { slot: 'evening', days: [], perWeek: 1 }, order: 50, title: 'Time with friends', area: 'mind', why: 'You asked for this.', source: { kind: 'engine', rule: 'room' }, status: 'active', lock: null },
  ];
  const saidYes = (over: Partial<Progress> = {}, parts: RitualPart[] = kept()) => {
    progress = { ...jake(), step: 'done', ...over };
    progress = { ...progress, firstRitual: { list: firstRitualList(progress), parts } };
  };
  const steps = async () => (await store.events(alice, ['llm.call'], '2000-01-01T00:00:00Z')).map((c) => c.payload.step);

  it('is the one in their account, whole, with no second compose', async () => {
    saidYes();
    const { client } = fakeClient();
    const e = engine(client);
    const made = await e.run(alice, { kind: 'onboarding' });
    expect(made.state.ritual.proposed!.parts.map((p) => p.title)).toEqual(kept().map((p) => p.title));
    expect(await steps()).not.toContain('compose');
    expect((await store.events(alice, ['ritual.composed'], '2000-01-01T00:00:00Z'))[0]!.payload.from).toBe('kept');
    const accepted = await e.accept(alice, made.state.ritual.proposed!.id);
    const today = accepted.state.ritual.today.parts;
    // Exactly what they read: nothing added, nothing renamed, every reason theirs.
    expect(today.map((p) => p.title).sort()).toEqual(kept().filter((p) => p.when.days.length).map((p) => p.title).sort());
    expect(today.find((p) => p.title === 'Up at 7:00')!.why).toBe('Claude wrote this.');
    expect(today.filter((p) => p.title !== 'Up at 7:00').every((p) => p.why.startsWith('Claude on '))).toBe(true);
    // Weekly things have no one day, and are still on the page.
    expect(accepted.state.ritual.anyDay.map((p) => p.title)).toEqual(['Time with friends']);
  });
  it('reads what their words teach afterward, once, without holding anything up', async () => {
    progress = { ...jake(), step: 'done' };
    saidYes({ lifeText: 'Mónica fixes my back on Thursdays' });
    const { client, answers } = fakeClient();
    const e = engine(client);
    const made = await e.run(alice, { kind: 'onboarding' });
    await e.accept(alice, made.state.ritual.proposed!.id);
    expect(await steps()).not.toContain('update-person');
    expect((await e.state(alice)).person.readDone).toBe(false);
    answers.length = 0;
    answers.push({ ops: [{ op: 'person', name: 'Mónica', relation: null, what: 'fixes your back on Thursdays', quote: 'Mónica fixes my back' }] });
    const read = await e.readLater(alice);
    expect(read.state.person.readDone).toBe(true);
    expect(read.state.knows.map((f) => f.text)).toContain('Mónica: fixes your back on Thursdays');
    const after = (await steps()).filter((s) => s === 'update-person').length;
    await e.readLater(alice);
    expect((await steps()).filter((s) => s === 'update-person')).toHaveLength(after);
  });
  it('gives way to a new Ritual when their list has changed since', async () => {
    saidYes();
    progress = { ...progress, items: progress.items.filter((i) => i.id !== 'mel') };
    const made = await engine().run(alice, { kind: 'onboarding' });
    expect(made.state.ritual.proposed!.parts.map((p) => p.title)).not.toContain('Up at 7:00');
    expect((await store.events(alice, ['ritual.composed'], '2000-01-01T00:00:00Z'))[0]!.payload.from).not.toBe('kept');
  });
  it('is not used when it has lost something locked', async () => {
    saidYes({ dayOne: { ...emptyProgress().dayOne, yours: ['sun'] } }, kept().filter((p) => !(p.source.kind === 'stack' && p.source.stackItemId === 'sun')));
    const made = await engine().run(alice, { kind: 'onboarding' });
    expect(made.state.ritual.proposed!.parts.some((p) => p.source.kind === 'stack' && p.source.stackItemId === 'sun' && p.lock === 'theirs')).toBe(true);
    expect((await store.events(alice, ['ritual.composed'], '2000-01-01T00:00:00Z'))[0]!.payload.from).not.toBe('kept');
  });
  it('is not used when it is not a Ritual', async () => {
    saidYes({}, [{ nonsense: true } as unknown as RitualPart]);
    const made = await engine().run(alice, { kind: 'onboarding' });
    expect(made.state.ritual.proposed!.parts.length).toBeGreaterThan(0);
    expect(made.state.ritual.proposed!.parts.map((p) => p.id)).not.toContain('nonsense');
  });
  it('without one, the rules still say the Ritual in full: never a bare list', async () => {
    progress = {
      ...jake(),
      step: 'done',
      asks: [
        { q: 'What time are you usually up?', a: '06:30', at: 'x' },
        { q: 'What time are you usually in bed?', a: '22:30', at: 'x' },
      ],
    };
    const made = await engine().run(alice, { kind: 'onboarding' });
    const parts = made.state.ritual.proposed!.parts;
    expect(parts.map((p) => p.title)).toEqual(expect.arrayContaining(['Up at 6:30', 'In bed by 10:30 pm']));
    const creatine = parts.find((p) => p.source.kind === 'stack' && p.source.stackItemId === 'cr')!;
    expect(creatine.when.at).toBeDefined();
    expect(creatine.why).toMatch(/^For /);
  });
  it('a thin Ritual from before still says what a well-founded thing is for', async () => {
    progress = { ...jake(), step: 'done' };
    const made = await engine().run(alice, { kind: 'onboarding' });
    const thin = made.state.ritual.proposed!.parts.map((p) => (p.source.kind === 'stack' && p.source.stackItemId === 'cr' ? { ...p, why: "One of the well-founded things you do, even on days you can't feel it." } : p));
    await pg.exec(`update public.ritual_versions set parts = '${JSON.stringify(thin).replace(/'/g, "''")}'::jsonb where id = '${made.state.ritual.proposed!.id}'`);
    const accepted = await engine().accept(alice, made.state.ritual.proposed!.id);
    const creatine = accepted.state.ritual.today.parts.find((p) => p.source.kind === 'stack' && p.source.stackItemId === 'cr')!;
    expect(creatine.why).toMatch(/^For /);
  });
});

describe('a real first Ritual from Claude', () => {
  it('goes into the account exactly as they read it: same parts, same words, nothing added or lost', async () => {
    const saved = progressSchema.parse(realRitual.progress);
    progress = { ...saved, firstRitual: { list: firstRitualList(saved), parts: realRitual.parts } };
    const { client } = fakeClient();
    const e = engine(client);
    const made = await e.run(alice, { kind: 'onboarding' });
    expect((await store.events(alice, ['ritual.composed'], '2000-01-01T00:00:00Z'))[0]!.payload.from).toBe('kept');
    expect(made.state.ritual.proposed!.parts).toEqual(realRitual.parts);
    const accepted = await e.accept(alice, made.state.ritual.proposed!.id);
    const seen = [...accepted.state.ritual.week.flatMap((d) => d.parts), ...accepted.state.ritual.anyDay];
    const ids = new Set(seen.map((p) => p.id));
    expect([...ids].sort()).toEqual(realRitual.parts.map((p) => p.id).sort());
    // Their locked thing stays locked, and the Claude reasons are the ones on the page.
    expect(accepted.state.ritual.anyDay.find((p) => p.title === 'Strength training')!.lock).toBe('theirs');
    expect(seen.find((p) => p.title === 'Daily walk')!.why).toBe('Your daily walk once the desk is behind you, a stretch of the evening that stays yours.');
  });
  it('says what is going on with them, and a sleep-in moves the "Up at" that Claude wrote', async () => {
    const saved = progressSchema.parse(realRitual.progress);
    progress = { ...saved, firstRitual: { list: firstRitualList(saved), parts: realRitual.parts } };
    const e = engine();
    const made = await e.run(alice, { kind: 'onboarding' });
    await e.accept(alice, made.state.ritual.proposed!.id);
    clock = new Date('2026-10-27T01:00:00Z'); // A Monday evening in Los Angeles, with a desk morning next.
    const r = await e.run(alice, { kind: 'message', text: 'Out late tonight' });
    expect(r.reply).toBe("Okay, got it. Have a good night out. We'll update your Ritual by tomorrow.");
    const tomorrow = r.state.ritual.week[1]!.parts.map((p) => p.title);
    expect(tomorrow).toContain('Sleep in');
    expect(tomorrow).not.toContain('Up at 7:00');
    expect(r.state.ritual.week[0]!.parts.map((p) => p.title)).not.toContain('In bed by 23:00');
  });
});

describe('a thin Ritual from before', () => {
  it('is said in full once, when they next open the app, and is left alone after that', async () => {
    progress = {
      ...jake(),
      step: 'done',
      asks: [
        { q: 'What time are you usually up?', a: '07:00', at: 'x' },
        { q: 'What time are you usually in bed?', a: '23:00', at: 'x' },
      ],
    };
    const made = await engine().run(alice, { kind: 'onboarding' });
    const id = made.state.ritual.proposed!.id;
    await engine().accept(alice, id);
    // As it was saved before: no clock times, no anchors.
    const bare = made.state.ritual.proposed!.parts.filter((p) => p.source.kind === 'stack').map((p) => ({ ...p, when: { slot: p.when.slot, days: p.when.days, ...(p.when.perWeek ? { perWeek: p.when.perWeek } : {}) } }));
    await pg.exec(`update public.ritual_versions set parts = '${JSON.stringify(bare).replace(/'/g, "''")}'::jsonb where user_id = '${alice}'`);
    expect((await engine().state(alice)).ritual.today.parts.map((p) => p.title)).not.toContain('Up at 7:00');
    await engine().upgradeThinRitual(alice);
    const after = await engine().state(alice);
    expect(after.ritual.today.parts.map((p) => p.title)).toEqual(expect.arrayContaining(['Up at 7:00', 'In bed by 11:00 pm']));
    expect(after.ritual.lastChange?.undoable ?? false).toBe(false);
    await engine().upgradeThinRitual(alice);
    expect(await store.events(alice, ['ritual.upgraded'], '2000-01-01T00:00:00Z')).toHaveLength(1);
  });
  it('leaves a Ritual Claude shaped alone', async () => {
    await settled();
    await pg.exec(`update public.engine_events set payload = jsonb_set(payload, '{from}', '"claude"') where kind = 'ritual.composed' and user_id = '${alice}'`);
    await engine().upgradeThinRitual(alice);
    expect(await store.events(alice, ['ritual.upgraded'], '2000-01-01T00:00:00Z')).toHaveLength(0);
  });
});

describe('a place near them', () => {
  const idea: ExploreBank['ideas'][number] = {
    id: 'sf-dse-runners-sunday-races',
    title: 'Ten-dollar Sunday races with the DSE Runners',
    kind: 'community',
    area: 'move',
    city: 'San Francisco Bay Area',
    social: 'group',
    cost: 'low',
    when: 'Most Sundays at 9am',
    line: 'A club that just turned 60 puts on a cheap, low-key race nearly every weekend.',
    fitsWhen: 'They run',
    url: 'https://dserunners.com/race-schedule/',
    verifiedOn: '2026-10-20',
    partner: false,
    certified: false,
  };
  const bank = { version: 1 as const, ideas: [idea] };
  it('goes in their week when they say yes, and shows as something they are in for', async () => {
    await settled();
    const e = engine(null, { bank });
    const yes = await e.exploreGo(alice, 'idea:sf-dse-runners-sunday-races', 'in', { thread: 'running' });
    expect(yes.state.explore.going).toEqual([expect.objectContaining({ id: 'idea:sf-dse-runners-sunday-races', thread: 'running', title: idea.title, past: false })]);
    expect(yes.state.ritual.week.flatMap((d) => d.parts.map((p) => p.title))).toContain(idea.title);
    // Twice is still once.
    await e.exploreGo(alice, 'idea:sf-dse-runners-sunday-races', 'in', { thread: 'running' });
    const days = (await e.state(alice)).ritual.today;
    expect(days.parts.filter((p) => p.title === idea.title).length).toBeLessThanOrEqual(1);
    const over = await e.exploreGo(alice, 'idea:sf-dse-runners-sunday-races', 'not-really');
    expect(over.state.explore.going).toEqual([]);
  });
  it('answers 404 for a place that is not in the bank', async () => {
    await settled();
    await expect(engine(null, { bank }).exploreGo(alice, 'idea:nowhere', 'in')).rejects.toThrow(/no_such_event/);
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
    expect(requests.map((q) => q.model)).toEqual(['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-sonnet-5-5']);
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
    // No model to pay for, and still a real change behind what it says.
    expect(r.reply).toBe("Okay, got it. Have a good night out. We'll update your Ritual by tomorrow.");
    expect(r.versionId).toBeDefined();
    expect(r.state.ritual.week[1]!.changed).toBe(true);
  });
  it('remembers what they said about their body in What Distill knows, with or without Claude', async () => {
    await settled();
    const r = await engine().run(alice, { kind: 'message', text: 'I have injured my back' });
    expect(r.state.knows).toContainEqual(expect.objectContaining({ group: 'now', text: 'Your back is hurt' }));
    // A later visit reads it back, because it was saved.
    const later = await engine().state(alice);
    const fact = later.knows.find((f) => f.text === 'Your back is hurt')!;
    expect(fact.since).toBeDefined();
    // Taken out, it stays out.
    const gone = await engine().forget(alice, fact.id);
    expect(gone.state.knows.map((f) => f.text)).not.toContain('Your back is hurt');
    expect((await engine().state(alice)).knows.map((f) => f.text)).not.toContain('Your back is hurt');
  });
  it('out late tonight: tomorrow starts slow with no "Up at", tonight has no bedtime, and Undo takes it all back', async () => {
    progress = {
      ...jake(),
      step: 'done',
      asks: [
        { q: 'What time are you usually up?', a: '07:00', at: 'x' },
        { q: 'What time are you usually in bed?', a: '23:00', at: 'x' },
      ],
    };
    const e = engine();
    const made = await e.run(alice, { kind: 'onboarding' });
    await e.accept(alice, made.state.ritual.proposed!.id);
    const r = await e.run(alice, { kind: 'message', text: 'Out late tonight' });
    const titles = (d: number) => r.state.ritual.week[d]!.parts.map((p) => p.title);
    expect(titles(1)).toContain('Sleep in');
    expect(titles(1)).not.toContain('Up at 7:00');
    expect(titles(0)).not.toContain('In bed by 11:00 pm');
    expect(titles(1)).toContain('In bed by 11:00 pm');
    const undone = await e.undo(alice, r.versionId!);
    expect(undone.state.ritual.week[0]!.parts.map((p) => p.title)).toContain('In bed by 11:00 pm');
    expect(undone.state.ritual.week[1]!.parts.map((p) => p.title)).toContain('Up at 7:00');
    expect(undone.state.ritual.week[1]!.parts.map((p) => p.title)).not.toContain('Sleep in');
  });
  it('late in the day, a hard day can\'t start slow: the night ends early instead', async () => {
    await settled();
    clock = new Date('2026-10-22T03:00:00Z'); // 8pm in Los Angeles, the same Wednesday
    const r = await engine().run(alice, { kind: 'message', text: 'I hurt my knee' });
    expect(r.reply).toBe('Okay, got it. Sorry to hear that. Your Ritual is lighter today.');
    expect(r.state.ritual.today.parts.map((p) => p.title)).toContain('Early night');
    expect(r.state.ritual.today.parts.map((p) => p.title)).not.toContain('Sleep in');
  });
  it('makes a real change for "Out late tonight", even with Claude off', async () => {
    await settled();
    const r = await engine().run(alice, { kind: 'message', text: 'Out late tonight' });
    expect(r.versionId).toBeDefined();
    expect(r.reply).toMatch(/Have a good night out/);
    expect(r.state.ritual.week[1]!.parts.map((p) => p.title)).toContain('Sleep in');
  });
  it('before they say yes to a Ritual changes nothing and says so', async () => {
    await engine().run(alice, { kind: 'onboarding' });
    const { client, answers } = fakeClient();
    answers.push(tonight, { ops: [] });
    const r = await engine(client).run(alice, { kind: 'message', text: 'out late with the team tonight' });
    expect(r.reply).toBe(FIXED_LINES.noRitualYet);
  });
});

describe('a follow-up', () => {
  const greensWhy = "No independent trial has tested a greens powder. One swap, if you'd like it: a piece of fruit and some greens at lunch.";
  it('answers a Why? from its card in the catalog’s reviewed words, and offers the swap', async () => {
    const s = (await settled()).state;
    expect(s.items.ag1).toBe('clear');
    const r = await engine().run(alice, { kind: 'message', text: 'Why let Greens powder go?', about: 'ag1' });
    expect(r.reply).toBe(greensWhy);
    expect(r.swap).toEqual({ itemKey: 'greens-powder-ag1-etc', stackItemId: 'ag1', title: 'Fruit and greens at lunch', slot: 'midday', perWeek: null });
    const about = await store.events(alice, ['message.about'], '2000-01-01T00:00:00Z');
    expect(about.map((x) => x.payload)).toEqual([{ stackItemId: 'ag1', via: 'card' }]);
  });
  it('keeps a bare “why?” on what they last asked about, and leaves a free-text question for Claude', async () => {
    await settled();
    const e = engine();
    await e.run(alice, { kind: 'message', text: 'Why let Greens powder go?', about: 'ag1' });
    expect((await e.run(alice, { kind: 'message', text: 'why?' })).reply).toBe(greensWhy);
    expect((await e.run(alice, { kind: 'message', text: 'how would I fit that in?' })).reply).toBe(greensWhy);
    // Named in their own words, with Claude off: the reply waits for a model that can fit it to them.
    expect((await e.run(alice, { kind: 'message', text: 'is creatine worth it?' })).reply).toBe(REPLY_FALLBACK);
    // Not a question about anything: no item at all.
    expect((await e.run(alice, { kind: 'message', text: 'Sam made pasta tonight' })).swap).toBeUndefined();
  });
  it('thanks them for something they told us about a card, rather than answering a question they didn’t ask', async () => {
    await settled();
    const r = await engine().run(alice, { kind: 'message', text: 'I drink maybe half of them', about: 'ag1' });
    expect(r.reply).toBe(REPLY_FALLBACK);
  });
  it('never offers a swap for something Distill keeps', async () => {
    await settled();
    const r = await engine().run(alice, { kind: 'message', text: 'Why keep creatine?', about: 'cr' });
    expect(r.swap).toBeUndefined();
    expect(r.reply).not.toMatch(/swap/);
  });
  it('adds the swap to their Ritual on a yes, and stops offering it', async () => {
    await settled();
    const e = engine();
    const r = await e.swapAnswer(alice, 'greens-powder-ag1-etc', 'add');
    const part = r.state.ritual.today.parts.find((p) => p.id === 'part:swap:greens-powder-ag1-etc')!;
    expect(part).toMatchObject({ title: 'Fruit and greens at lunch', source: { kind: 'swap', itemKey: 'greens-powder-ag1-etc' }, status: 'active' });
    expect(part.when.slot).toBe('midday');
    expect(r.state.ritual.lastChange).toMatchObject({ undoable: true });
    expect((await e.run(alice, { kind: 'message', text: 'why?', about: 'ag1' })).swap).toBeUndefined();
    // A second yes changes nothing.
    expect((await e.swapAnswer(alice, 'greens-powder-ag1-etc', 'add')).versionId).toBeUndefined();
  });
  it('never offers it again after a no, and only swaps for things on their list', async () => {
    await settled();
    const e = engine();
    await e.swapAnswer(alice, 'greens-powder-ag1-etc', 'decline');
    expect((await e.run(alice, { kind: 'message', text: 'why?', about: 'ag1' })).swap).toBeUndefined();
    await expect(e.swapAnswer(alice, 'two-exfoliants-scrub-plus-acid-or-two-acids', 'add')).rejects.toThrow(/no_such_swap/);
  });
  it('offers the swap on today’s card after a yes to letting it go', async () => {
    progress = { ...progress, items: progress.items.filter((i) => i.id === 'ag1' || i.id === 'sun') };
    const s = (await settled()).state;
    expect(s.today.decision?.stackItemId).toBe('ag1');
    expect(s.today.swap).toBeUndefined();
    progress = { ...progress, items: progress.items.map((i) => (i.id === 'ag1' ? { ...i, status: 'cut' } : i)) };
    const r = await engine().run(alice, { kind: 'decision-answer', decisionId: s.today.decision!.id, answer: 'yes' });
    expect(r.state.today.swap).toMatchObject({ itemKey: 'greens-powder-ag1-etc', title: 'Fruit and greens at lunch' });
  });
  it('gives Claude the whole item: what the sources found, the swap, and room for a fuller answer', async () => {
    await settled();
    const { client, answers, requests } = fakeClient();
    const said = 'No independent trial has looked at greens powders alone. Whole vegetables have a long record, so fruit and greens at lunch would keep the habit. I can add that to your afternoons.';
    answers.push({ ...tonight, intent: 'question', trigger: null }, { ops: [] }, { reply: said });
    const r = await engine(client).run(alice, { kind: 'message', text: 'Why let Greens powder go?', about: 'ag1' });
    expect(r.reply).toBe(said);
    const asked = JSON.stringify(requests.at(-1));
    expect(asked).toContain('<item>');
    expect(asked).toContain('A source found: Found no independent trial of a greens powder');
    expect(asked).toContain('A swap they could make: A piece of fruit and some greens at lunch.');
    expect(asked).toContain('Where it stands: Distill suggested letting it go');
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
