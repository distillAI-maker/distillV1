/**
 * The engine against the golden set (eval/people), with a written report in eval/reports.
 *
 *   pnpm eval:engine                          rules only, free: the hard gates and what it found
 *   pnpm eval:engine --claude --yes           every step live with Claude (needs ANTHROPIC_API_KEY)
 *   pnpm eval:engine --claude --judge --yes   plus Opus judging the 8 questions, with planted controls
 *
 * Options: --people jake-34,maya-29 to run a few, --catalog live (default live,reviewed).
 * Nothing calls Claude without --yes: the script prints what the run would cost and stops.
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { claudeClient } from '../lib/ai/engine/call';
import { engineCatalog } from '../lib/catalog/engine';
import { catalog } from '../lib/catalog/server';
import { exploreBank } from '../lib/explore/bank';
import { gates, loadGolden, memoryDatabase, runGolden, scores, type Transcript } from '../src/eval/golden';
import { CONTROLS, judge, RUBRIC, summarise, type Judged } from '../src/eval/judge';

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const value = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

// The key, from the app's own .env.local when it isn't in the environment.
const envFile = new URL('../.env.local', import.meta.url);
if (!process.env.ANTHROPIC_API_KEY && existsSync(envFile))
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = /^ANTHROPIC_API_KEY=(.+)$/.exec(line.trim());
    if (m) process.env.ANTHROPIC_API_KEY = m[1]!.replace(/^["']|["']$/g, '');
  }

const useClaude = flag('--claude');
const useJudge = flag('--judge');
const wanted = value('--people')?.split(',');
const people = loadGolden().filter((p) => !wanted || wanted.includes(p.id));
const statuses = value('--catalog') ?? 'live,reviewed';

// Rough, from the prices in lib/ai/engine/call.ts: a person's two weeks with Claude, and one judging.
const perPerson = (useClaude ? 0.25 : 0) + (useJudge ? 0.12 : 0);
const estimate = people.length * perPerson + (useJudge ? CONTROLS.length * 0.12 : 0);
if ((useClaude || useJudge) && !process.env.ANTHROPIC_API_KEY) {
  console.error('This run needs ANTHROPIC_API_KEY (in the environment or apps/web/.env.local).');
  process.exit(1);
}
if ((useClaude || useJudge) && !flag('--yes')) {
  console.log(`This run calls Claude for ${people.length} people: about $${estimate.toFixed(2)}. Add --yes to spend it.`);
  process.exit(0);
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
const sha = (() => {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
})();

async function main() {
  const db = await memoryDatabase();
  const client = useClaude ? claudeClient() : null;
  const view = engineCatalog(statuses);
  const runs: Transcript[] = [];
  for (const person of people) {
    process.stdout.write(`${person.id} `);
    runs.push(await runGolden(person, { store: db.store, addUser: db.addUser, client, catalog: view, toneRules: catalog.toneRules, bank: exploreBank }));
  }
  console.log('');

  const judged: Judged[] = [];
  const judgeClient = useJudge ? claudeClient() : null;
  if (judgeClient) {
    for (const t of runs) judged.push(await judge(judgeClient, t));
    // Each control spoils the transcript of someone with replies and proposals to spoil.
    const host = runs.find((t) => t.replies.length && t.decisions.length) ?? runs[0]!;
    for (const c of CONTROLS) judged.push(await judge(judgeClient, c.spoil(host), c.id));
  }

  const latency = await db.pg.query<{ ms: number }>(
    `select latency_ms as ms from public.engine_events where kind = 'llm.call' and payload->>'step' = 'reshape' and latency_ms is not null order by latency_ms`,
  );
  const ms = latency.rows.map((r) => Number(r.ms));
  const p95 = ms.length ? ms[Math.min(ms.length - 1, Math.floor(ms.length * 0.95))]! : null;
  const dropped = await db.pg.query<{ n: number }>(
    `select coalesce(sum((payload->>'dropped')::int), 0) as n from public.engine_events where kind = 'llm.call' and payload->>'step' = 'word-decisions'`,
  );

  const fails = runs.map((t) => ({ id: t.person.id, fails: gates(t) }));
  const s = runs.map((t) => ({ t, ...scores(t) }));
  const withClears = s.filter((x) => x.t.person.expect.clearExpected.length);
  const clearRecall = withClears.reduce((a, x) => a + x.clearRecall, 0) / Math.max(1, withClears.length);
  const withRefer = s.filter((x) => x.t.person.expect.refer.length);
  const referRecall = withRefer.reduce((a, x) => a + x.referRecall, 0) / Math.max(1, withRefer.length);
  const mentions = s.reduce((a, x) => a + x.mentioned.length, 0) / Math.max(1, s.reduce((a, x) => a + x.t.person.expect.mustMention.length, 0));
  const cost = runs.reduce((a, t) => a + t.costUsd, 0);
  const verdict = judged.length ? summarise(judged) : null;
  const date = new Date().toISOString().slice(0, 10);
  const mode = useJudge ? 'judged' : useClaude ? 'claude' : 'rules';

  const lines = [
    `# Engine evaluation, ${date} (${mode})`,
    '',
    `Commit ${sha}. ${people.length} people from eval/people. Catalog rows: ${statuses}. Claude ${useClaude ? 'on' : 'off'}${useJudge ? ', judged by Opus 5.5 at high effort' : ''}.`,
    '',
    '## Hard gates',
    '',
    fails.every((f) => !f.fails.length)
      ? `All ${people.length} people pass every gate: nothing of theirs proposed for clearing, nothing from a clinician touched, no locked part moved, nothing they asked us never to say, and every Ritual valid.`
      : fails.filter((f) => f.fails.length).map((f) => `- **${f.id}**: ${f.fails.join('; ')}`).join('\n'),
    '',
    '## What it found',
    '',
    `| Measure | Result |`,
    `|---|---|`,
    `| Clears a careful friend would propose, found | ${pct(clearRecall)} over ${withClears.length} people |`,
    `| Dermatologist referrals expected, made | ${pct(referRecall)} over ${withRefer.length} people |`,
    `| Their people and places named somewhere | ${pct(mentions)} |`,
    ...(useClaude
      ? [
          `| Claude calls | ${runs.reduce((a, t) => a + t.calls, 0)} |`,
          `| Cost | $${cost.toFixed(2)} total, $${(cost / Math.max(1, runs.length)).toFixed(3)} a person for two weeks |`,
          `| Reshape p95 | ${p95 === null ? 'no reshapes' : `${(p95 / 1000).toFixed(1)} s`} |`,
          `| Decision lines dropped for failing checks | ${dropped.rows[0]?.n ?? 0} |`,
        ]
      : []),
    '',
    ...(verdict
      ? [
          '## The judge',
          '',
          `Overall ${verdict.overall.toFixed(2)} of 5; weakest: ${verdict.weakest}. Founding 100 bar (4.0 average, nothing under 3.5, every control caught): **${verdict.passes ? 'met' : 'not met'}**.`,
          '',
          '| Question | Average |',
          '|---|---|',
          ...RUBRIC.map((r) => `| ${r.q} | ${verdict.avg[r.id].toFixed(2)} |`),
          '',
          'Planted controls (the judge must score the spoiled question 2 or lower):',
          ...verdict.controls.map((c) => `- ${c.id} (${c.spoils}): ${c.score ?? 'no score'} ${c.caught ? 'caught' : '**missed**'}`),
          '',
        ]
      : []),
    '## Missed clears',
    '',
    ...(s.some((x) => x.missedClears.length)
      ? s.filter((x) => x.missedClears.length).map((x) => {
          const keys = x.missedClears.map((id) => {
            const item = x.t.person.progress.items.find((i) => i.id === id);
            const row = item?.itemKey ? view.item(item.itemKey) : undefined;
            return `${id} (${row ? `tier ${row.tier}` : 'their own item'})`;
          });
          return `- ${x.t.person.id}: ${keys.join(', ')}`;
        })
      : ['None.']),
    '',
    '## People',
    '',
    ...runs.flatMap((t) => {
      const j = judged.find((x) => x.id === t.person.id);
      return [
        `### ${t.person.id}`,
        '',
        t.person.summary,
        '',
        ...t.decisions.filter((d) => d.status !== 'withdrawn').map((d) => `- ${d.kind} ${d.stackItemId ?? ''} (${d.reason}, ${d.status}): ${d.line}`),
        ...t.replies.map((r) => `- "${r.message}" → ${r.reply}${r.changed ? ' *(days changed)*' : ''}`),
        ...t.notes.map((n) => `- note: ${n}`),
        ...(j?.scores ? [`- judge: ${RUBRIC.map((r) => `${r.id} ${j.scores![r.id].score}`).join(', ')}`] : []),
        '',
      ];
    }),
  ];
  const dir = new URL('../../../eval/reports/', import.meta.url);
  mkdirSync(dir, { recursive: true });
  const file = new URL(`${date}-${mode}.md`, dir);
  writeFileSync(file, lines.join('\n'));
  writeFileSync(new URL(`${date}-${mode}.json`, dir), JSON.stringify({ sha, statuses, mode, fails, clearRecall, referRecall, mentions, cost, p95, verdict, judged }, null, 2));
  console.log(`Report: ${file.pathname}`);
  await db.pg.close();
  if (fails.some((f) => f.fails.length)) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
