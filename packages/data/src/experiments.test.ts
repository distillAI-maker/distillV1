import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { eq } from 'drizzle-orm';
import { assertPreRegistration, planBaseline, startExperiment } from '@distill/engine/experiment';
import { history, startInput, testRegistration } from '../../engine/src/experiment/test-support.js';
import { ExperimentRepository } from './experiments.js';
import type { Database } from './repository.js';
import * as schema from './schema.js';

const alice = '10000000-0000-4000-8000-000000000001',
  bob = '10000000-0000-4000-8000-000000000002';
const now = new Date('2026-10-05T12:00:00Z');
let pg: PGlite, repo: ExperimentRepository, db: Database;
beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(`create role anon; create role authenticated;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create schema storage; create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint);
    create table storage.objects(id uuid default gen_random_uuid(), bucket_id text, name text);
    create table public.signups(email text);`);
  for (const name of ['202610020001_phase_two.sql', '202610020002_phase_four.sql'])
    await pg.exec(
      await readFile(new URL(`../../../supabase/migrations/${name}`, import.meta.url), 'utf8'),
    );
  db = drizzle(pg, { schema }) as unknown as Database;
  repo = new ExperimentRepository(db);
}, 30000);
beforeEach(async () => {
  await pg.exec(`reset role; delete from public.experiment_cycles;
    insert into auth.users values ('${alice}'), ('${bob}') on conflict do nothing;
    insert into public.wearable_accounts(user_id) values ('${alice}'), ('${bob}') on conflict do nothing;
    update public.wearable_accounts set deleting = false;`);
  await repo.createCycle(alice, testRegistration().cycleId, now);
});
afterAll(async () => {
  await pg?.close();
});
const alternative = () => {
  const baseline = planBaseline(
    history.map((row) => ({
      night: { ...row.night, sleepLatencyMinutes: row.night.totalSleepMinutes! / 10 },
    })),
    'sleepLatencyMinutes',
    { source: 'oura' },
    '2026-10-05',
    '2026-10-05',
  );
  return startExperiment(
    startInput({
      experimentId: '20000000-0000-4000-8000-000000000002',
      candidate: {
        ...startInput().candidate,
        id: 'dinner',
        key: 'late-dinner-within-2-3-h-of-bed',
        metric: 'Time to fall asleep',
      },
      baseline,
    }),
  );
};

describe('experiment persistence on real Postgres', () => {
  it('stores the locked record and validates JSONB with reordered object keys', async () => {
    const record = testRegistration();
    await repo.start(alice, record);
    const rows = await repo.read(alice);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.preRegistration).toEqual(record);
    expect(() => assertPreRegistration(rows[0]!.preRegistration)).not.toThrow();
    expect(await repo.read(bob)).toHaveLength(0);
  });
  it('the database rejects edits to any pre-registration field after start', async () => {
    const record = testRegistration();
    await repo.start(alice, record);
    for (const mutation of [
      { ...record, metric: 'overnightHrvMs' },
      { ...record, alpha: 0.1 },
      { ...record, testPolicy: 'benefit_only' },
      { ...record, personalSwing: { ...record.personalSwing, sampleValues: Array(28).fill(1) } },
      { ...record, personalSwing: { ...record.personalSwing, value: 1 } },
      { ...record, schedule: { ...record.schedule, seed: 99 } },
    ]) {
      await expect(
        db
          .update(schema.experiments)
          .set({ preRegistration: mutation as never })
          .where(eq(schema.experiments.id, record.experimentId)),
      ).rejects.toThrow();
    }
    const result = await repo.read(alice);
    expect(result[0]!.preRegistration).toEqual(record);
  });
  it('prevents a second active experiment even when the caller bypasses the pure engine', async () => {
    await repo.start(alice, testRegistration());
    await expect(repo.start(alice, alternative())).rejects.toThrow();
    expect((await repo.read(alice)).filter((row) => row.status === 'active')).toHaveLength(1);
  });
  it('allows one durable veto and prevents resetting it or starting the vetoed item', async () => {
    const record = testRegistration();
    await repo.veto(alice, record.cycleId, record.itemId);
    await expect(repo.veto(alice, record.cycleId, 'other')).rejects.toThrow('already used');
    await expect(repo.start(alice, record)).rejects.toThrow('vetoed');
    await expect(
      db
        .update(schema.experimentCycles)
        .set({ vetoedItemId: null })
        .where(eq(schema.experimentCycles.id, record.cycleId)),
    ).rejects.toThrow();
    await expect(repo.veto(bob, record.cycleId, 'other')).rejects.toThrow('not found');
  });
  it('an atomic switch retains the previous record and has only one active successor', async () => {
    const original = testRegistration(),
      next = alternative();
    await repo.start(alice, original);
    await repo.switch(alice, original.experimentId, next);
    const rows = await repo.read(alice);
    expect(rows.find((row) => row.id === original.experimentId)).toMatchObject({
      status: 'switched',
      preRegistration: original,
    });
    expect(rows.find((row) => row.id === next.experimentId)).toMatchObject({
      status: 'active',
      preRegistration: next,
    });
    expect(rows.filter((row) => row.status === 'active')).toHaveLength(1);
  });
  it('a failed successor insert rolls the switch back without losing the current test', async () => {
    const original = testRegistration();
    await repo.start(alice, original);
    const next = { ...alternative(), experimentId: original.experimentId };
    await expect(repo.switch(alice, original.experimentId, next)).rejects.toThrow();
    expect((await repo.read(alice))[0]).toMatchObject({
      status: 'active',
      endedAt: null,
      preRegistration: original,
    });
  });
  it('owner-bound check-ins preserve unknown taps, permit corrections, and reject future/foreign writes', async () => {
    const record = testRegistration();
    await repo.start(alice, record);
    const date = record.schedule.days[0]!.sleepDate;
    const morning = new Date('2026-10-06T12:00:00Z');
    await repo.checkIn(alice, record.experimentId, { sleepDate: date }, morning);
    expect((await repo.readCheckIns(alice, record.experimentId))[0]!.entry).toMatchObject({
      tap: 'unknown',
      exposure: 'unknown',
    });
    await repo.checkIn(
      alice,
      record.experimentId,
      { sleepDate: date, tap: 'did', exclusions: ['ill'] },
      morning,
    );
    expect(await repo.readCheckIns(alice, record.experimentId)).toHaveLength(1);
    expect((await repo.readCheckIns(alice, record.experimentId))[0]!.entry.usable).toBe(false);
    expect(await repo.readCheckIns(bob, record.experimentId)).toHaveLength(0);
    await expect(
      repo.checkIn(bob, record.experimentId, { sleepDate: date, tap: 'did' }, morning),
    ).rejects.toThrow('not found');
    await expect(
      repo.checkIn(alice, record.experimentId, { sleepDate: date }, now),
    ).rejects.toThrow('future');
  });
  it('completion waits for the final sleep date and closed tests cannot be reopened or edited', async () => {
    const record = testRegistration();
    await repo.start(alice, record);
    await expect(
      repo.close(alice, record.experimentId, 'completed', new Date('2026-10-18T12:00:00Z')),
    ).rejects.toThrow('not finished');
    await repo.close(alice, record.experimentId, 'completed', new Date('2026-10-19T12:00:00Z'));
    await expect(
      db
        .update(schema.experiments)
        .set({ status: 'active', endedAt: null })
        .where(eq(schema.experiments.id, record.experimentId)),
    ).rejects.toThrow();
    await expect(
      repo.checkIn(
        alice,
        record.experimentId,
        { sleepDate: record.schedule.days[0]!.sleepDate },
        new Date('2026-10-19T12:00:00Z'),
      ),
    ).rejects.toThrow('not found');
  });
  it('SQL lifecycle constraints reject a closed test without an end timestamp', async () => {
    const record = testRegistration();
    await repo.start(alice, record);
    await expect(
      db
        .update(schema.experiments)
        .set({ status: 'completed' })
        .where(eq(schema.experiments.id, record.experimentId)),
    ).rejects.toThrow();
    expect((await repo.read(alice))[0]!.status).toBe('active');
  });
  it('authenticated browser roles cannot read records or amend registrations', async () => {
    const record = testRegistration();
    await repo.start(alice, record);
    await pg.exec('grant select on public.experiments to authenticated; set role authenticated;');
    try {
      expect((await pg.query('select * from public.experiments')).rows).toHaveLength(0);
      await expect(
        pg.exec(`update public.experiments set pre_registration = '{}'::jsonb`),
      ).rejects.toThrow();
    } finally {
      await pg.exec('reset role;');
    }
  });
  it('deleting accounts reject new writes and Auth deletion cascades all experiment data', async () => {
    const record = testRegistration();
    await repo.start(alice, record);
    await repo.checkIn(
      alice,
      record.experimentId,
      { sleepDate: record.schedule.days[0]!.sleepDate },
      new Date('2026-10-06T12:00:00Z'),
    );
    await db
      .update(schema.accounts)
      .set({ deleting: true })
      .where(eq(schema.accounts.userId, alice));
    await expect(
      repo.checkIn(
        alice,
        record.experimentId,
        { sleepDate: record.schedule.days[0]!.sleepDate },
        new Date('2026-10-06T12:00:00Z'),
      ),
    ).rejects.toThrow('unavailable');
    await pg.exec(`delete from auth.users where id = '${alice}';`);
    expect(await repo.read(alice)).toHaveLength(0);
    expect((await pg.query('select * from public.experiment_check_ins')).rows).toHaveLength(0);
    expect((await pg.query('select * from public.experiment_cycles')).rows).toHaveLength(0);
  });
});
