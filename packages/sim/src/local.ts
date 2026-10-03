import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { demoProfiles } from './demo.js';
import type { DemoUser } from './demo.js';

/** Local PGlite only. No DATABASE_URL, hosted auth, credentials or outbound requests. */
export async function prepareDemoDatabase(pg: PGlite) {
  const marker = await pg.query("select to_regclass('public.distill_demo_marker') as table_name");
  if (marker.rows[0] && (marker.rows[0] as { table_name: string | null }).table_name) return;
  const existing = await pg.query("select to_regclass('public.wearable_accounts') as table_name");
  if ((existing.rows[0] as { table_name: string | null }).table_name)
    throw new Error('Refusing to seed an unmarked existing database');
  await pg.transaction(async (tx) => {
    await tx.exec(`create role anon; create role authenticated;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
      create schema storage;
      create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint);
      create table storage.objects(id uuid default gen_random_uuid(), bucket_id text, name text);
      alter table storage.objects enable row level security;
      create table public.signups(email text);`);
    for (const file of ['202610020001_phase_two.sql', '202610020002_phase_four.sql'])
      await tx.exec(
        await readFile(new URL(`../../../supabase/migrations/${file}`, import.meta.url), 'utf8'),
      );
    await tx.exec(`create table public.distill_demo_marker(version integer primary key check(version=1));
      insert into public.distill_demo_marker values(1);
      create table public.demo_profiles(user_id uuid primary key references public.wearable_accounts(user_id) on delete cascade,
        bundle jsonb not null check(bundle->>'synthetic' = 'true'));
      alter table public.demo_profiles enable row level security;
      revoke all on public.demo_profiles, public.distill_demo_marker from anon, authenticated;`);
  });
}
export async function seedDemoDatabase(pg: PGlite, users: readonly DemoUser[]) {
  if (
    users.length !== 3 ||
    new Set(users.map((user) => user.userId)).size !== 3 ||
    users.some(
      (user) => !user.synthetic || !demoProfiles.some((profile) => profile.id === user.userId),
    )
  )
    throw new Error('Only the three declared synthetic demo identities may be seeded');
  await prepareDemoDatabase(pg);
  await pg.transaction(async (tx) => {
    for (const user of users) {
      const collision = await tx.query(
        `select 1 from auth.users where id=$1 and not exists
        (select 1 from demo_profiles where user_id=$1)`,
        [user.userId],
      );
      if (collision.rows.length) throw new Error('Demo identity collides with an unmarked account');
      // Only known, marked fixture users are replaced. FK cascades remove their old fixture rows.
      await tx.query('delete from auth.users where id=$1', [user.userId]);
      await tx.query('insert into auth.users(id) values($1)', [user.userId]);
      await tx.query('insert into wearable_accounts(user_id) values($1)', [user.userId]);
      const rows = [
        ...user.person.history.map((entry) => ({ kind: 'sleep', record: entry.night })),
        ...user.person.workouts.map((record) => ({ kind: 'workout', record })),
        ...user.person.tags.map((record) => ({ kind: 'tag', record })),
      ];
      for (const row of rows) {
        const rawPayloadId = row.record.rawPayloadId;
        const record = { ...row.record, rawPayloadId };
        await tx.query(
          `insert into wearable_raw_payloads(id,user_id,source,kind,source_id,payload)
          values($1,$2,'synthetic',$3,$4,$5)`,
          [
            rawPayloadId,
            user.userId,
            row.kind,
            record.sourceId,
            JSON.stringify({
              synthetic: true,
              generatorVersion: 1,
              seed: user.person.seed,
              record,
            }),
          ],
        );
        if (row.kind === 'sleep')
          await tx.query(
            `insert into wearable_nights(user_id,source,sleep_date,record)
          values($1,'synthetic',$2,$3)`,
            [user.userId, (record as { sleepDate: string }).sleepDate, JSON.stringify(record)],
          );
        else
          await tx.query(
            `insert into wearable_events(user_id,source,kind,source_id,record)
          values($1,'synthetic',$2,$3,$4)`,
            [user.userId, row.kind, record.sourceId, JSON.stringify(record)],
          );
      }
      const reg = user.registration;
      await tx.query('insert into experiment_cycles(id,user_id,created_at) values($1,$2,$3)', [
        reg.cycleId,
        user.userId,
        reg.lockedAt,
      ]);
      await tx.query(
        `insert into experiments(id,user_id,cycle_id,pre_registration,status,started_at,ended_at)
        values($1,$2,$3,$4,'completed',$5,$6)`,
        [
          reg.experimentId,
          user.userId,
          reg.cycleId,
          JSON.stringify(reg),
          reg.lockedAt,
          `${user.asOf}T23:00:00Z`,
        ],
      );
      for (const entry of user.checkIns)
        await tx.query(
          `insert into experiment_check_ins(experiment_id,sleep_date,entry,recorded_at)
        values($1,$2,$3,$4)`,
          [
            reg.experimentId,
            entry.sleepDate,
            JSON.stringify(entry),
            `${entry.sleepDate}T12:00:00Z`,
          ],
        );
      await tx.query('insert into demo_profiles(user_id,bundle) values($1,$2)', [
        user.userId,
        JSON.stringify(user),
      ]);
    }
  });
  return {
    users: users.length,
    nights: users.reduce((sum, user) => sum + user.person.history.length, 0),
  };
}
