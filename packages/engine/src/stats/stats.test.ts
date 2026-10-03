import { describe, expect, it } from 'vitest';
import { analyzeExperiment } from './analyze.js';
import { bootstrapInterval } from './bootstrap.js';
import { decideVerdict } from './decision.js';
import { mean, robustSd } from './math.js';
import { experimentResultCard } from './presentation.js';
import { exactRandomizationTest } from './randomization.js';
import { planBaseline } from '../experiment/baseline.js';
import { recordCheckIn } from '../experiment/daily.js';
import { assertPreRegistration, startExperiment } from '../experiment/registration.js';
import { createSchedule, enumerateAssignments } from '../experiment/schedule.js';
import { history, startInput } from '../experiment/test-support.js';
import type { HistoricalNight, TestPolicy } from '../experiment/types.js';

const layout = [3, 3, 3, 3, 1, 1, 3, 3, 3, 3, 1, 1];
function fixture(
  options: {
    on?: number;
    off?: number;
    direction?: 'higher' | 'lower';
    policy?: TestPolicy;
    carryover?: boolean;
    short?: boolean;
    observe?: boolean;
    hrv?: boolean;
  } = {},
) {
  const metric = options.hrv ? 'overnightHrvMs' : 'totalSleepMinutes';
  const record = startExperiment(
    startInput({
      candidate: {
        ...startInput().candidate,
        ...(options.observe
          ? {
              key: 'alcohol-in-the-evening',
              onDays: 'observe' as const,
            }
          : {}),
        ...(options.hrv ? { metric: 'Overnight HRV' } : {}),
      },
      baseline: planBaseline(
        history,
        metric,
        options.hrv ? { source: 'oura', hrvMethod: 'rmssd' } : { source: 'oura' },
        '2026-10-05',
        '2026-10-05',
      ),
      direction: options.direction ?? 'higher',
      testPolicy: options.policy ?? 'both_directions',
      config: options.short
        ? { dropFirstNightOfBlock: options.carryover ?? false }
        : {
            totalDays: 28,
            blockLengths: layout,
            dropFirstNightOfBlock: options.carryover ?? false,
          },
      onDefinition: 'Follow the saved on condition',
      offDefinition: 'Follow the saved off condition',
    }),
  );
  const checkIns = record.schedule.days.map((day) =>
    recordCheckIn(record, {
      sleepDate: day.sleepDate,
      exposure: day.condition === 'off' ? 'off' : 'on',
    }),
  );
  const nights: HistoricalNight[] = record.schedule.days.map((day) => ({
    night: {
      ...history[0]!.night,
      sleepDate: day.sleepDate,
      [metric]:
        day.condition === 'off'
          ? (options.off ?? (options.hrv ? 40 : 400))
          : (options.on ?? (options.hrv ? 60 : 430)),
    },
  }));
  const through = record.schedule.days.at(-1)!.sleepDate;
  const analyze = (overrides: Partial<Parameters<typeof analyzeExperiment>[0]> = {}) =>
    analyzeExperiment({
      registration: record,
      nights,
      checkIns,
      through,
      bootstrap: { iterations: 1000 },
      ...overrides,
    });
  return { record, nights, checkIns, through, analyze };
}

describe('exact block randomization', () => {
  it('uses the full stored support, counts the observed assignment and includes ties', () => {
    const schedule = createSchedule('2026-10-05', 17, false);
    const points = schedule.days.map((day) => ({
      block: day.block,
      value: day.condition === 'on' ? 10 : 0,
    }));
    const result = exactRandomizationTest(schedule, points, 'higher')!;
    expect(result.assignmentCount).toBe(6);
    expect(result.beneficialP).toBe(1 / 6);
    expect(result.oppositeP).toBe(1);
    expect(
      exactRandomizationTest(
        schedule,
        points.map((point) => ({ ...point, value: 400 })),
        'higher',
      ),
    ).toMatchObject({
      statistic: 0,
      beneficialP: 1,
      oppositeP: 1,
    });
    expect(exactRandomizationTest(schedule, points, 'lower')?.beneficialP).toBe(1);
  });
  it('does not treat correlated nights as independent permutations', () => {
    const f = fixture({ carryover: true });
    const result = f.analyze();
    expect(result.randomization?.assignmentCount).toBe(60);
    // One-day blocks vanish under carryover; five distinct schedules then give the same statistic.
    expect(result.randomization?.beneficialExtreme).toBe(5);
    expect(result.randomization?.beneficialP).toBe(5 / 60);
    expect(result.verdict).toBe('Inconclusive');
    expect(result.validNights).toEqual({ on: 8, off: 8 });
  });
  it('will not discard assignments made unestimable by a fixed missingness mask', () => {
    const schedule = createSchedule('2026-10-05', 17, false);
    const actual = enumerateAssignments(schedule.startDate)[schedule.assignmentIndex]!;
    const onBlock = actual.indexOf('on'),
      offBlock = actual.indexOf('off');
    expect(
      exactRandomizationTest(
        schedule,
        [
          { block: onBlock, value: 10 },
          { block: offBlock, value: 0 },
        ],
        'higher',
      ),
    ).toBeNull();
  });
  it('rejects observational schedules, invalid points and altered support', () => {
    const schedule = createSchedule('2026-10-05', 17, false);
    expect(() =>
      exactRandomizationTest({ ...schedule, assignmentCount: 999 }, [], 'higher'),
    ).toThrow('reproducible');
    expect(() => exactRandomizationTest(schedule, [{ block: 999, value: 1 }], 'higher')).toThrow(
      'measurement',
    );
    expect(() =>
      exactRandomizationTest(createSchedule('2026-10-05', 17, true), [], 'higher'),
    ).toThrow('Observational');
  });
});

describe('saved decision policy', () => {
  it.each([
    ['higher', 430, 'Kept'],
    ['higher', 370, 'Dropped'],
    ['lower', 430, 'Dropped'],
    ['lower', 370, 'Kept'],
  ] as const)('direction %s and on mean %s gives %s', (direction, on, verdict) => {
    const result = fixture({ direction, on }).analyze();
    expect(result.verdict).toBe(verdict);
    expect(result.reasons).toEqual([]);
    expect(result.perTailAlpha).toBe(0.025);
  });
  it('a restriction on-condition means keep the restriction when it helps', () => {
    const f = fixture({ on: 370, direction: 'lower' });
    const record = startExperiment(
      startInput({
        direction: 'lower',
        testPolicy: 'both_directions',
        onDefinition: 'No coffee after noon',
        offDefinition: 'Your existing late-coffee timing',
        config: { totalDays: 28, blockLengths: layout },
      }),
    );
    const card = experimentResultCard(f.analyze({ registration: record }));
    expect(card.word).toBe('Kept');
    expect(card.onCondition).toBe('No coffee after noon');
  });
  it('legacy missing policy remains one-sided; an opposite result never becomes Dropped', () => {
    const f = fixture({ on: 370 });
    const legacy = { ...f.record, testPolicy: undefined };
    const result = f.analyze({ registration: legacy });
    expect(result.testPolicy).toBe('benefit_only');
    expect(result.perTailAlpha).toBe(0.05);
    expect(result.verdict).toBe('Inconclusive');
    expect(result.reasons).toContain('opposite_direction_not_tested');
  });
  it('strict alpha applies at the boundary in either tail; zero has no direction', () => {
    const test = fixture().analyze().randomization!;
    const decide = (difference: number, beneficialP: number, oppositeP: number) =>
      decideVerdict({
        direction: 'higher',
        testPolicy: 'both_directions',
        alpha: 0.05,
        difference,
        test: { ...test, beneficialP, oppositeP },
        blockers: [],
      });
    expect(decide(1, 0.025, 1).verdict).toBe('Inconclusive');
    expect(decide(-1, 1, 0.025).verdict).toBe('Inconclusive');
    expect(decide(1, 0.024, 1).verdict).toBe('Kept');
    expect(decide(-1, 1, 0.024).verdict).toBe('Dropped');
    expect(decide(0, 0, 0).reasons).toEqual(['no_difference']);
  });
  it('short assignment spaces stay inconclusive even with an arbitrarily large measured effect', () => {
    const result = fixture({ short: true, on: 1400 }).analyze();
    expect(result.verdict).toBe('Inconclusive');
    expect(result.reasons).toContain('assignment_resolution');
  });
  it('the original 22-assignment long example can resolve one tail, but not two', () => {
    const oldLayout = [3, 3, 1, 3, 3, 1, 3, 3, 1, 3, 3, 1];
    const run = (policy: TestPolicy) => {
      const registration = startExperiment(
        startInput({
          direction: 'higher',
          testPolicy: policy,
          config: { totalDays: 28, blockLengths: oldLayout },
        }),
      );
      return analyzeExperiment({
        registration,
        through: registration.schedule.days.at(-1)!.sleepDate,
        bootstrap: { iterations: 1000 },
        checkIns: registration.schedule.days.map((day) =>
          recordCheckIn(registration, { sleepDate: day.sleepDate, tap: 'did' }),
        ),
        nights: registration.schedule.days.map((day) => ({
          night: {
            ...history[0]!.night,
            sleepDate: day.sleepDate,
            totalSleepMinutes: day.condition === 'on' ? 430 : 400,
          },
        })),
      });
    };
    expect(run('benefit_only').verdict).toBe('Kept');
    expect(run('both_directions').reasons).toContain('assignment_resolution');
  });
  it('no measured difference produces no decision', () => {
    expect(fixture({ on: 400 }).analyze().reasons).toContain('no_difference');
  });
});

describe('measurements, exclusions and personal swing', () => {
  it('reports real means and difference with baseline plus off-night MAD', () => {
    const result = fixture().analyze();
    const expected = robustSd([
      ...history.map((row) => row.night.totalSleepMinutes!),
      ...Array(14).fill(400),
    ]);
    expect(result.effect).toMatchObject({
      onMean: 430,
      offMean: 400,
      difference: 30,
      swingUnits: 30 / expected,
    });
    expect(result.personalSwing).toMatchObject({
      value: expected,
      baselineNights: 28,
      offNights: 14,
      baselineSource: 'locked_snapshot',
    });
    expect(result.lockedSwing.value).not.toBe(expected);
  });
  it('HRV effects stay in ms, while swing-unit calculations use log HRV', () => {
    const result = fixture({ hrv: true }).analyze();
    const swing = robustSd([
      ...history.map((row) => Math.log(row.night.overnightHrvMs!)),
      ...Array(14).fill(Math.log(40)),
    ]);
    expect(result.effect?.difference).toBe(20);
    expect(result.effect?.swingUnits).toBeCloseTo((Math.log(60) - Math.log(40)) / swing);
    expect(result.personalSwing?.scale).toBe('log');
    expect(experimentResultCard(result).swing).toEqual({
      value: 100 * Math.expm1(swing),
      unit: 'percent',
    });
    expect(experimentResultCard(result).unit).toBe('ms');
  });
  it('will not issue an HRV verdict whose log direction contradicts the displayed raw change', () => {
    const f = fixture({ hrv: true });
    let onIndex = 0;
    const nights = f.nights.map((row, index) => ({
      night: {
        ...row.night,
        overnightHrvMs: f.checkIns[index]!.exposure === 'on' ? (++onIndex % 2 ? 2 : 98) : 40,
      },
    }));
    const result = f.analyze({ nights });
    expect(result.effect?.difference).toBeCloseTo(10);
    expect(result.effect!.transformedDifference).toBeLessThan(0);
    expect(result.verdict).toBe('Inconclusive');
    expect(result.reasons).toContain('effect_direction_disagreement');
  });
  it('unknown check-ins never become off-nights, and flagged nights cannot count', () => {
    const f = fixture();
    const dates = f.record.schedule.days
      .filter((day) => day.condition === 'on')
      .slice(0, 10)
      .map((day) => day.sleepDate);
    const checkIns = f.checkIns.map((entry) =>
      dates.includes(entry.sleepDate)
        ? recordCheckIn(f.record, { sleepDate: entry.sleepDate })
        : entry,
    );
    const result = f.analyze({ checkIns });
    expect(result.validNights).toEqual({ on: 4, off: 14 });
    expect(result.verdict).toBe('Inconclusive');
    expect(result.reasons).toContain('insufficient_nights');
    expect(result.excluded.filter((entry) => entry.reason === 'unknown_exposure')).toHaveLength(10);
    const flagged = f.checkIns.map((entry, index) =>
      index < 10
        ? recordCheckIn(f.record, {
            sleepDate: entry.sleepDate,
            exposure: entry.exposure as 'on' | 'off',
            exclusions: ['ill'],
          })
        : entry,
    );
    expect(
      f.analyze({ checkIns: flagged }).excluded.filter((entry) => entry.reason === 'flagged'),
    ).toHaveLength(10);
  });
  it('invalid latency, wrong HRV method and missing measurements cannot count', () => {
    const f = fixture({ hrv: true });
    expect(
      f.analyze({ nights: f.nights.map((row) => ({ night: { ...row.night, hrvMethod: 'sdnn' } })) })
        .validNights,
    ).toEqual({ on: 0, off: 0 });
    const latency = startExperiment(
      startInput({
        candidate: { ...startInput().candidate, metric: 'Time to fall asleep' },
        baseline: planBaseline(
          history.map((row) => ({
            night: { ...row.night, sleepLatencyMinutes: row.night.totalSleepMinutes! / 10 },
          })),
          'sleepLatencyMinutes',
          { source: 'oura' },
          '2026-10-05',
          '2026-10-05',
        ),
        config: { totalDays: 28, blockLengths: layout },
      }),
    );
    const result = f.analyze({
      registration: latency,
      nights: f.nights.map((row) => ({ night: { ...row.night, sleepLatencyMinutes: 61 } })),
    });
    expect(result.validNights).toEqual({ on: 0, off: 0 });
    expect(result.effect).toBeNull();
    expect(
      f.analyze({
        nights: f.nights.map((row) => ({ night: { ...row.night, overnightHrvMs: null } })),
      }).effect,
    ).toBeNull();
  });
  it('one contrary exposure blocks causal inference instead of relabeling it as randomized', () => {
    const f = fixture();
    const first = f.record.schedule.days[0]!;
    const changed = recordCheckIn(f.record, { sleepDate: first.sleepDate, tap: 'didnt' });
    const result = f.analyze({ checkIns: [changed, ...f.checkIns.slice(1)] });
    expect(result.verdict).toBe('Inconclusive');
    expect(result.reasons).toContain('noncompliance');
    expect(result.randomization).toBeNull();
    expect(result.noncompliantDates).toEqual([first.sleepDate]);
    expect(result.effect).not.toBeNull();
    expect(result.interval).toBeNull();
    expect(result.limitations).toContain('bootstrap_condition_clusters_overlap');
  });
  it('observational comparisons never get a randomization p-value or a causal verdict', () => {
    const result = fixture({ observe: true }).analyze();
    expect(result.effect?.difference).toBe(30);
    expect(result.randomization).toBeNull();
    expect(result.verdict).toBe('Inconclusive');
    expect(result.reasons).toContain('observational_design');
    expect(experimentResultCard(result).evidence).toBe('observational');
  });
  it('does not issue a final verdict before the last scheduled wake date', () => {
    const f = fixture();
    const result = f.analyze({ through: f.record.schedule.days[20]!.sleepDate });
    expect(result.reasons).toContain('experiment_not_finished');
    expect(result.excluded.filter((entry) => entry.reason === 'not_yet_observed')).toHaveLength(7);
  });
  it('baseline snapshots are stable across provider corrections; legacy history must reproduce its saved swing', () => {
    const f = fixture();
    const legacySwing = { ...f.record.personalSwing, sampleValues: undefined };
    const legacy = {
      ...f.record,
      personalSwing: legacySwing,
      baseline: { ...f.record.baseline, swing: legacySwing },
    };
    expect(() => startExperiment(startInput({ baseline: legacy.baseline }))).toThrow(
      'locked baseline measurements',
    );
    expect(f.analyze({ registration: legacy }).reasons).toContain('baseline_unavailable');
    expect(
      f.analyze({ registration: legacy, nights: [...history, ...f.nights] }).personalSwing
        ?.baselineSource,
    ).toBe('legacy_history_verified');
    const changed = history.map((row) => ({ night: { ...row.night, totalSleepMinutes: 1 } }));
    expect(
      f.analyze({ registration: legacy, nights: [...changed, ...f.nights] }).reasons,
    ).toContain('baseline_unavailable');
    expect(f.analyze({ nights: [...changed, ...f.nights] }).personalSwing).toEqual(
      f.analyze().personalSwing,
    );
  });
  it('a zero pooled MAD is not replaced with an invented variance', () => {
    const f = fixture();
    const baseline = planBaseline(
      history.map((row, index) => ({
        night: { ...row.night, totalSleepMinutes: index < 13 ? 400 : index < 20 ? 405 : 410 },
      })),
      'totalSleepMinutes',
      { source: 'oura' },
      '2026-10-05',
      '2026-10-05',
    );
    const record = startExperiment(
      startInput({
        baseline,
        direction: 'higher',
        config: { totalDays: 28, blockLengths: layout },
      }),
    );
    const result = f.analyze({ registration: record });
    expect(result.personalSwing?.value).toBe(0);
    expect(result.effect?.swingUnits).toBeNull();
    expect(result.reasons).toContain('zero_personal_swing');
  });
  it('rejects duplicate measurements/check-ins and forged usability/carryover', () => {
    const f = fixture();
    expect(() => f.analyze({ nights: [...f.nights, f.nights[0]!] })).toThrow(
      'Duplicate experiment',
    );
    expect(() => f.analyze({ checkIns: [...f.checkIns, f.checkIns[0]!] })).toThrow(
      'Duplicate check-in',
    );
    expect(() =>
      f.analyze({ checkIns: [{ ...f.checkIns[0]!, usable: false }, ...f.checkIns.slice(1)] }),
    ).toThrow('Invalid persisted');
    const alien = { ...f.checkIns[0]!, sleepDate: '2027-01-01' };
    expect(() => f.analyze({ checkIns: [alien] })).toThrow('outside');
  });
  it('revalidates baseline sample values and keeps every input and result immutable', () => {
    const f = fixture();
    const before = structuredClone({
      registration: f.record,
      nights: f.nights,
      checkIns: f.checkIns,
    });
    const result = f.analyze();
    expect({ registration: f.record, nights: f.nights, checkIns: f.checkIns }).toEqual(before);
    expect(() => {
      (result.effect as { difference: number }).difference = 0;
    }).toThrow();
    const swing = { ...f.record.personalSwing, sampleValues: Array(28).fill(400) };
    expect(() =>
      assertPreRegistration({
        ...f.record,
        personalSwing: swing,
        baseline: { ...f.record.baseline, swing },
      }),
    ).toThrow('do not match');
    expect(() => f.analyze({ through: '2026-02-30' })).toThrow('date');
  });
});

describe('bootstrap and result-card boundary', () => {
  it('resamples whole correlated blocks and reports the percentile 90% interval reproducibly', () => {
    const result = bootstrapInterval(
      [
        [1, 1, 1],
        [100, 100, 100],
      ],
      [
        [0, 0],
        [0, 0],
      ],
      { seed: 123, iterations: 1000 },
    )!;
    expect(result).toMatchObject({ lower: 1, upper: 100, level: 0.9, onBlocks: 2, offBlocks: 2 });
    expect(
      bootstrapInterval(
        [
          [1, 1, 1],
          [100, 100, 100],
        ],
        [
          [0, 0],
          [0, 0],
        ],
        { seed: 123, iterations: 1000 },
      ),
    ).toEqual(result);
    expect(
      bootstrapInterval([[2], [2, 2, 2]], [[1], [1]], { seed: 1, iterations: 1000 }),
    ).toMatchObject({ lower: 1, upper: 1 });
  });
  it('requires two observed blocks per side and validates resampling bounds', () => {
    expect(bootstrapInterval([[1, 1, 1, 1, 1]], [[0], [0]], { seed: 1 })).toBeNull();
    expect(() => bootstrapInterval([[NaN]], [[0]], { seed: 1 })).toThrow('Finite');
    expect(() => bootstrapInterval([[1]], [[0]], { seed: -1 })).toThrow('Invalid bootstrap');
    expect(() => bootstrapInterval([[1]], [[0]], { seed: 1, iterations: 999 })).toThrow(
      'Invalid bootstrap',
    );
  });
  it('changing bootstrap seed cannot change a verdict or randomization test', () => {
    const f = fixture();
    const a = f.analyze({ bootstrap: { seed: 1, iterations: 1000 } });
    const b = f.analyze({ bootstrap: { seed: 999, iterations: 1000 } });
    expect(a.verdict).toBe(b.verdict);
    expect(a.randomization).toEqual(b.randomization);
  });
  it('the public payload contains numbers, swing and a word but no p-value, alpha or diagnostics', () => {
    const result = fixture().analyze();
    const card = experimentResultCard(result);
    expect(card.number).toEqual({ on: 430, off: 400, change: 30 });
    expect(card.word).toBe('Kept');
    const keys: string[] = [];
    const visit = (value: unknown) => {
      if (value && typeof value === 'object') {
        for (const [key, child] of Object.entries(value)) {
          keys.push(key);
          visit(child);
        }
      }
    };
    visit(card);
    expect(
      keys.some((key) =>
        /pvalue|beneficialP|oppositeP|alpha|randomization|seed|assignmentCount/i.test(key),
      ),
    ).toBe(false);
    expect(card.validation).toBe('awaiting_phase_6');
    expect(() => {
      (card.nights as { on: number }).on = 1;
    }).toThrow();
  });
  it('zero and missing results remain distinct in the UI payload', () => {
    expect(experimentResultCard(fixture({ on: 400 }).analyze()).number?.change).toBe(0);
    expect(experimentResultCard(fixture().analyze({ checkIns: [] })).number).toBeNull();
    expect(mean([400, 400, 400])).toBe(400);
  });
});
