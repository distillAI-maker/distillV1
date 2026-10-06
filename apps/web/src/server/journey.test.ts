import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '../../../../packages/data/src/schema';
import type { Database } from '@distill/data';
import { emptyProgress } from '../../lib/progress/types';
import { demoStack } from '../../lib/data/demo/stack';
import { audit, screenAudit } from './audit';
import { Journey, syntheticHistory } from './journey';

const alice = '10000000-0000-4000-8000-000000000001',
  bob = '10000000-0000-4000-8000-000000000002';
const now = new Date('2026-10-06T12:00:00Z');
let pg: PGlite, journey: Journey;
const progress = () => ({
  ...emptyProgress(),
  dataSource: 'demo' as const,
  goals: ['sleep (general)'],
  items: demoStack().filter((i) => i.itemKey === 'coffee-after-2pm'),
});
const input = {
  itemKey: 'coffee-after-2pm',
  timeZone: 'UTC',
  days: 42 as const,
  onDefinition: 'My usual afternoon coffee.',
  offDefinition: 'No afternoon coffee.',
};
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
  ])
    await pg.exec(
      await readFile(new URL(`../../../../supabase/migrations/${file}`, import.meta.url), 'utf8'),
    );
  journey = new Journey(drizzle(pg, { schema }) as unknown as Database);
}, 30000);
beforeEach(async () => {
  await pg.exec(
    `reset role; delete from auth.users; insert into auth.users values ('${alice}'),('${bob}');`,
  );
});
afterAll(async () => {
  await pg?.close();
});

describe('connected journey on Postgres', () => {
  it('calculates the audit from answers, handles custom items and protects clinician items', () => {
    const p = progress();
    expect(audit(p).runnable.some((i) => i.key === input.itemKey)).toBe(true);
    p.items[0]!.origin = 'doctor';
    expect(audit(p).runnable).toHaveLength(0);
    expect(screenAudit(p).items[0]!.landing.tier).toBe('PROTECTED');
    p.items[0]!.origin = 'other';
    p.items[0]!.itemKey = null;
    p.items[0]!.customName = 'Unlisted product';
    expect(screenAudit(p).items[0]!.landing.sentenceSource).toBe('none');
  });
  it('persists complete progress per account, with no cross-account fallback', async () => {
    const p = progress();
    p.dayOne.keepAnyway = ['my-choice'];
    await journey.save(alice, p);
    expect(await journey.load(alice)).toEqual(p);
    expect(await journey.load(bob)).toBeNull();
    await pg.exec('set role authenticated');
    await expect(pg.query('select * from public.app_journeys')).rejects.toThrow(/permission/i);
    await pg.exec('reset role');
  });
  it('runs registration, compliance, analysis and persisted verdict through the same engines', async () => {
    await journey.save(alice, progress());
    const { id } = await journey.start(alice, input, now);
    const [{ pre_registration: registration }] = (
      await pg.query<{ pre_registration: { schedule: { days: { sleepDate: string }[] } } }>(
        'select pre_registration from experiments',
      )
    ).rows;
    expect(registration!.schedule.days).toHaveLength(42);
    await expect(journey.start(alice, input, now)).rejects.toThrow('experiment_already_active');
    await expect(
      journey.checkIn(
        bob,
        id,
        { sleepDate: registration!.schedule.days[0]!.sleepDate, tap: 'did' },
        now,
      ),
    ).rejects.toThrow();
    await expect(journey.finish(alice, id, now)).rejects.toThrow('experiment_not_finished');
    await expect(
      journey.checkIn(alice, id, { sleepDate: '2027-01-01', tap: 'did' }, now),
    ).rejects.toThrow('future_check_in');
    await journey.checkIn(
      alice,
      id,
      { sleepDate: registration!.schedule.days[0]!.sleepDate, tap: 'did', exclusions: ['ill'] },
      now,
    );
    await journey.advanceDemo(alice, id, true, now);
    const verdict = await journey.finish(alice, id, now);
    expect(verdict.synthetic).toBe(true);
    expect(verdict.nights).toHaveLength(42);
    expect(verdict.nights[0]!.counted).toBe(false);
    expect(verdict.text).not.toMatch(/\{[^}]+\}/);
    expect(['Kept', 'Dropped', 'Inconclusive']).toContain(verdict.word);
    expect(await journey.finish(alice, id, now)).toEqual(verdict);
    expect((await journey.snapshot(bob, now)).verdicts).toHaveLength(0);
    expect((await journey.snapshot(alice, new Date('2027-01-01'))).verdicts[0]).toEqual(verdict);
    await expect(
      journey.checkIn(alice, id, { sleepDate: verdict.nights[0]!.date, tap: 'didnt' }, now),
    ).rejects.toThrow();
    await expect(
      pg.query(`update experiments set app_context = '{}'::jsonb where id = '${id}'`),
    ).rejects.toThrow();
    await pg.query(`delete from auth.users where id = '${alice}'`);
    expect((await pg.query('select * from experiment_results')).rows).toHaveLength(0);
    expect(await journey.load(alice)).toBeNull();
  });
  it('does not invent a baseline or allow synthetic advancement of real experiments', async () => {
    await journey.save(alice, { ...progress(), dataSource: 'csv' });
    await expect(journey.start(alice, input, now)).rejects.toThrow('baseline_watching');
    expect((await pg.query('select * from experiments')).rows).toHaveLength(0);
    await expect(
      journey.advanceDemo(alice, '20000000-0000-4000-8000-000000000001', true, now),
    ).rejects.toThrow('demo_only');
  });
  it('uses imported measurements for a real schedule and does not permit demo time travel', async () => {
    await journey.save(alice, { ...progress(), dataSource: 'csv' });
    for (const { night } of syntheticHistory('2026-10-06').slice(-35))
      await pg.query(
        'insert into wearable_nights(user_id,source,sleep_date,record) values ($1,$2,$3,$4)',
        [alice, 'csv', night.sleepDate, JSON.stringify({ ...night, source: 'csv' })],
      );
    const { id } = await journey.start(alice, { ...input, days: 14 }, now);
    await expect(journey.advanceDemo(alice, id, true, now)).rejects.toThrow('demo_only');
    const { pre_registration: r } = (await journey.records(alice))[0]!;
    const end = new Date(`${r.schedule.days.at(-1)!.sleepDate}T12:00:00Z`);
    const measurements = syntheticHistory(r.schedule.days.at(-1)!.sleepDate, r);
    for (const day of r.schedule.days) {
      const night = measurements.find((h) => h.night.sleepDate === day.sleepDate)!.night;
      await pg.query(
        'insert into wearable_nights(user_id,source,sleep_date,record) values ($1,$2,$3,$4)',
        [alice, 'csv', night.sleepDate, JSON.stringify({ ...night, source: 'csv' })],
      );
      await journey.checkIn(alice, id, { sleepDate: day.sleepDate, tap: 'did' }, end);
    }
    const verdict = await journey.finish(alice, id, end);
    expect(verdict.synthetic).toBe(false);
    expect(verdict.word).toBe('Inconclusive');
    expect(verdict.reasons).toContain('assignment_resolution');
    expect(verdict.nights.some((n) => n.value !== null)).toBe(true);
    await expect(
      pg.query(`update experiment_results set verdict = '{}'::jsonb where experiment_id = '${id}'`),
    ).rejects.toThrow('immutable');
  });
});
