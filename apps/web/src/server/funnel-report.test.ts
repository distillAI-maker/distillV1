import { describe, expect, it } from 'vitest';
import type { ScreenId } from '../../lib/funnel';
import { buildReport, duration, IDLE_MS, rangeStart, type Step, type Trail } from './funnel-report';

const T0 = Date.parse('2026-11-07T18:00:00Z'); // 10 am in Berkeley
const NOW = T0 + 2 * 60 * 60_000;
const GAP = 10_000;

const PATH: ScreenId[] = [
  'opener',
  'name',
  'stack_tap',
  'stack_list',
  'number',
  'study_feed',
  'study_keep',
  'study_day',
  'study_reach',
  'study_busy',
  'study_people',
  'study_read',
  'reveal_wait',
  'reveal',
  'email',
  'email_done',
  'ritual',
];

/** A device walking these screens GAP apart, from `start`. */
function walk(
  device: string,
  shown: ScreenId[],
  { start = T0, source = null, signedIn = false, then = [] }: { start?: number; source?: string | null; signedIn?: boolean; then?: Step[] } = {},
): Trail {
  const steps: Step[] = shown.map((s, i) => [start + i * GAP, 'screen', s, i ? shown[i - 1]! : null, i ? GAP : null, signedIn]);
  return { device, source, steps: [...steps, ...then] };
}
const upTo = (s: ScreenId) => PATH.slice(0, PATH.indexOf(s) + 1);
const endOf = (t: Trail) => t.steps[t.steps.length - 1]![0];

describe('the funnel report', () => {
  const finished = walk('a', PATH, { then: [[T0 + 26 * 60 * 60_000, 'screen', 'things', 'ritual', null, false]] });
  const atDay = walk('b', upTo('study_day'));
  const leftDay: Step = [endOf(atDay) + 9000, 'left', 'study_day', null, 9000, false];
  atDay.steps.push(leftDay);
  const atName = walk('c', upTo('name'), { source: 'class' });
  const going = walk('d', upTo('study_keep'), { start: NOW - 5 * 60_000 - GAP * 6 });
  // Saw their Ritual, went back to change something, and left on the study.
  const backToStudy = walk('e', [...upTo('reveal'), 'study_people'], {
    then: [[T0 + 15 * GAP, 'change_something', null, null, null, false]],
  });
  // The email link opened in the mail app's browser: a new device, straight into the app, signed in.
  const otherBrowser: Trail = {
    device: 'f',
    source: null,
    steps: [
      [T0 + 3_600_000, 'arrived', null, null, null, true],
      [T0 + 3_600_500, 'screen', 'ritual', null, null, true],
      [T0 + 3_601_000, 'email_confirmed', null, null, null, true],
    ],
  };
  const olderRows: Trail = {
    device: 'g',
    source: null,
    steps: [
      [T0, 'arrived', null, null, null, false],
      [T0 + 1000, 'started', null, null, null, false],
    ],
  };
  const r = buildReport([finished, atDay, atName, going, backToStudy, otherBrowser, olderRows], NOW);
  const row = (id: string) => r.path.find((p) => p.id === id)!;

  it('counts everyone who saw an onboarding screen, and how far each got', () => {
    expect(r.people).toBe(5);
    expect(r.finished).toBe(1);
    expect(r.stillGoing).toBe(1);
    expect(r.stoppedTotal).toBe(3);
    expect(r.path.map((p) => p.id)).toEqual([...PATH.slice(0, -1), 'app']);
    expect(row('opener').reached).toBe(5);
    expect(row('name').reached).toBe(5);
    expect(row('stack_tap').reached).toBe(4);
    expect(row('study_day').reached).toBe(3);
    expect(row('study_reach').reached).toBe(2);
    expect(row('reveal').reached).toBe(2);
    expect(row('email').reached).toBe(1);
    expect(row('app').reached).toBe(1);
    expect(row('app').share).toBeCloseTo(0.2);
  });

  it('puts each person who stopped at the furthest screen they reached, never the ones still going', () => {
    expect(row('name').stopped).toBe(1);
    expect(row('study_day').stopped).toBe(1);
    expect(row('reveal').stopped).toBe(1);
    expect(row('study_keep').stopped).toBe(0);
    expect(row('study_day').stoppedShare).toBeCloseTo(1 / 3);
    expect(r.biggestLoss).toBe('name');
    // Only the name has enough people (5) for its share to count, so it's the steepest too.
    expect(r.steepestLoss).toBe('name');
  });

  it('names the steepest drop by share once enough people reach a screen', () => {
    const many = [
      ...Array.from({ length: 6 }, (_, i) => walk(`m${i}`, upTo('name'))),
      ...Array.from({ length: 6 }, (_, i) => walk(`e${i}`, upTo(i < 4 ? 'email' : 'email_done'))),
    ];
    const big = buildReport(many, NOW);
    expect(big.biggestLoss).toBe('name');
    expect(big.steepestLoss).toBe('email');
    expect(big.path.find((p) => p.id === 'email')!.stoppedShare).toBeCloseTo(4 / 6);
  });

  it('lists the last screen they saw, with the time the page said they stayed', () => {
    expect(r.stopped.map((s) => [s.id, s.people])).toEqual([
      ['name', 1],
      ['study_day', 1],
      ['study_people', 1],
    ]);
    expect(r.stopped.find((s) => s.id === 'study_day')!.medianMs).toBe(9000);
    expect(r.stopped.find((s) => s.id === 'name')!.medianMs).toBeNull();
  });

  it('times each screen from the moment it showed to the next one', () => {
    expect(row('name').medianMs).toBe(GAP);
    expect(row('name').timed).toBe(4);
    expect(row('email_done').medianMs).toBe(GAP);
    expect(r.medianFinishMs).toBe((PATH.length - 1) * GAP);
  });

  it('counts the email link wherever it opened, and the app for anyone who reached it', () => {
    expect(r.confirmedAnywhere).toBe(1);
    expect(r.taps.find((t) => t.id === 'email_confirmed')!.people).toBe(0);
    expect(r.taps.find((t) => t.id === 'change_something')!.people).toBe(1);
    expect(r.app).toMatchObject({ people: 2, signedIn: 1, demo: 1, returned: 1 });
    expect(r.app.tabs.find((t) => t.id === 'ritual')!.people).toBe(2);
    expect(r.app.tabs.find((t) => t.id === 'things')!.people).toBe(1);
  });

  it('splits by source and by day, and keeps the older milestones', () => {
    expect(r.sources).toEqual([
      { source: 'direct', people: 4, finished: 1 },
      { source: 'class', people: 1, finished: 0 },
    ]);
    expect(r.days).toEqual([{ day: '2026-11-07', people: 5, finished: 1 }]);
    expect(r.milestones.find((m) => m.id === 'arrived')!.people).toBe(2);
    expect(r.milestones.find((m) => m.id === 'started')!.people).toBe(1);
  });

  it('calls someone still going until they have been quiet for half an hour', () => {
    const quiet = walk('h', upTo('number'), { start: NOW - IDLE_MS - 10 * GAP });
    expect(buildReport([quiet], NOW)).toMatchObject({ stillGoing: 0, stoppedTotal: 1 });
    const fresh = walk('i', upTo('number'), { start: NOW - IDLE_MS + 60_000 });
    expect(buildReport([fresh], NOW)).toMatchObject({ stillGoing: 1, stoppedTotal: 0 });
  });

  it('is empty, not wrong, with nobody in it', () => {
    const empty = buildReport([], NOW);
    expect(empty.people).toBe(0);
    expect(empty.biggestLoss).toBeNull();
    expect(empty.path.every((p) => p.reached === 0 && p.share === 0)).toBe(true);
  });
});

describe('report helpers', () => {
  it('words times short', () => {
    expect(duration(null)).toBe('–');
    expect(duration(42_400)).toBe('42s');
    expect(duration(185_000)).toBe('3m 05s');
    expect(duration(3_720_000)).toBe('1h 02m');
  });

  it('starts each range that far back, and all time at the beginning', () => {
    expect(rangeStart('24h', NOW).getTime()).toBe(NOW - 864e5);
    expect(rangeStart('7d', NOW).getTime()).toBe(NOW - 7 * 864e5);
    expect(rangeStart('all', NOW).getTime()).toBe(0);
  });
});
