import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { catalog } from '../../lib/catalog/server';
import { engineCatalog } from '../../lib/catalog/engine';
import { exploreBank } from '../../lib/explore/bank';
import { gates, loadGolden, memoryDatabase, runGolden, scores, type Transcript } from './golden';

/**
 * The hard gates on all 40 people, with Claude off: rules and fixed lines only. These are the
 * promises (never clear what is theirs, never touch a clinician's, never move a locked part, never
 * say what they asked us not to), so every one of them must hold without a model.
 */

const people = loadGolden();
let db: Awaited<ReturnType<typeof memoryDatabase>>;
const runs: Transcript[] = [];

beforeAll(async () => {
  db = await memoryDatabase();
  // The rows Claude checked count, as they will once Ishan sets them live.
  const view = engineCatalog('live,reviewed');
  for (const person of people)
    runs.push(await runGolden(person, { store: db.store, addUser: db.addUser, client: null, catalog: view, toneRules: catalog.toneRules, bank: exploreBank }));
}, 240_000);
afterAll(async () => {
  await db?.pg.close();
});

describe('the golden set', () => {
  it('has at least 40 people with the coverage the brief asks for', () => {
    expect(people.length).toBeGreaterThanOrEqual(40);
    const count = (tag: string) => people.filter((p) => p.covers.includes(tag)).length;
    for (const tag of ['stack:1-4', 'stack:5-9', 'stack:10+', 'wearable:none', 'wearable:oura', 'wearable:whoop']) expect(count(tag), tag).toBeGreaterThanOrEqual(10);
    expect(count('borrowed')).toBeGreaterThanOrEqual(12);
    expect(count('skin-derm')).toBeGreaterThanOrEqual(2);
  });
  it('keeps every promise for every person, with no model', () => {
    const failures = runs.flatMap((t) => gates(t).map((f) => `${t.person.id}: ${f}`));
    expect(failures).toEqual([]);
  });
  it('makes and keeps a first Ritual for everyone', () => {
    for (const t of runs) expect(t.final.ritual.status, t.person.id).toBe('accepted');
  });
  it('places things as often as they said, with their ideal day filling in only the gaps', () => {
    const part = (personId: string, partId: string) => {
      const t = runs.find((r) => r.person.id === personId)!;
      return t.versions.find((v) => v.scope.kind === 'base')?.parts.find((p) => p.id === partId);
    };
    // Their own count wins over their ideal day: 19 matchas in 30 days, 9 Solidcore visits.
    expect(part('sofia-23', 'part:sofia-matcha')?.when).toMatchObject({ days: [], perWeek: 4 });
    expect(part('tess-37', 'part:tess-solidcore')?.when).toMatchObject({ days: [], perWeek: 2 });
    // Weak evidence of a cost, and nothing good said about it: on their list, never planned. A row's name gives the minutes.
    expect(part('rohan-18', 'part:rohan-screens')).toBeUndefined();
    expect(part('rohan-18', 'part:rohan-sun')?.minutes).toBe(10);
    // His coach wants him to stop looking at the score: proposed for clearing, never planned.
    expect(part('omar-33', 'part:omar-score')).toBeUndefined();
    // "Every other day" from her OB is about four times a week, not daily.
    expect(part('grace-34', 'part:grace-iron')?.when).toMatchObject({ days: [], perWeek: 4 });
    // Two of ten classes and none in 70 days: on her list, not in her week.
    expect(part('grace-34', 'part:grace-pilates')).toBeUndefined();
    // His psychiatrist's, with no time in his words: every day, no made-up evening.
    expect(part('kenji-26', 'part:kenji-vyvanse')?.when).toMatchObject({ slot: 'midday', days: [], perWeek: 7 });
    // No count at all, and their ideal day names it: daily.
    expect(part('veer-00', 'part:veer-meditation')?.when.days).toHaveLength(7);
  });
  it('reports how much of what a careful friend would clear it found', () => {
    const s = runs.map((t) => ({ id: t.person.id, ...scores(t) }));
    const withExpected = s.filter((x) => people.find((p) => p.id === x.id)!.expect.clearExpected.length);
    const recall = withExpected.reduce((t, x) => t + x.clearRecall, 0) / Math.max(1, withExpected.length);
    // Logged for the report; the bar is set once Ishan has reviewed the V4 rows.
    console.info(`golden: clear recall ${(recall * 100).toFixed(0)}% over ${withExpected.length} people`);
    console.info(s.filter((x) => x.missedClears.length).map((x) => `  ${x.id} missed ${x.missedClears.join(', ')}`).join('\n'));
    expect(recall).toBeGreaterThanOrEqual(0);
  });
});
