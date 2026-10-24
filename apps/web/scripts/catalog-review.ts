/**
 * The catalog rows Distill can suggest dropping, laid out for Veer to read as a member would: the
 * question it asks when it isn't sure, the line suggesting letting it go (or a swap), the reason if
 * asked, and any swap. Lines come from the engine's own fixed wording (what people see with Claude
 * off, and what Claude starts from).
 *
 *   pnpm catalog:review [out.json]    writes eval/review/catalog.json
 */
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DecisionDraft } from '@distill/engine/ritual';
import raw from '../../../data/catalog-v4.json';
import { fallbackLine } from '../lib/ai/engine/word-decisions';
import { catalog } from '../lib/catalog/server';

type Row = (typeof raw.items)[number];
const out = process.argv[2] ?? fileURLToPath(new URL('../../../eval/review/catalog.json', import.meta.url));
const sha = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
const banned = catalog.toneRules.bannedPhrases;

const draft = (r: Row, kind: DecisionDraft['kind'], reason: DecisionDraft['reason'], money: number): DecisionDraft => ({
  key: `${r.key}:${kind}`,
  stackItemId: r.key,
  itemKey: r.key,
  kind,
  reason,
  evidenceTier: r.evidenceTier as DecisionDraft['evidenceTier'],
  money,
  name: r.shortName || r.name,
  context: {
    ...(r.fitsInstead ? { fitsInstead: r.fitsInstead } : {}),
    ...(r.humanQuestion ? { humanQuestion: r.humanQuestion } : {}),
    evidenceFor: r.evidenceFor,
    evidenceSummary: r.evidenceSummary,
  },
});

const sourcesOf = (r: Row) => (Array.isArray(r.sources) ? r.sources : []);

const rows = raw.items
  .map((r) => {
    const weak = r.evidenceTier === 'D' || r.evidenceTier === 'N';
    const habit = !weak && r.clearWhen.includes('UNLOVED_HABIT');
    if (!weak && !habit) return null;
    const cost = Number(r.costMonthUsd) || 0;
    return {
      key: r.key,
      name: r.name,
      shortName: r.shortName || r.name,
      group: weak ? 'weak' : 'habit',
      tier: r.evidenceTier,
      kind: r.kind,
      monthly: cost,
      evidenceFor: r.evidenceFor,
      sources: sourcesOf(r).length,
      lines: {
        ask: weak ? fallbackLine(draft(r, 'curate', 'WORTH_A_LOOK', 0), banned) : null,
        letGo: weak ? fallbackLine(draft(r, 'clear', 'BORROWED_WEAK', cost), banned) : null,
        swap: habit ? fallbackLine(draft(r, 'clear', 'UNLOVED_HABIT', 0), banned) : null,
        why: r.evidenceSummary,
        question: r.humanQuestion,
        instead: r.fitsInstead,
      },
      neverWhen: ['THEIRS', 'LOVED'].filter((k) => r.keepWhen.includes(k as never)),
      safety: (r as { safety?: { condition: string; action: string; note: string }[] }).safety ?? [],
    };
  })
  .filter((x): x is NonNullable<typeof x> => !!x)
  .sort((a, b) => (a.group === b.group ? a.name.localeCompare(b.name) : a.group === 'weak' ? -1 : 1));

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ sha, made: new Date().toISOString(), rows }, null, 2));
console.log(`Wrote ${rows.length} rows to ${out}`);
