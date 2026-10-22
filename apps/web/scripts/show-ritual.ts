/**
 * Plays golden people through the engine and prints what they would see: their first Ritual, what
 * Distill proposed, and every reply. For reading by eye, next to the scored run in eval-engine.ts.
 *
 *   pnpm ritual:show veer-00                 rules only, free
 *   pnpm ritual:show veer-00 maya-29 --claude  with Claude (needs ANTHROPIC_API_KEY), a few cents each
 */
import { existsSync, readFileSync } from 'node:fs';
import type { RitualPart } from '@distill/engine/ritual';
import { claudeClient } from '../lib/ai/engine/call';
import { engineCatalog } from '../lib/catalog/engine';
import { catalog } from '../lib/catalog/server';
import { exploreBank } from '../lib/explore/bank';
import { loadGolden, memoryDatabase, runGolden } from '../src/eval/golden';

const args = process.argv.slice(2);
const ids = args.filter((a) => !a.startsWith('--'));
const useClaude = args.includes('--claude');

const envFile = new URL('../.env.local', import.meta.url);
if (useClaude && !process.env.ANTHROPIC_API_KEY && existsSync(envFile))
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = /^ANTHROPIC_API_KEY=(.+)$/.exec(line.trim());
    if (m) process.env.ANTHROPIC_API_KEY = m[1]!.replace(/^["']|["']$/g, '');
  }

const slots = ['morning', 'midday', 'evening', 'night'] as const;
const dayNames = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };

function when(p: RitualPart): string {
  const days = p.when.days.length === 7 ? 'daily' : p.when.days.map((d) => dayNames[d]).join(' ');
  const times = p.when.perWeek && !p.when.days.length ? `${p.when.perWeek}x a week` : days;
  return [p.when.at, times, p.minutes ? `${p.minutes} min` : null, p.lock ? `locked: ${p.lock}` : null]
    .filter(Boolean)
    .join(' · ');
}

async function main() {
  const people = loadGolden().filter((p) => !ids.length || ids.includes(p.id));
  if (!people.length) throw new Error(`No golden person called ${ids.join(', ')}`);
  const db = await memoryDatabase();
  const client = useClaude ? claudeClient() : null;
  for (const person of people) {
    const t = await runGolden(person, {
      store: db.store,
      addUser: db.addUser,
      client,
      catalog: engineCatalog('live,reviewed'),
      toneRules: catalog.toneRules,
      bank: exploreBank,
    });
    const first = t.versions.find((v) => v.scope.kind === 'base');
    const out: string[] = [`\n# ${person.progress.name}: first Ritual (${useClaude ? 'with Claude' : 'rules only'})`];
    const summary = t.seen.find((s) => s.where === 'summary');
    if (summary) out.push('', summary.text);
    for (const slot of slots) {
      const parts = (first?.parts ?? []).filter((p) => p.when.slot === slot && p.status !== 'removed');
      if (!parts.length) continue;
      out.push('', `## ${slot[0]!.toUpperCase()}${slot.slice(1)}`);
      for (const p of parts.sort((a, b) => a.order - b.order))
        out.push(`- ${p.title} (${when(p)})`, `    ${p.why}`);
    }
    out.push('', '## What Distill proposed');
    out.push(...(t.decisions.length ? t.decisions.map((d) => `- ${d.kind} / ${d.reason}: ${d.line}`) : ['- Nothing.']));
    if (t.replies.length) {
      out.push('', '## Messages');
      for (const r of t.replies) out.push(`- You: "${r.message}"`, `  Distill${r.changed ? ' (changed your day)' : ''}: ${r.reply}`);
    }
    const dayEdits = t.versions.filter((v) => v.scope.kind === 'day');
    for (const v of dayEdits)
      out.push('', `## ${v.scope.kind === 'day' ? v.scope.date : ''} adjusted`, ...v.changes.map((c) => `- ${c.op} ${c.partId}: ${c.reason}`));
    out.push('', `${t.calls} Claude calls, $${t.costUsd.toFixed(3)}`);
    if (useClaude) {
      // Why a step kept the rules version: each Claude call's log row.
      const rows = await db.pg.query<{ payload: Record<string, unknown>; latency_ms: number | null }>(
        `select payload, latency_ms from public.engine_events where user_id = $1 and kind = 'llm.call' order by id`,
        [t.userId],
      );
      out.push('', '## Claude steps');
      for (const r of rows.rows) {
        const p = r.payload;
        const problems = Array.isArray(p.problems) && p.problems.length ? ` · problems: ${(p.problems as string[]).join(' | ')}` : '';
        out.push(`- ${String(p.step)}: ${String(p.from ?? p.stop ?? '')}, ${r.latency_ms ?? '?'} ms${problems}`);
      }
    }
    console.log(out.join('\n'));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : error);
  process.exitCode = 1;
});
