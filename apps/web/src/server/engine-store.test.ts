import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as schema from '../../../../packages/data/src/schema';
import type { Database } from '@distill/data';
import type { DecisionDraft, RitualVersion } from '@distill/engine/ritual';
import { EngineStore } from './engine-store';

const alice = '20000000-0000-4000-8000-000000000001';
const stamp = { engineVersion: 'test', catalogVersion: 'test', inputsHash: 'x' };
let pg: PGlite, store: EngineStore;

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
});
afterAll(async () => {
  await pg?.close();
});

const base = (version: number): RitualVersion => ({
  id: `00000000-0000-4000-8000-${String(version).padStart(12, '0')}`,
  personId: alice,
  version,
  parentId: null,
  scope: { kind: 'base', effectiveFrom: '2026-10-21' },
  parts: [
    {
      id: 'part:a',
      when: { slot: 'morning', days: ['mon', 'tue'] },
      order: 0,
      title: 'Coffee, window, no phone',
      area: 'mind',
      why: 'Yours.',
      source: { kind: 'words', quote: 'coffee by the window' },
      status: 'active',
      lock: 'theirs',
    },
  ],
  ops: [],
  changes: [],
  cause: { eventId: null, trigger: 'onboarding' },
  status: 'accepted',
  engine: stamp,
  createdAt: '2026-10-21T08:00:00.000Z',
});
const draft = (stackItemId: string, reason: DecisionDraft['reason'], kind: DecisionDraft['kind'] = 'clear') => ({
  key: `${stackItemId}:${kind}`,
  stackItemId,
  itemKey: null,
  kind,
  reason,
  money: 20,
  name: stackItemId,
  context: {},
  line: `Line for ${stackItemId}`,
});

describe('engine tables on Postgres', () => {
  it('keeps versions per person, numbered without gaps under the lock, and reads them back', async () => {
    await store.withLock(alice, async (tx) => {
      expect(await store.nextVersion(alice, tx)).toBe(1);
      await store.insertVersion(base(1), tx);
      expect(await store.nextVersion(alice, tx)).toBe(2);
    });
    const [v] = await store.versions(alice);
    expect(v).toEqual(base(1));
    await expect(store.withLock(alice, (tx) => store.insertVersion(base(1), tx))).rejects.toThrow();
  });
  it('keeps one open proposal per item and kind, rewords on a new reason, and withdraws what the engine stopped proposing', async () => {
    const first = await store.withLock(alice, (tx) =>
      store.syncDecisions(alice, [draft('ag1', 'BORROWED_WEAK'), draft('gym', 'UNUSED')], stamp, tx),
    );
    expect(first.added).toHaveLength(2);
    const second = await store.withLock(alice, (tx) =>
      store.syncDecisions(alice, [draft('ag1', 'OVERLAP')], stamp, tx),
    );
    expect(second.added.map((d) => d.reason)).toEqual(['OVERLAP']);
    expect(second.withdrawn).toHaveLength(1);
    const all = await store.decisions(alice);
    expect(all.filter((d) => d.status === 'proposed').map((d) => `${d.stackItemId}:${d.reason}`)).toEqual(['ag1:OVERLAP']);
    const answered = await store.answerDecision(alice, second.added[0]!.id, 'not-now');
    expect(answered!.status).toBe('not-now');
    expect(await store.answerDecision(alice, second.added[0]!.id, 'yes')).toBeNull();
  });
  it('is invisible to the browser roles, and goes when the account goes', async () => {
    await store.addMessage(alice, { role: 'person', text: 'out late with the team tonight' });
    await store.log({ userId: alice, kind: 'llm.call', payload: { step: 'classify' }, costUsd: 0.0003, latencyMs: 900 });
    await store.withLock(alice, (tx) => store.insertVersion(base(1), tx));
    for (const table of ['person_models', 'ritual_versions', 'context_messages', 'decisions', 'engine_events', 'engine_metric_cost']) {
      await pg.exec('set role authenticated');
      await expect(pg.query(`select * from public.${table}`)).rejects.toThrow(/permission/i);
      await pg.exec('reset role');
    }
    expect(await store.callsSince({ userId: alice }, '2000-01-01T00:00:00Z')).toBe(1);
    await pg.exec(`delete from auth.users where id = '${alice}'`);
    for (const table of ['person_models', 'ritual_versions', 'context_messages', 'decisions', 'engine_events']) {
      const { rows } = await pg.query<{ n: number }>(`select count(*)::int as n from public.${table}`);
      expect(rows[0]!.n).toBe(0);
    }
  });
});
