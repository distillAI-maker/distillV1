/**
 * The funnel in a terminal: the same report as the team page (/team), from public.app_events.
 *
 *   npx tsx apps/web/scripts/funnel.ts                 everyone, last 7 days
 *   npx tsx apps/web/scripts/funnel.ts 30d class       last 30 days, only people who came in on ?src=class
 *
 * Ranges: 24h, 7d, 30d, all. Needs DATABASE_URL (the Supabase connection string) in
 * apps/web/.env.local. docs/FUNNEL.md explains each number and has the same in SQL.
 */
import { existsSync } from 'node:fs';
import {
  buildReport,
  duration,
  funnelSql,
  isRange,
  loadTrails,
  percent,
  rangeStart,
  ranges,
} from '../src/server/funnel-report';

const envFile = new URL('../.env.local', import.meta.url);
if (existsSync(envFile)) process.loadEnvFile(envFile);
const sql = funnelSql();
if (!sql) throw new Error('Add DATABASE_URL to apps/web/.env.local');

const args = process.argv.slice(2);
const range = args.find(isRange) ?? '7d';
const source = args.find((a) => !isRange(a)) ?? null;
const now = Date.now();
const { trails, capped } = await loadTrails(sql, { from: rangeStart(range, now), source });
await sql.end();
const r = buildReport(trails, now);

const pad = (s: string | number, n: number) => String(s).padStart(n);
console.log(`Funnel: ${source ? `came in on "${source}"` : 'everyone'}, ${ranges[range].toLowerCase()}${capped ? ' (latest 5,000)' : ''}`);
console.log(
  `${r.people} started, ${r.finished} reached the app, ${r.stoppedTotal} stopped, ${r.stillGoing} still going. ` +
    `Median time to the app: ${duration(r.medianFinishMs)}.\n`,
);
console.log(`${'Screen'.padEnd(30)}${pad('Reached', 9)}${pad('', 6)}${pad('Stopped', 9)}${pad('Time', 9)}`);
for (const p of r.path)
  console.log(
    `${(p.id === r.biggestLoss ? '> ' : p.id === r.steepestLoss ? '* ' : '  ') + p.label.padEnd(28)}${pad(p.reached, 9)}${pad(percent(p.share), 6)}` +
      `${pad(p.stopped || '-', 9)}${pad(duration(p.medianMs), 9)}`,
  );
console.log('> most people stop here   * the steepest drop (largest share of who reach it)');
if (r.stopped.length) {
  console.log('\nWhere they were when they stopped:');
  for (const s of r.stopped) console.log(`  ${s.label.padEnd(28)}${pad(s.people, 9)}${pad(percent(s.share), 6)}${pad(duration(s.medianMs), 9)}`);
}
console.log('\nAlong the way:');
for (const t of r.taps) console.log(`  ${t.label.padEnd(40)}${pad(t.people, 6)}`);
console.log(`  ${'Opened the email link, any browser'.padEnd(40)}${pad(r.confirmedAnywhere, 6)}`);
console.log(`\nIn the app: ${r.app.people} opened it, ${r.app.signedIn} signed in, ${r.app.returned} came back another day.`);
for (const a of r.app.actions) if (a.people) console.log(`  ${a.label.padEnd(40)}${pad(a.people, 6)} (${a.times} times)`);
