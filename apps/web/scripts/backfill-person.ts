/**
 * Builds a person model for everyone who already has saved progress, so the engine starts from
 * what they told the app rather than from nothing. Safe to rerun: existing models are left alone.
 *
 *   pnpm engine:backfill            dry run: counts what it would write
 *   pnpm engine:backfill --write    writes person_models rows (built_from 'progress-v1')
 *
 * Needs DATABASE_URL in your shell (Supabase, Project Settings, Database, the pooled connection
 * string). It stays in your shell: never paste it into a file in the repo.
 */
import { database, sql } from '@distill/data';
import { localDate, personFromProgress } from '@distill/engine/ritual';
import { progressSchema } from '../lib/progress/types';
import { EngineStore } from '../src/server/engine-store';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('Set DATABASE_URL in your shell first.');
    process.exitCode = 1;
    return;
  }
  const write = process.argv.includes('--write');
  const { db, close } = database(url);
  const store = new EngineStore(db);
  const today = localDate(new Date().toISOString(), 'America/Los_Angeles');
  const result = await db.execute(sql`select j.user_id, j.progress from public.app_journeys j
    left join public.person_models m on m.user_id = j.user_id where m.user_id is null`);
  const rows = (Array.isArray(result) ? result : (result as { rows: unknown[] }).rows) as { user_id: string; progress: unknown }[];
  let built = 0;
  let skipped = 0;
  for (const row of rows) {
    const parsed = progressSchema.safeParse(row.progress);
    if (!parsed.success) {
      skipped++;
      continue;
    }
    const person = personFromProgress(parsed.data, { personId: row.user_id, timeZone: 'America/Los_Angeles', today });
    if (write) {
      await store.savePerson(row.user_id, person, 'progress-v1');
      await store.log({ userId: row.user_id, kind: 'person.built', payload: { from: 'progress-v1', items: parsed.data.items.length } });
    }
    built++;
  }
  console.log(`${write ? 'Built' : 'Would build'} ${built} person models; ${skipped} saved progress rows didn't parse and were left alone.`);
  await close();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : 'backfill failed');
  process.exitCode = 1;
});
