import { describe, expect, it } from 'vitest';
import { agreement, CONTROLS, summarise, TESTS, type Grade, type Judged, type TestId, type Verdicts } from './judge';

/** The JUDGE's arithmetic, with no key: how verdicts are counted, and how it's measured against Veer. */

function verdicts(failed: TestId[] = [], headline: 'pass' | 'fail' = 'pass'): Verdicts {
  return {
    tests: Object.fromEntries(TESTS.map((t) => [t.id, { quote: '', critique: '', verdict: failed.includes(t.id) ? 'fail' : t.id === 'T7' ? 'skip' : 'pass' }])) as Verdicts['tests'],
    headline: { critique: '', verdict: headline },
  };
}
const judged = (id: string, failed: TestId[] = [], headline: 'pass' | 'fail' = 'pass'): Judged => ({
  id,
  control: id.startsWith('control-'),
  verdicts: verdicts(failed, headline),
  pass: headline === 'pass' && !failed.length,
});
const grade = (id: string, verdict: 'pass' | 'fail'): Grade => ({ id, verdict, critique: '', failed: [], grader: 'veer', split: 'dev' });

describe('the JUDGE', () => {
  it('has one planted control for every test', () => {
    expect(new Set(CONTROLS.map((c) => c.spoils))).toEqual(new Set(TESTS.map((t) => t.id)));
  });

  it('counts the share passing, fail rates without skips, and caught controls', () => {
    const s = summarise([
      judged('a'),
      judged('b', ['T3']),
      judged('c', [], 'fail'),
      judged('d'),
      ...CONTROLS.map((c) => judged(c.id, [c.spoils])),
    ]);
    expect(s.judged).toBe(4);
    expect(s.passRate).toBe(0.5);
    expect(s.failRate.T3).toBe(0.25);
    expect(s.failRate.T7).toBe(0); // skipped everywhere, never a free pass or a fail
    expect(s.controls.every((c) => c.caught)).toBe(true);
    expect(s.passes).toBe(false); // 50% is under the 90% bar
  });

  it('a missed control fails the bar however well the people do', () => {
    const s = summarise([judged('a'), ...CONTROLS.map((c) => judged(c.id, c.spoils === 'T5' ? [] : [c.spoils]))]);
    expect(s.controls.find((c) => c.spoils === 'T5')!.caught).toBe(false);
    expect(s.passes).toBe(false);
  });

  it('measures agreement with a human as hit rates and kappa, not raw agreement', () => {
    // The human fails 2 of 10; a JUDGE that passes everyone agrees 80% of the time and catches nothing.
    const humans = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'].map((id, i) => grade(id, i < 2 ? 'fail' : 'pass'));
    const lenient = agreement(humans.map((g) => judged(g.id)), humans);
    expect(lenient.observed).toBe(0.8);
    expect(lenient.failsCaught).toBe(0);
    expect(lenient.kappa).toBe(0);
    const good = agreement(humans.map((g) => judged(g.id, g.verdict === 'fail' ? ['T1'] : [])), humans);
    expect(good.kappa).toBe(1);
    expect(good.disagreements).toEqual([]);
  });
});
