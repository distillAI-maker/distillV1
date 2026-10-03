import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';
import { createDemoUsers } from './demo.js';
import { prepareDemoDatabase, seedDemoDatabase } from './local.js';

it('seeds production-shaped local tables atomically, replays without duplicates, and preserves unrelated users', async () => {
  const pg = new PGlite(),
    users = createDemoUsers('2026-10-03');
  try {
    await prepareDemoDatabase(pg);
    await pg.query('insert into auth.users(id) values($1)', [users[1]!.userId]);
    await expect(seedDemoDatabase(pg, users)).rejects.toThrow('collides');
    expect((await pg.query('select * from wearable_accounts')).rows).toHaveLength(0);
    await pg.query('delete from auth.users where id=$1', [users[1]!.userId]);
    const unrelated = '90000000-0000-4000-8000-000000000001';
    await pg.query('insert into auth.users(id) values($1)', [unrelated]);
    await pg.query('insert into wearable_accounts(user_id) values($1)', [unrelated]);
    expect(await seedDemoDatabase(pg, users)).toEqual({ users: 3, nights: 549 });
    expect(await seedDemoDatabase(pg, users)).toEqual({ users: 3, nights: 549 });
    expect((await pg.query('select * from demo_profiles')).rows).toHaveLength(3);
    expect((await pg.query('select * from wearable_nights')).rows).toHaveLength(549);
    expect((await pg.query('select * from experiments')).rows).toHaveLength(3);
    expect((await pg.query('select * from experiment_check_ins')).rows).toHaveLength(126);
    const orphan =
      await pg.query(`select n.user_id from wearable_nights n left join wearable_raw_payloads r
      on r.id::text=n.record->>'rawPayloadId' and r.user_id=n.user_id where r.id is null`);
    expect(orphan.rows).toHaveLength(0);
    await pg.exec('set role anon');
    await expect(pg.query('select * from demo_profiles')).rejects.toThrow('permission denied');
    await pg.exec('reset role');
    await pg.query('delete from auth.users where id=$1', [users[0]!.userId]);
    expect((await pg.query('select * from wearable_nights')).rows).toHaveLength(366);
    expect((await pg.query('select * from demo_profiles')).rows).toHaveLength(2);
    expect(
      (await pg.query('select * from wearable_accounts where user_id=$1', [unrelated])).rows,
    ).toHaveLength(1);
  } finally {
    await pg.close();
  }
}, 60000);

it('refuses to add local auth fixtures to an existing unmarked database', async () => {
  const pg = new PGlite();
  try {
    await pg.exec('create table wearable_accounts(user_id uuid)');
    await expect(prepareDemoDatabase(pg)).rejects.toThrow('unmarked');
  } finally {
    await pg.close();
  }
}, 30000);
