import { describe, expect, it } from 'vitest';
import { syntheticProvider } from '@distill/providers';
import { generatePerson } from './generator.js';
import { rate, simulateCell } from './harness.js';
import { runTrial } from './trial.js';
import { referenceScenario } from './scenarios.js';
import { createDemoUsers, demoView, sixMonthsBefore } from './demo.js';

const config = { seed: 1234, personId: 'alice', from: '2026-01-01', to: '2026-03-01' };
describe('synthetic data and actual-engine simulation', () => {
  it('replays all data, missingness and events from the saved seed and keeps people separate', () => {
    const person = generatePerson(config);
    expect(person).toEqual(generatePerson(config));
    expect(person.history).not.toEqual(generatePerson({ ...config, seed: 1235 }).history);
    expect(person.history.every((entry) => entry.night.source === 'synthetic')).toBe(true);
    expect(() => {
      person.history[0]!.night.totalSleepMinutes = 0;
    }).toThrow();
  });
  it('keeps absent measurements null, including stages, and fails a baseline rather than discarding an attempt', () => {
    const person = generatePerson({ ...config, missingMetricRate: 1 });
    for (const entry of person.history) expect(entry.night.deepSleepMinutes).toBeNull();
    expect(
      runTrial({ ...referenceScenario, seed: 1, effect: 0.8, missingMetricRate: 1 }),
    ).toMatchObject({ analysis: null, failure: 'baseline_not_ready' });
    const cell = simulateCell({ ...referenceScenario, missingMetricRate: 1 }, 0.8, 3, 1);
    expect(cell.decisive).toMatchObject({ count: 0, trials: 3, value: 0 });
    expect(cell.reasons.baseline_not_ready).toBe(3);
  });
  it('preserves marginal variance and AR(1) correlation without weekend shifts or exclusions', () => {
    const person = generatePerson({
      ...config,
      to: '2034-01-01',
      metrics: ['breathingRatePerMinute'],
      rho: 0.6,
      weekendSwing: 0,
      illnessRate: 0,
      missingMetricRate: 0,
      deviceNoiseFraction: 0,
    });
    const values = person.history.map((entry) => entry.night.breathingRatePerMinute!);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
    const covariance =
      values.slice(1).reduce((sum, value, i) => sum + (value - mean) * (values[i]! - mean), 0) /
      (values.length - 1);
    expect(Math.abs(mean - person.models.breathingRatePerMinute.mean)).toBeLessThan(0.1);
    expect(Math.sqrt(variance) / person.models.breathingRatePerMinute.swing).toBeGreaterThan(0.9);
    expect(Math.sqrt(variance) / person.models.breathingRatePerMinute.swing).toBeLessThan(1.1);
    expect(covariance / variance).toBeGreaterThan(0.53);
    expect(covariance / variance).toBeLessThan(0.67);
  });
  it('injects only the chosen dates and keeps zero-effect counterfactuals equal', () => {
    const common = {
      ...config,
      missingMetricRate: 0,
      illnessRate: 0,
      missedTapRate: 0,
      metrics: ['totalSleepMinutes'] as const,
    };
    const plain = generatePerson(common),
      onDates = ['2026-01-02', '2026-01-03'];
    const treatment = generatePerson({
      ...common,
      effect: { metric: 'totalSleepMinutes', direction: 'higher', swingUnits: 0.8, onDates },
    });
    for (let i = 0; i < plain.history.length; i++) {
      const a = plain.history[i]!.night,
        b = treatment.history[i]!.night;
      expect(b.totalSleepMinutes! - a.totalSleepMinutes!).toBeCloseTo(
        onDates.includes(a.sleepDate) ? 0.8 * treatment.models.totalSleepMinutes.swing : 0,
        8,
      );
    }
    const zero = generatePerson({
      ...common,
      effect: { metric: 'totalSleepMinutes', direction: 'higher', swingUnits: 0, onDates },
    });
    expect(zero.days.every((day) => day.noTreatmentValue === day.treatedValue)).toBe(true);
  });
  it('does not let a 14-day test become decisive even for a very large injected effect', () => {
    expect(
      runTrial({ ...referenceScenario, schedule: { totalDays: 14 }, seed: 123, effect: 2 })
        .analysis,
    ).toMatchObject({
      verdict: 'Inconclusive',
      reasons: expect.arrayContaining(['assignment_resolution']),
    });
  });
  it('optional bootstrap omission changes neither the test nor the verdict', () => {
    const input = { ...referenceScenario, seed: 123, effect: 0.8 };
    const a = runTrial(input).analysis!,
      b = runTrial({ ...input, withInterval: true }).analysis!;
    expect(a.verdict).toBe(b.verdict);
    expect(a.randomization).toEqual(b.randomization);
    expect(a.interval).toBeNull();
    expect(b.interval).not.toBeNull();
  });
  it('returns honest Wilson intervals, including zero successes and no available intervals', () => {
    expect(rate(0, 100).interval95![1]).toBeCloseTo(0.0369934982, 9);
    expect(rate(100, 100).interval95![0]).toBeCloseTo(0.9630065018, 9);
    expect(rate(0, 0)).toMatchObject({ value: null, interval95: null });
    expect(() => rate(2, 1)).toThrow();
  });
  it.each([
    { rho: 1 },
    { illnessRate: -1 },
    { missingMetricRate: NaN },
    { missedTapRate: 1.1 },
    { seed: -1 },
    { to: '2026-02-30' },
  ])('rejects invalid model parameters %j', (bad) => {
    expect(() => generatePerson({ ...config, ...bad })).toThrow();
  });
  it('serves owner-bound synthetic data through the provider contract', async () => {
    const person = generatePerson(config),
      provider = syntheticProvider('alice', {
        nights: person.history.map((entry) => entry.night),
        workouts: [...person.workouts],
        tags: [...person.tags],
      });
    const from = new Date('2026-02-01'),
      to = new Date('2026-02-03');
    expect(await provider.fetchNights('alice', from, to)).toHaveLength(2);
    await expect(provider.fetchNights('bob', from, to)).rejects.toThrow('owner');
    await expect(provider.fetchWorkouts('bob', from, to)).rejects.toThrow('owner');
    expect(() =>
      syntheticProvider('alice', {
        nights: [{ ...person.history[0]!.night, source: 'oura' }],
        workouts: [],
        tags: [],
      }),
    ).toThrow('synthetic-only');
  });
  it('makes three repeatable six-month demo profiles without changing ambiguous source answers', () => {
    const users = createDemoUsers('2026-10-03');
    expect(users).toHaveLength(3);
    expect(users.map((user) => user.person.history.length)).toEqual([183, 183, 183]);
    expect(users.map((user) => user.analysis.verdict)).toEqual(['Kept', 'Dropped', 'Inconclusive']);
    expect(users[0]!.answers.fish?.goal).toBeUndefined();
    expect(users[0]!.registration.baseline.skipped).toBe(true);
    expect(users[0]!.registration.schedule.totalDays).toBe(42);
    expect(users).toEqual(createDemoUsers('2026-10-03'));
    const view = demoView(users[0]!);
    expect(view.experiment.result.interval).toBeNull();
    expect(view.experiment.result.intervalStatus).toBe('coverage_not_established');
    const serialized = JSON.stringify(view.experiment.result);
    for (const key of ['pValue', 'randomization', 'alpha', 'seed', 'injectedEffect'])
      expect(serialized).not.toContain(`"${key}"`);
    expect(sixMonthsBefore('2026-08-31')).toBe('2026-02-28');
  });
});
