import { describe, expect, it } from 'vitest';
import { planBaseline } from '../experiment/baseline.js';
import { recordCheckIn } from '../experiment/daily.js';
import { assertPreRegistration, startExperiment } from '../experiment/registration.js';
import { history, startInput } from '../experiment/test-support.js';
import type { HistoricalNight } from '../experiment/types.js';
import { analyzeExperiment } from './analyze.js';
import { contrastVariance, estimateEffect, estimateRho, normalCdf } from './estimate.js';
import type { NightSample } from './estimate.js';
import { decideFromEstimate, estimateV2, expectedDirection, literaturePrior } from './policy.js';
import { experimentResultCard } from './presentation.js';

/** Small deterministic generator so fixtures have realistic night-to-night noise. */
function noise(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let v = state;
    v = Math.imul(v ^ (v >>> 15), v | 1);
    v ^= v + Math.imul(v ^ (v >>> 7), v | 61);
    const u = ((v ^ (v >>> 14)) >>> 0) / 0x100000000;
    return (u - 0.5) * 2;
  };
}
const alternating = (n: number): NightSample[] =>
  Array.from({ length: n }, (_, i) => ({
    sleepDate: `2026-10-${String(6 + i).padStart(2, '0')}`,
    dayIndex: i,
    exposure: Math.floor(i / 3) % 2 ? 'off' : 'on',
    value: 0,
  }));

describe('normal distribution and contrast variance', () => {
  it('normalCdf matches known values', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
    expect(normalCdf(1.2815515655)).toBeCloseTo(0.9, 5);
    expect(normalCdf(-1.959964)).toBeCloseTo(0.025, 5);
  });
  it('equals the independent-nights variance at rho 0 and reflects the layout otherwise', () => {
    const samples = alternating(14);
    const zero = contrastVariance(samples, 10, 0);
    expect(zero.variance).toBeCloseTo(zero.independentVariance, 12);
    // One block per side: positive correlation inside each block inflates the variance.
    const oneBlock: NightSample[] = Array.from({ length: 6 }, (_, i) => ({
      sleepDate: `2026-10-${String(6 + i).padStart(2, '0')}`,
      dayIndex: i,
      exposure: i < 3 ? 'on' : 'off',
      value: 0,
    }));
    expect(contrastVariance(oneBlock, 10, 0.5).variance).toBeGreaterThan(
      contrastVariance(oneBlock, 10, 0).variance,
    );
  });
});

describe('effect estimate and posterior', () => {
  it('combines the prior and the data by precision', () => {
    const samples = alternating(14).map((s) => ({ ...s, value: s.exposure === 'on' ? 460 : 400 }));
    const estimate = estimateEffect({
      samples,
      swing: 45,
      rho: 0,
      prior: { mean: 0, sd: 1 },
      direction: 'higher',
      worthwhile: 0.5,
    });
    const se = Math.sqrt(1 / estimate.nights.on + 1 / estimate.nights.off);
    expect(estimate.swingUnits).toBeCloseTo(60 / 45, 10);
    expect(estimate.swingUnitsSe).toBeCloseTo(se, 10);
    const expectedMean = (60 / 45 / se ** 2) / (1 / se ** 2 + 1);
    expect(estimate.posterior.mean).toBeCloseTo(expectedMean, 10);
    expect(estimate.probabilities.helps).toBeGreaterThan(0.95);
    expect(estimate.probabilities.helps + estimate.probabilities.hurts).toBeCloseTo(1, 10);
  });
  it('flips the sign for metrics where lower is better', () => {
    const samples = alternating(14).map((s) => ({ ...s, value: s.exposure === 'on' ? 15 : 25 }));
    const estimate = estimateEffect({
      samples,
      swing: 10,
      rho: 0.35,
      prior: { mean: 0, sd: 1.5 },
      direction: 'lower',
      worthwhile: 0.5,
    });
    expect(estimate.swingUnits).toBeCloseTo(1, 10);
    expect(estimate.probabilities.helps).toBeGreaterThan(0.9);
  });
  it('rejects impossible inputs', () => {
    const samples = alternating(6).map((s) => ({ ...s, value: 1 }));
    const base = { samples, swing: 1, rho: 0.3, prior: { mean: 0, sd: 1 }, direction: 'higher' as const, worthwhile: 0.5 };
    expect(() => estimateEffect({ ...base, swing: 0 })).toThrow('swing');
    expect(() => estimateEffect({ ...base, rho: 0.95 })).toThrow('rho');
    expect(() => estimateEffect({ ...base, inflation: 0.5 })).toThrow('Inflation');
    expect(() => estimateEffect({ ...base, samples: [samples[0]!, samples[0]!] })).toThrow('night');
  });
});

describe('night-to-night correlation', () => {
  it('recovers correlation from a long series and shrinks a short one toward the default', () => {
    const draw = noise(7);
    const rows: { date: string; value: number }[] = [];
    let state = 0;
    for (let i = 0; i < 300; i++) {
      state = 0.6 * state + Math.sqrt(1 - 0.36) * draw();
      rows.push({ date: new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10), value: state });
    }
    const long = estimateRho(rows, { defaultRho: 0.35, priorWeight: 10, max: 0.7 });
    expect(long.basis).toBe('estimated');
    expect(long.value).toBeGreaterThan(0.45);
    expect(long.value).toBeLessThan(0.7);
    const short = estimateRho(rows.slice(0, 4), { defaultRho: 0.35, priorWeight: 10, max: 0.7 });
    expect(short).toEqual({ value: 0.35, basis: 'default', pairs: 3 });
    // Nights with gaps do not count as consecutive pairs.
    const gapped = rows.filter((_, i) => i % 2 === 0);
    expect(estimateRho(gapped, { defaultRho: 0.35, priorWeight: 10, max: 0.7 }).basis).toBe('default');
  });
});

describe('decision policy', () => {
  const estimateWith = (mean: number, sd: number) =>
    ({
      nights: { on: 7, off: 7 },
      difference: 0,
      standardError: 1,
      designEffect: 1,
      swingUnits: mean,
      swingUnitsSe: sd,
      prior: { mean: 0, sd: 1 },
      posterior: { mean, sd, interval80: [mean - 1.28 * sd, mean + 1.28 * sd] as const },
      probabilities: {
        helps: 1 - normalCdf(-mean / sd),
        hurts: normalCdf(-mean / sd),
        helpsWorthwhile: 1 - normalCdf((0.5 - mean) / sd),
        hurtsWorthwhile: normalCdf((-0.5 - mean) / sd),
        smallerThanWorthwhile: normalCdf((0.5 - mean) / sd) - normalCdf((-0.5 - mean) / sd),
      },
      worthwhile: 0.5,
    }) as const;
  const context = (over: Partial<Parameters<typeof decideFromEstimate>[1]> = {}) => ({
    policy: estimateV2,
    design: 'randomized' as const,
    complete: false,
    atLook: true,
    nightsOk: true,
    ...over,
  });
  it('keeps when the chance of help is at least 97.5% and the effect is not trivial', () => {
    expect(decideFromEstimate(estimateWith(1.3, 0.6), context())).toEqual({ verdict: 'Kept', outcome: 'helps' });
    expect(decideFromEstimate(estimateWith(-1.3, 0.6), context())).toEqual({ verdict: 'Dropped', outcome: 'costs_you' });
    expect(decideFromEstimate(estimateWith(1.0, 0.6), context()).outcome).toBe('too_close_extend');
    // Certain but tiny: not a decisive call.
    expect(decideFromEstimate(estimateWith(0.2, 0.05), context()).outcome).toBe('too_close_extend');
  });
  it('says "does nothing" only once the schedule is complete', () => {
    const flat = estimateWith(0, 0.4);
    expect(decideFromEstimate(flat, context()).outcome).toBe('too_close_extend');
    expect(decideFromEstimate(flat, context({ complete: true })).outcome).toBe('no_detectable_benefit');
    const ambiguous = estimateWith(0.4, 0.5);
    expect(decideFromEstimate(ambiguous, context({ complete: true })).outcome).toBe('too_close_final');
  });
  it('can raise the bar for observed exposure and waits for enough nights', () => {
    const strong = estimateWith(1.3, 0.6);
    expect(decideFromEstimate(strong, context()).outcome).toBe('helps');
    // The locked policy penalises observed exposure through its wider standard error, not a higher bar.
    expect(decideFromEstimate(strong, context({ design: 'observational' })).outcome).toBe('helps');
    const stricter = { ...estimateV2, observedKeepProbability: 0.995 };
    expect(decideFromEstimate(strong, context({ design: 'observational', policy: stricter })).outcome).toBe('too_close_extend');
    expect(decideFromEstimate(strong, context({ nightsOk: false })).outcome).toBe('too_close_extend');
    expect(decideFromEstimate(strong, context({ nightsOk: false, complete: true })).outcome).toBe('not_enough_nights');
    expect(decideFromEstimate(strong, context({ atLook: false })).outcome).toBe('in_progress');
  });
  it('records the row but centres the prior on zero: the literature does not vote', () => {
    expect(literaturePrior(estimateV2, { expectedEffect: 1, evidenceGrade: 'A', expected: 'hurts' })).toEqual({ mean: 0, sd: 1 });
    expect(literaturePrior(estimateV2, { expectedEffect: 0.9, evidenceGrade: 'B', expected: 'helps' })).toEqual({ mean: 0, sd: 1 });
    expect(literaturePrior(estimateV2, { expectedEffect: 1, evidenceGrade: 'A', expected: 'unknown' })).toEqual({ mean: 0, sd: 1 });
    const leaning = { ...estimateV2, priorShrink: 0.5, priorSdByGrade: { ...estimateV2.priorSdByGrade, A: 0.8 } };
    expect(literaturePrior(leaning, { expectedEffect: 1, evidenceGrade: 'A', expected: 'hurts' })).toEqual({ mean: -0.5, sd: 0.8 });
    expect(expectedDirection('worse if late')).toBe('hurts');
    expect(expectedDirection('fall asleep faster / REM down')).toBe('unknown');
    expect(expectedDirection('better?')).toBe('unknown');
    expect(expectedDirection('HRV up')).toBe('helps');
    expect(expectedDirection(null)).toBe('unknown');
  });
});

describe('estimate-based registration and analysis', () => {
  const metric = 'totalSleepMinutes';
  function register(overrides: Partial<Parameters<typeof startInput>[0]> = {}) {
    return startExperiment(
      startInput({
        decisionPolicy: undefined,
        direction: 'higher',
        onDefinition: 'Follow the saved on condition',
        offDefinition: 'Follow the saved off condition',
        ...overrides,
      }),
    );
  }
  function nightsFor(
    record: ReturnType<typeof register>,
    values: (condition: 'on' | 'off' | 'observe', i: number) => number,
  ): HistoricalNight[] {
    return record.schedule.days.map((day, i) => ({
      night: { ...history[0]!.night, sleepDate: day.sleepDate, [metric]: values(day.condition, i) },
    }));
  }
  it('locks a 28-day schedule with three looks, a prior from the row, and a correlation estimate', () => {
    const record = register();
    expect(record.decision).toBeDefined();
    const lock = record.decision!;
    expect(record.schedule.totalDays).toBe(28);
    expect(record.schedule.blockLengths).toEqual([3, 3, 3, 3, 1, 1, 3, 3, 3, 3, 1, 1]);
    expect(lock.looks).toEqual([13, 20, 27].map((i) => record.schedule.days[i]!.sleepDate));
    expect(lock.plannedDays).toBe(14);
    // Coffee after 2pm: grade A, expected 1.0, expected to hurt. Recorded, not used as a lean.
    expect(lock.prior.mean).toBe(0);
    expect(lock.prior).toMatchObject({ sd: 1, basis: { expected: 'hurts', evidenceGrade: 'A', expectedEffect: 1 } });
    expect(lock.rho.value).toBeGreaterThanOrEqual(0);
    expect(lock.rho.value).toBeLessThanOrEqual(0.7);
    expect(lock.carryover).toBe(false);
  });
  it('rejects a tampered decision lock', () => {
    const record = register();
    const tampered = JSON.parse(JSON.stringify(record)) as typeof record;
    (tampered.decision as { prior: { mean: number } }).prior.mean = 2;
    expect(() => assertPreRegistration(tampered)).toThrow('decision lock');
    const looks = JSON.parse(JSON.stringify(record)) as typeof record;
    (looks.decision as unknown as { looks: string[] }).looks[0] = '2026-10-01';
    expect(() => assertPreRegistration(looks)).toThrow('decision lock');
  });
  it('decides Kept at the first look for a large, consistent benefit', () => {
    const record = register();
    const draw = noise(3);
    const nights = nightsFor(record, (c) => (c === 'on' ? 470 : 400) + 20 * draw());
    const checkIns = record.schedule.days.map((day) =>
      recordCheckIn(record, { sleepDate: day.sleepDate, tap: 'did' }),
    );
    const early = analyzeExperiment({
      registration: record,
      nights,
      checkIns,
      through: record.schedule.days[9]!.sleepDate,
      bootstrap: { enabled: false },
    });
    expect(early.verdict).toBe('Inconclusive');
    expect(early.outcome).toBe('in_progress');
    expect(early.look).toMatchObject({ index: null, complete: false });
    const first = analyzeExperiment({
      registration: record,
      nights,
      checkIns,
      through: record.decision!.looks[0]!,
      bootstrap: { enabled: false },
    });
    expect(first.verdict).toBe('Kept');
    expect(first.outcome).toBe('helps');
    expect(first.validNights).toEqual({ on: 7, off: 7 });
    expect(first.look).toMatchObject({ index: 0, date: record.decision!.looks[0], complete: false });
    expect(first.estimate!.probabilities.helps).toBeGreaterThan(0.9);
    const card = experimentResultCard(first);
    expect(card.outcome).toBe('helps');
    expect(card.chance!.helps).toBeGreaterThan(0.9);
    expect(card.likelyRange!.lower).toBeGreaterThan(0);
    expect(card.likelyRange!.unit).toBe('minutes');
  });
  it('extends a null result at 14 days and calls it "does nothing" at 28', () => {
    const record = register();
    const draw = noise(11);
    const nights = nightsFor(record, () => 410 + 25 * draw());
    const checkIns = record.schedule.days.map((day) =>
      recordCheckIn(record, { sleepDate: day.sleepDate, tap: 'did' }),
    );
    const run = (through: string) =>
      analyzeExperiment({ registration: record, nights, checkIns, through, bootstrap: { enabled: false } });
    const first = run(record.decision!.looks[0]!);
    expect(first.verdict).toBe('Inconclusive');
    expect(first.outcome).toBe('too_close_extend');
    expect(first.reasons).toEqual(['too_close_extend']);
    expect(first.look!.next).toBe(record.decision!.looks[1]);
    const last = run(record.decision!.looks[2]!);
    expect(last.look!.complete).toBe(true);
    expect(last.outcome).toBe('no_detectable_benefit');
    expect(last.verdict).toBe('Dropped');
    expect(last.estimate!.probabilities.helpsWorthwhile).toBeLessThanOrEqual(0.2);
  });
  it('analyses a "didn\'t" tap as the night it actually was instead of voiding the test', () => {
    const record = register();
    const draw = noise(5);
    // The person skips the on-condition on two assigned on-nights; those become off-nights.
    const onDays = record.schedule.days.slice(0, 14).filter((day) => day.condition === 'on');
    const skipped = new Set([onDays[0]!.sleepDate, onDays[3]!.sleepDate]);
    const assignedOn = onDays.length,
      assignedOff = 14 - assignedOn;
    const checkIns = record.schedule.days.map((day) =>
      recordCheckIn(record, { sleepDate: day.sleepDate, tap: skipped.has(day.sleepDate) ? 'didnt' : 'did' }),
    );
    const exposures = new Map(checkIns.map((c) => [c.sleepDate, c.exposure]));
    const nights = record.schedule.days.map((day) => ({
      night: {
        ...history[0]!.night,
        sleepDate: day.sleepDate,
        [metric]: (exposures.get(day.sleepDate) === 'on' ? 470 : 400) + 20 * draw(),
      },
    }));
    const result = analyzeExperiment({
      registration: record,
      nights,
      checkIns,
      through: record.decision!.looks[0]!,
      bootstrap: { enabled: false },
    });
    expect(result.noncompliantDates).toHaveLength(2);
    expect(result.deviationShare).toBeCloseTo(2 / 14, 10);
    expect(result.validNights).toEqual({ on: assignedOn - 2, off: assignedOff + 2 });
    expect(result.verdict).toBe('Kept');
  });
  it('can decide an observed item at a higher bar and drops carried-over off-nights', () => {
    const record = register({
      candidate: { ...startInput().candidate, key: 'alcohol-in-the-evening', onDays: 'observe' },
    });
    expect(record.schedule.design).toBe('observational');
    expect(record.decision!.carryover).toBe(true);
    const draw = noise(21);
    const checkIns = record.schedule.days.map((day) =>
      recordCheckIn(record, {
        sleepDate: day.sleepDate,
        exposure: day.condition === 'observe' ? 'on' : 'off',
      }),
    );
    const nights = nightsFor(record, (c) => (c === 'observe' ? 340 : 410) + 15 * draw());
    const result = analyzeExperiment({
      registration: record,
      nights,
      checkIns,
      through: record.decision!.looks[2]!,
      bootstrap: { enabled: false },
    });
    expect(result.excluded.some((e) => e.reason === 'carryover')).toBe(true);
    expect(result.verdict).toBe('Dropped');
    expect(result.outcome).toBe('costs_you');
    expect(result.limitations).toContain('standard_error_inflated_for_confounding');
  });
  it('allows a gated item to start only when the person chose to run it anyway', () => {
    const gated = { ...startInput().candidate, tier: 'T3_TOO_SMALL' as const, canRunAnyway: true };
    expect(() => register({ candidate: gated })).toThrow('runnable');
    expect(register({ candidate: gated, runAnyway: true }).itemKey).toBe('coffee-after-2pm');
  });
  it('keeps a legacy registration on the exact randomization path', () => {
    const legacy = startExperiment(startInput());
    expect(legacy.decision).toBeUndefined();
    expect(legacy.schedule.totalDays).toBe(14);
    const baseline = planBaseline(history, metric, { source: 'oura' }, '2026-10-05', '2026-10-05');
    expect(baseline.status).toBe('ready');
  });
});
