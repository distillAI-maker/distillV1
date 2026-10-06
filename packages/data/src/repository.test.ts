import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { eq } from 'drizzle-orm';
import { emptyMetrics } from '@distill/providers';
import { Repository, rawCollector } from './repository.js';
import type { Database } from './repository.js';
import * as schema from './schema.js';

const alice = '10000000-0000-4000-8000-000000000001',
  bob = '10000000-0000-4000-8000-000000000002';
let pg: PGlite, repo: Repository;
const now = new Date('2026-10-02T12:00:00Z');
beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(`create role anon; create role authenticated;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create schema storage;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint);
    create table storage.objects(id uuid default gen_random_uuid(), bucket_id text, name text);
    alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated; grant insert on storage.objects to authenticated;
    create table public.signups(email text);
    insert into auth.users values ('${alice}'), ('${bob}');`);
  await pg.exec(
    await readFile(
      new URL('../../../supabase/migrations/202610020001_phase_two.sql', import.meta.url),
      'utf8',
    ),
  );
  // Both drivers implement the same Drizzle Postgres query/transaction contract.
  repo = new Repository(drizzle(pg, { schema }) as unknown as Database);
  await repo.ensureAccount(alice);
  await repo.ensureAccount(bob);
}, 30000);
afterAll(async () => {
  await pg?.close();
});

describe('real Postgres migration and persistence (PGlite)', () => {
  it('atomically consumes OAuth state once and rejects expiration/provider mismatch', async () => {
    await repo.saveOAuthState({
      hash: 'state',
      userId: alice,
      provider: 'oura',
      verifierEnvelope: 'encrypted',
      expiresAt: new Date(+now + 1000),
    });
    expect(await repo.consumeOAuthState('state', 'whoop', now)).toBeUndefined();
    expect((await repo.consumeOAuthState('state', 'oura', now))?.userId).toBe(alice);
    expect(await repo.consumeOAuthState('state', 'oura', now)).toBeUndefined();
    await repo.saveOAuthState({
      hash: 'expired',
      userId: alice,
      provider: 'oura',
      verifierEnvelope: 'encrypted',
      expiresAt: now,
    });
    expect(await repo.consumeOAuthState('expired', 'oura', now)).toBeUndefined();
  });
  it('leases each connection exclusively and retries an expired lease without advancing history', async () => {
    await repo.connect(alice, 'oura', 'ciphertext', now);
    const first = (await repo.claimConnection(now, alice))!;
    expect(first.backfillBefore).toBe('2026-10-03');
    expect(await repo.claimConnection(now, alice)).toBeUndefined();
    const resumed = (await repo.claimConnection(new Date(+now + 11 * 60000), alice))!;
    expect(resumed.lease).not.toBe(first.lease);
    await expect(repo.saveTokens(first, 'stale-write')).rejects.toThrow('lease lost');
    await repo.saveTokens(resumed, 'new-ciphertext');
    await repo.failConnection(resumed, 'rate_limited', new Date(+now + 120000), false);
    expect(await repo.claimConnection(new Date(+now + 60000), alice)).toBeUndefined();
  });
  it('upserts source-specific nights and raw pointers; a failed batch rolls back', async () => {
    const row = (await repo.claimConnection(new Date(+now + 180000), alice))!;
    const raw = rawCollector(alice, 'oura');
    const rawPayloadId = await raw.write('sleep', 'source1', { id: 'source1', duration: 420 });
    const night = {
      ...emptyMetrics,
      sleepDate: '2026-10-01',
      source: 'oura' as const,
      sourceId: 'source1',
      deviceModel: null,
      hrvMethod: 'rmssd' as const,
      sleepStart: null,
      sleepEnd: null,
      rawPayloadId,
      totalSleepMinutes: 420,
    };
    await expect(
      repo.finishConnection(
        row,
        { nights: [{ ...night, totalSleepMinutes: -1 }], workouts: [], tags: [] },
        raw.rows.values(),
        {},
      ),
    ).rejects.toThrow();
    expect((await pg.query('select * from wearable_raw_payloads')).rows).toHaveLength(0);
    await repo.finishConnection(
      row,
      { nights: [night], workouts: [], tags: [] },
      raw.rows.values(),
      { nextSyncAt: now },
    );
    const next = (await repo.claimConnection(now, alice))!;
    await raw.write('sleep', 'source1', { id: 'source1', duration: 430 });
    await repo.finishConnection(
      next,
      { nights: [{ ...night, totalSleepMinutes: 430 }], workouts: [], tags: [] },
      raw.rows.values(),
      { nextSyncAt: now },
    );
    expect(
      (await repo.readNights(alice, '2026-10-01', '2026-10-02'))[0]?.record.totalSleepMinutes,
    ).toBe(430);
    expect(await repo.readNights(bob, '2026-10-01', '2026-10-02')).toEqual([]);
    expect((await pg.query('select * from wearable_raw_payloads')).rows).toHaveLength(1);
  });
  it('enforces server-only tables and permits only the authenticated owner to upload a registered path', async () => {
    await repo.createImport({ userId: alice, source: 'csv', path: `${alice}/file/nights.csv` });
    await pg.exec(
      `set role authenticated; select set_config('request.jwt.claim.sub', '${bob}', false);`,
    );
    await expect(pg.query(`select token_envelope from wearable_connections`)).rejects.toThrow();
    await expect(
      pg.query(
        `insert into storage.objects(bucket_id,name) values ('wearable-imports','${alice}/file/nights.csv')`,
      ),
    ).rejects.toThrow();
    await pg.exec(`select set_config('request.jwt.claim.sub', '${alice}', false);`);
    await pg.query(
      `insert into storage.objects(bucket_id,name) values ('wearable-imports','${alice}/file/nights.csv')`,
    );
    await pg.exec('reset role');
  });
  it('blocks in-flight worker commits and uploads once deletion starts, then cascades every owned table', async () => {
    await repo.connect(bob, 'whoop', 'bob-ciphertext', now);
    const inFlight = (await repo.claimConnection(now, alice))!;
    await repo.beginDeletion(alice);
    await expect(
      repo.finishConnection(inFlight, { nights: [], workouts: [], tags: [] }, [], {}),
    ).rejects.toThrow('unavailable');
    await expect(repo.ensureAccount(alice)).rejects.toThrow('unavailable');
    await pg.exec(
      `set role authenticated; select set_config('request.jwt.claim.sub', '${alice}', false);`,
    );
    await expect(
      pg.query(
        `insert into storage.objects(bucket_id,name) values ('wearable-imports','${alice}/file/nights.csv')`,
      ),
    ).rejects.toThrow();
    await pg.exec('reset role');
    await pg.query('delete from auth.users where id = $1', [alice]);
    for (const name of [
      'accounts',
      'connections',
      'oauth_states',
      'raw_payloads',
      'nights',
      'events',
      'imports',
    ]) {
      expect(
        (await pg.query(`select * from wearable_${name} where user_id = $1`, [alice])).rows,
      ).toEqual([]);
    }
    expect(
      (await repo.db.select().from(schema.connections).where(eq(schema.connections.userId, bob)))[0]
        ?.tokenEnvelope,
    ).toBe('bob-ciphertext');
  });
});
