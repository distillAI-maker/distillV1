/**
 * The golden set, laid out for a person to review: each test person's list, their words, what
 * happens to them over two weeks, the answer key, and everything Distill decided and said.
 *
 *   pnpm golden:review [out.json]     rules only, free (Claude off), catalog rows: live
 *
 * Writes eval/review/people.json unless given a path. The review page reads this file.
 */
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { valuableQuestions, type RitualPart, type StackItemLike } from '@distill/engine/ritual';
import { engineCatalog } from '../lib/catalog/engine';
import { catalog } from '../lib/catalog/server';
import { exploreBank } from '../lib/explore/bank';
import { gates, loadGolden, memoryDatabase, runGolden, scores } from '../src/eval/golden';

const out = process.argv[2] ?? fileURLToPath(new URL('../../../eval/review/people.json', import.meta.url));
const sha = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
const DAYS: Record<string, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };

const hm = (min: number) => `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m`;

/** "Weekdays, 7:00", "Sat", "3 times a week", "Every day": when a part happens, in words. */
function whenOf(p: RitualPart): string {
  const d = p.when.days;
  const days =
    d.length === 7 || (!d.length && !p.when.perWeek)
      ? 'Every day'
      : d.length === 5 && !d.includes('sat') && !d.includes('sun')
        ? 'Weekdays'
        : d.length === 2 && d.includes('sat') && d.includes('sun')
          ? 'Weekends'
          : d.length
            ? d.map((x) => DAYS[x]).join(' ')
            : `${p.when.perWeek} ${p.when.perWeek === 1 ? 'time' : 'times'} a week`;
  return [days, p.when.at].filter(Boolean).join(', ');
}

async function main() {
  const db = await memoryDatabase();
  const view = engineCatalog('live');
  const people = [];
  for (const person of loadGolden()) {
    process.stdout.write(`${person.id} `);
    const t = await runGolden(person, { store: db.store, addUser: db.addUser, client: null, catalog: view, toneRules: catalog.toneRules, bank: exploreBank });
    const s = scores(t);
    const nameOf = (id: string | null | undefined) => {
      const i = person.progress.items.find((x) => x.id === id);
      if (!i) return id ?? '';
      return i.label ?? i.customName ?? (i.itemKey ? (view.item(i.itemKey)?.name ?? i.itemKey) : i.id);
    };
    const first = t.versions.find((v) => v.scope.kind === 'base' && !v.parentId);
    const p = person.progress;
    // What Distill would ask next, once the two weeks are over: the cards it still has for them.
    const model = await db.store.person(t.userId);
    const gone = new Set(t.decisions.filter((d) => d.kind === 'clear' && d.status === 'yes' && d.reason !== 'UNLOVED_HABIT').map((d) => d.stackItemId));
    const stack: StackItemLike[] = p.items.map((i) => (gone.has(i.id) ? { ...i, status: 'cut' as const } : i));
    const asks = model
      ? valuableQuestions({
          person: model,
          stack,
          catalog: view,
          history: t.decisions.map((d) => ({ stackItemId: d.stackItemId, kind: d.kind, reason: d.reason, status: d.status, ...(d.answeredAt ? { answeredAt: d.answeredAt } : {}) })),
          today: t.final.ritual.today.date,
        })
      : [];
    people.push({
      id: person.id,
      summary: person.summary,
      draftedBy: person.draftedBy,
      covers: person.covers,
      timeZone: person.timeZone,
      wearable: p.dataSource ?? null,
      /** Their usual night, which the test plays as four weeks of ordinary nights before the two weeks. */
      usualSleep: p.dataSource ? hm(person.usualSleepMin ?? 420) : null,
      list: p.items.map((i) => ({
        id: i.id,
        name: nameOf(i.id),
        catalog: i.itemKey ? (view.item(i.itemKey)?.name ?? i.itemKey) : null,
        tier: i.itemKey ? (view.item(i.itemKey)?.tier ?? null) : null,
        /** The grade is for a cost (late caffeine, a nightcap), not a benefit. */
        cost: view.item(i.itemKey)?.evidenceDirection === 'cost',
        monthly: i.monthlyCost,
        origin: i.origin ?? null,
        answers: i.answers,
        notes: i.notes.map((n) => n.text),
      })),
      words: {
        idealDay: p.lifeText,
        asks: p.asks.map((a) => ({ q: a.q, a: a.a })),
      },
      events: person.events.map((e) =>
        e.kind === 'note'
          ? { kind: 'note', on: nameOf(e.stackItemId), text: e.text }
          : e.kind === 'message'
            ? { kind: 'message', text: e.text }
            : e.kind === 'answer'
              ? { kind: 'answer', q: e.q, a: e.a }
              : e.kind === 'night'
                ? { kind: 'night', text: `A short night: ${hm(e.sleepMin)} of sleep on ${e.date} (usually about ${hm(person.usualSleepMin ?? 420)})` }
                : { kind: 'decision-answer', on: nameOf(e.stackItemId), text: e.answer },
      ),
      expect: {
        keep: person.expect.keep.map(nameOf),
        clearExpected: person.expect.clearExpected.map(nameOf),
        clearAllowed: person.expect.clearAllowed.filter((x) => !person.expect.clearExpected.includes(x)).map(nameOf),
        refer: person.expect.refer.map(nameOf),
        neverTouch: person.expect.neverTouch,
        neverSay: person.expect.neverSay,
        mustMention: person.expect.mustMention,
        notes: person.expect.notes,
      },
      distill: {
        decisions: t.decisions
          .filter((d) => d.status !== 'withdrawn')
          .map((d) => ({ kind: d.kind, item: nameOf(d.stackItemId), reason: d.reason, status: d.status, line: d.line })),
        firstRitual: (first?.parts ?? [])
          .filter((x) => x.status === 'active')
          .map((x) => ({ title: x.title, slot: x.when.slot, when: whenOf(x), why: x.why, yours: x.lock === 'theirs', clinician: x.lock === 'clinician' })),
        replies: t.replies,
        notes: t.notes,
        gateFails: gates(t),
        missedClears: s.missedClears.map(nameOf),
        missingMentions: s.missingMentions,
        asks: asks.map((q) => ({ item: nameOf(q.stackItemId), text: q.text, options: q.options.map((o) => o.label) })),
      },
    });
  }
  console.log('');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ sha, catalog: 'live', claude: false, made: new Date().toISOString(), people }, null, 2));
  console.log(`Wrote ${people.length} people to ${out}`);
  await db.pg.close();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
