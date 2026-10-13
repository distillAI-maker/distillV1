/**
 * The launch funnel: how many devices reached each step (lib/funnel.ts), from public.app_events.
 *
 *   npx tsx apps/web/scripts/funnel.ts          everyone
 *   npx tsx apps/web/scripts/funnel.ts class    only people who came in on ?src=class
 *
 * Needs DATABASE_URL (the Supabase connection string) in apps/web/.env.local. The same query runs
 * in Supabase's SQL editor: see docs/FUNNEL.md.
 */
import { existsSync } from 'node:fs';
import postgres from 'postgres';
import { funnelEvents } from '../lib/funnel';

const envFile = new URL('../.env.local', import.meta.url);
if (existsSync(envFile)) process.loadEnvFile(envFile);
if (!process.env.DATABASE_URL) throw new Error('Add DATABASE_URL to apps/web/.env.local');

const source = process.argv[2] ?? null;
const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
const rows = await sql<{ event: string; devices: number }[]>`
  select event, count(distinct device)::int as devices
  from public.app_events
  where ${source}::text is null or source = ${source}
  group by event`;
await sql.end();

const reached = new Map(rows.map((r) => [r.event, r.devices]));
const top = reached.get('arrived') ?? reached.get('started') ?? 0;
console.log(source ? `Funnel: came in on "${source}"` : 'Funnel: everyone');
for (const event of funnelEvents) {
  const n = reached.get(event) ?? 0;
  const share = top ? `  ${Math.round((n / top) * 100)}%` : '';
  console.log(`${event.padEnd(16)}${String(n).padStart(6)}${share}`);
}
