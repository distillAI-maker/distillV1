import { describe, expect, it } from 'vitest';
import data from '../../../../data/catalog.json' with { type: 'json' };
import { catalogSchema } from '@distill/catalog';
import { routeStack } from '../route/index.js';
import { toneLint } from '../tone.js';
import { planBaseline, usableHistory } from './baseline.js';
import { createSchedule, enumerateAssignments } from './schedule.js';
import { rankCandidates, selectCandidate, vetoCandidate } from './selection.js';
import { assertPreRegistration, startExperiment, switchExperiment } from './registration.js';
import { dailyCopy, dailyInstruction, recordCheckIn } from './daily.js';
import {
  alcoholSignature,
  confirmAlcoholSignature,
  historyDataQuality,
  historyHypothesis,
  itemHistoryHypothesis,
  inferBehavior,
  observationFromTags,
} from './history.js';
import { history, lockedAt, startInput, testRegistration } from './test-support.js';
import { addDays, localDateTime, nextMonday, weekday } from './utils.js';
import type { BehaviorObservation, HistoricalNight } from './types.js';

describe('constrained schedules', () => {
  it('enumerates exact equal sides, balanced weekends, and no three same-condition blocks', () => {
    const space = enumerateAssignments('2026-10-05');
    expect(new Set(space.map((assignment) => assignment.join())).size).toBe(space.length);
    for (let seed = 0; seed < 50; seed++) {
      const schedule = createSchedule('2026-10-05', seed, false);
      expect(schedule.days).toHaveLength(14);
      expect(schedule.days.filter((day) => day.condition === 'on')).toHaveLength(7);
      expect(schedule.days.filter((day) => day.condition === 'off')).toHaveLength(7);
      const weekends = schedule.days.filter((day) => [0, 6].includes(weekday(day.date)));
      expect(weekends.filter((day) => day.condition === 'on')).toHaveLength(2);
      const blocks = schedule.days
        .filter((day, index) => !index || day.block !== schedule.days[index - 1]!.block)
        .map((day) => day.condition);
      expect(
        blocks.some(
          (condition, index) =>
            index >= 2 && condition === blocks[index - 1] && condition === blocks[index - 2],
        ),
      ).toBe(false);
      expect(space[schedule.assignmentIndex]).toEqual(blocks);
    }
  });
  it('replays the stored seed exactly and freezes nested schedule values', () => {
    const result = createSchedule('2026-10-05', 17, false);
    expect(result).toEqual(createSchedule('2026-10-05', 17, false));
    expect(() => {
      (result.days[0] as { condition: string }).condition = 'off';
    }).toThrow();
    expect(
      new Set(
        Array.from(
          { length: 50 },
          (_, seed) => createSchedule('2026-10-05', seed, false).assignmentIndex,
        ),
      ).size,
    ).toBeGreaterThan(1);
  });
  it('uses valid carryover blocks with at least five potentially usable nights per side', () => {
    const schedule = createSchedule('2026-10-05', 1, false, { dropFirstNightOfBlock: true });
    expect(schedule.blockLengths).toEqual([3, 3, 4, 4]);
    expect(schedule.days.filter((day) => day.excludedForCarryover)).toHaveLength(4);
    for (const condition of ['on', 'off'])
      expect(
        schedule.days.filter((day) => day.condition === condition && !day.excludedForCarryover),
      ).toHaveLength(5);
  });
  it('rejects the brief layout and ordinary six-block carryover layout instead of fudging balance', () => {
    expect(() => createSchedule('2026-10-05', 1, false, { blockLengths: [3, 3, 3, 3, 2] })).toThrow(
      'No balanced schedule',
    );
    expect(() =>
      createSchedule('2026-10-05', 1, false, {
        blockLengths: [3, 3, 1, 3, 3, 1],
        dropFirstNightOfBlock: true,
      }),
    ).toThrow('No balanced schedule');
  });
  it('reports an inadequate exact-test resolution without claiming statistical power', () => {
    const schedule = createSchedule('2026-10-05', 17, false);
    expect(schedule.minimumAttainableOneSidedP).toBe(1 / schedule.assignmentCount);
    expect(schedule.limitations).toContain('assignment_space_cannot_reach_p_below_0_05');
  });
  it('supports explicit longer layouts while leaving empirical validation to phase 6', () => {
    const schedule = createSchedule('2026-10-05', 1, false, {
      totalDays: 28,
      blockLengths: [3, 3, 1, 3, 3, 1, 3, 3, 1, 3, 3, 1],
      dropFirstNightOfBlock: true,
    });
    expect(schedule.days).toHaveLength(28);
    expect(schedule.assignmentCount).toBeGreaterThan(20);
  });
  it('observational schedules never contain an assigned on-night', () => {
    const schedule = createSchedule('2026-10-05', 19, true, { dropFirstNightOfBlock: true });
    expect(schedule.days.some((day) => day.condition === 'on')).toBe(false);
    expect(schedule.design).toBe('observational');
    expect(schedule.minimumAttainableOneSidedP).toBeNull();
  });
  it.each([-1, 1.5, NaN, 0x100000000])('rejects invalid seed %s', (seed) => {
    expect(() => createSchedule('2026-10-05', seed, false)).toThrow('uint32');
  });
  it('calendar labels stay correct across DST and start dates must be Mondays', () => {
    expect(nextMonday('2026-10-02')).toBe('2026-10-05');
    expect(nextMonday('2026-10-05')).toBe('2026-10-05');
    expect(() => createSchedule('2026-10-06', 1, false)).toThrow('Monday');
    expect(() => createSchedule('2026-02-30', 1, false)).toThrow('date');
    const schedule = createSchedule('2026-10-26', 1, false);
    expect(schedule.days[6]).toMatchObject({ date: '2026-11-01', sleepDate: '2026-11-02' });
    expect(localDateTime('2026-11-01T09:00:00Z', 'America/Los_Angeles').date).toBe('2026-11-01');
  });
});

describe('baseline and selection', () => {
  it('skips watching only with 28 usable dates on the selected channel and metric', () => {
    expect(
      planBaseline(history, 'totalSleepMinutes', { source: 'oura' }, '2026-10-05', '2026-10-05'),
    ).toMatchObject({ skipped: true, status: 'ready', usableNights: 28 });
    expect(
      planBaseline(
        history.slice(1),
        'totalSleepMinutes',
        { source: 'oura' },
        '2026-10-05',
        '2026-10-05',
      ),
    ).toMatchObject({ skipped: false, status: 'watching' });
  });
  it('watches for seven calendar days with no early baseline completion', () => {
    const watching = history
      .slice(0, 7)
      .map((row, index) => ({ night: { ...row.night, sleepDate: addDays('2026-10-06', index) } }));
    expect(
      planBaseline(watching, 'totalSleepMinutes', { source: 'oura' }, '2026-10-05', '2026-10-11')
        .status,
    ).toBe('watching');
    expect(
      planBaseline(watching, 'totalSleepMinutes', { source: 'oura' }, '2026-10-05', '2026-10-12'),
    ).toMatchObject({ status: 'ready', usableNights: 7 });
  });
  it('does not count missing, flagged, duplicate, future or wrong-provider nights', () => {
    const records: HistoricalNight[] = [
      history[0]!,
      { ...history[1]!, exclusions: ['ill'] },
      { night: { ...history[2]!.night, totalSleepMinutes: null } },
      { night: { ...history[3]!.night, source: 'whoop' } },
      { night: { ...history[4]!.night, sleepDate: '2027-01-01' } },
    ];
    expect(
      usableHistory(records, 'totalSleepMinutes', { source: 'oura' }, '2026-10-05'),
    ).toHaveLength(1);
    expect(() =>
      usableHistory(
        [history[0]!, history[0]!],
        'totalSleepMinutes',
        { source: 'oura' },
        '2026-10-05',
      ),
    ).toThrow('Multiple usable');
  });
  it('zero variability cannot be guessed into a personal swing', () => {
    const flat = history.map((row) => ({ night: { ...row.night, totalSleepMinutes: 400 } }));
    expect(
      planBaseline(flat, 'totalSleepMinutes', { source: 'oura' }, '2026-10-05', '2026-10-05')
        .status,
    ).toBe('insufficient_data');
  });
  it('HRV uses log swing and never pools SDNN/RMSSD; latency artifacts are excluded', () => {
    expect(
      planBaseline(
        history,
        'overnightHrvMs',
        { source: 'oura', hrvMethod: 'rmssd' },
        '2026-10-05',
        '2026-10-05',
      ).swing?.scale,
    ).toBe('log');
    expect(
      planBaseline(
        history,
        'overnightHrvMs',
        { source: 'oura', hrvMethod: 'sdnn' },
        '2026-10-05',
        '2026-10-05',
      ).usableNights,
    ).toBe(0);
    expect(
      usableHistory(
        [{ night: { ...history[0]!.night, sleepLatencyMinutes: 61 } }],
        'sleepLatencyMinutes',
        { source: 'oura' },
        '2026-10-05',
      ),
    ).toHaveLength(0);
  });
  it('ranks only runnable candidates by quality and hypothesis strength, with one veto per cycle', () => {
    const stack = routeStack(
      [
        { id: 'coffee', key: 'coffee-after-2pm' },
        { id: 'alcohol', key: 'alcohol-in-the-evening' },
        { id: 'p', key: 'iron' },
      ],
      {
        coffee: { goal: 'sleep', time: '2 to 5pm' },
        alcohol: { goal: 'sleep', nightsPerWeek: 3 },
        p: {},
      },
    );
    const ranked = rankCandidates(stack, {
      coffee: { dataQuality: 1, historyStrength: 2 },
      alcohol: { dataQuality: 0.5 },
    });
    expect(ranked.map((candidate) => candidate.item.id)).toEqual(['coffee', 'alcohol']);
    const cycle = vetoCandidate({ id: 'cycle', vetoedItemId: null }, ranked);
    expect(selectCandidate(ranked, cycle)?.item.id).toBe('alcohol');
    expect(() => vetoCandidate(cycle, ranked)).toThrow('already used');
    expect(
      rankCandidates(stack, { coffee: { dataQuality: 0 }, alcohol: { dataQuality: 0 } }),
    ).toHaveLength(0);
    expect(() =>
      rankCandidates(stack, { coffee: { dataQuality: 2 }, alcohol: { dataQuality: 1 } }),
    ).toThrow('factors');
  });
});

describe('pre-registration and daily loop', () => {
  it('locks nested fields and detaches all references to candidate, baseline and config', () => {
    const input = startInput();
    const record = startExperiment(input);
    expect(record).toMatchObject({ alpha: 0.05, direction: 'lower', metric: 'totalSleepMinutes' });
    expect(() => {
      (record as { metric: string }).metric = 'overnightHrvMs';
    }).toThrow();
    expect(() => {
      (record.personalSwing as { value: number }).value = 1;
    }).toThrow();
    (input.candidate as { name: string }).name = 'changed';
    expect(record.itemKey).toBe('coffee-after-2pm');
    expect(() => assertPreRegistration(record)).not.toThrow();
  });
  it('detects tampered schedules, pass lines and channel data on reload', () => {
    const record = structuredClone(testRegistration());
    (record.schedule.days[0] as { condition: string }).condition = 'observe';
    expect(() => assertPreRegistration(record)).toThrow('Schedule');
    expect(() => assertPreRegistration({ ...testRegistration(), alpha: 0.1 } as never)).toThrow(
      'pre-registration',
    );
    expect(() =>
      assertPreRegistration({ ...testRegistration(), channel: { source: 'whoop' } }),
    ).toThrow('baseline');
  });
  it('refuses Protected, queued, unresolved or non-ready starts and concurrent experiments', () => {
    for (const tier of ['PROTECTED', 'T1_QUEUED_SLOW', 'T3'])
      expect(() =>
        startExperiment(startInput({ candidate: { ...startInput().candidate, tier } as never })),
      ).toThrow('runnable');
    expect(() =>
      startExperiment(startInput({ baseline: { ...startInput().baseline, status: 'watching' } })),
    ).toThrow('baseline');
    expect(() => startExperiment(startInput(), [testRegistration()])).toThrow('already active');
  });
  it('switches to a fresh record in the same cycle without rewriting the previous registration', () => {
    const current = testRegistration(),
      before = structuredClone(current);
    const candidate = routeStack([{ id: 'dinner', key: 'late-dinner-within-2-3-h-of-bed' }], {
      dinner: { goal: 'sleep', dinnerToBedMinutes: 60 },
    }).runnable[0]!;
    const input = startInput({
      experimentId: 'new-id',
      candidate,
      baseline: planBaseline(
        history.map((row) => ({
          night: { ...row.night, sleepLatencyMinutes: row.night.totalSleepMinutes! / 10 },
        })),
        'sleepLatencyMinutes',
        { source: 'oura' },
        '2026-10-05',
        '2026-10-05',
      ),
    });
    const switched = switchExperiment(current, input);
    expect(switched.next.experimentId).toBe('new-id');
    expect(current).toEqual(before);
    expect(() => switchExperiment(current, startInput())).toThrow('Invalid');
  });
  it('carryover defaults on for alcohol and its schedule only offers off or observe', () => {
    const candidate = routeStack([{ id: 'a', key: 'alcohol-in-the-evening' }], {
      a: { goal: 'sleep', nightsPerWeek: 3 },
    }).runnable[0]!;
    const record = startExperiment(
      startInput({
        candidate,
        baseline: planBaseline(
          history,
          'overnightHrvMs',
          { source: 'oura', hrvMethod: 'rmssd' },
          '2026-10-05',
          '2026-10-05',
        ),
      }),
    );
    expect(record.schedule.dropFirstNightOfBlock).toBe(true);
    expect(record.schedule.design).toBe('observational');
    expect(record.schedule.days.some((day) => day.condition === 'on')).toBe(false);
    const observe = record.schedule.days.find((day) => day.condition === 'observe')!;
    expect(recordCheckIn(record, { sleepDate: observe.sleepDate, tap: 'did' }).exposure).toBe(
      'unknown',
    );
    expect(recordCheckIn(record, { sleepDate: observe.sleepDate, exposure: 'on' }).provenance).toBe(
      'self_report',
    );
    expect(dailyInstruction(record, observe.date).text).toBe(dailyCopy.observe);
  });
  it('all source observe-only keys reject a forged assigned-on registration', () => {
    const record = testRegistration();
    for (const item of catalogSchema
      .parse(data)
      .items.filter((item) => item.onDays === 'observe')) {
      expect(() => assertPreRegistration({ ...record, itemKey: item.key })).toThrow('Observe-only');
    }
  });
  it('missed taps stay unknown, check-in flags and carryover prevent usable nights', () => {
    const record = testRegistration(),
      day = record.schedule.days[0]!;
    expect(recordCheckIn(record, { sleepDate: day.sleepDate })).toMatchObject({
      tap: 'unknown',
      exposure: 'unknown',
      usable: false,
    });
    expect(recordCheckIn(record, { sleepDate: day.sleepDate, tap: 'did' })).toMatchObject({
      exposure: day.condition,
      usable: true,
    });
    expect(
      recordCheckIn(record, { sleepDate: day.sleepDate, tap: 'did', exclusions: ['ill'] }).usable,
    ).toBe(false);
    const carry = startExperiment(startInput({ config: { dropFirstNightOfBlock: true } }));
    expect(
      recordCheckIn(carry, { sleepDate: carry.schedule.days[0]!.sleepDate, tap: 'did' }).usable,
    ).toBe(false);
    expect(() => recordCheckIn(record, { sleepDate: '2027-01-01' })).toThrow('outside');
  });
  it('known wearable compliance replaces a tap; missing inference still offers the tap', () => {
    const record = testRegistration(),
      day = record.schedule.days[0]!;
    const observed: BehaviorObservation = {
      sleepDate: day.sleepDate,
      exposure: 'off',
      provenance: 'wearable',
      confirmed: true,
    };
    expect(dailyInstruction(record, day.date, observed).askForTap).toBe(false);
    expect(dailyInstruction(record, day.date).askForTap).toBe(true);
    expect(recordCheckIn(record, { sleepDate: day.sleepDate, inferred: observed })).toMatchObject({
      tap: 'unknown',
      exposure: 'off',
      provenance: 'wearable',
      usable: true,
    });
    expect(dailyInstruction(null, '2026-10-05').kind).toBe('none');
  });
  it('all generated daily instruction strings pass the tone checks', () => {
    const rules = catalogSchema.parse(data).toneRules;
    for (const text of Object.values(dailyCopy)) expect(toneLint(text, rules)).toEqual([]);
  });
});

describe('recorded behavior and observational hypotheses', () => {
  const night = history[0]!.night;
  it('uses workout end timestamps, ignores other sources, and never infers off from a missing fetch', () => {
    const workout = {
      source: 'oura' as const,
      sourceId: 'w',
      start: '2026-09-07T20:00:00Z',
      end: '2026-09-07T21:30:00Z',
      activity: 'training',
      rawPayloadId: 'w',
      deviceModel: null,
    };
    expect(
      inferBehavior(
        night,
        'UTC',
        { kind: 'late_workout', minutesBeforeBed: 120 },
        { workouts: [workout] },
      ).exposure,
    ).toBe('on');
    expect(
      inferBehavior(night, 'UTC', { kind: 'late_workout', minutesBeforeBed: 120 }).exposure,
    ).toBe('unknown');
    expect(
      inferBehavior(
        night,
        'UTC',
        { kind: 'late_workout', minutesBeforeBed: 120 },
        { coverage: { from: '2026-09-06T23:00:00Z', to: night.sleepStart! } },
      ).exposure,
    ).toBe('off');
  });
  it('wake windows handle midnight and naps use actual start time and duration', () => {
    expect(
      inferBehavior(night, 'UTC', { kind: 'wake_window', targetMinute: 420, toleranceMinutes: 30 })
        .exposure,
    ).toBe('on');
    const midnight = { ...night, sleepEnd: '2026-09-08T00:10:00Z' };
    expect(
      inferBehavior(midnight, 'UTC', {
        kind: 'wake_window',
        targetMinute: 1430,
        toleranceMinutes: 30,
      }).exposure,
    ).toBe('on');
    expect(
      inferBehavior(
        night,
        'UTC',
        { kind: 'nap', afterMinute: 900, longerThanMinutes: 30 },
        { naps: [{ start: '2026-09-07T16:00:00Z', end: '2026-09-07T16:20:00Z' }] },
      ).exposure,
    ).toBe('on');
  });
  it('maps recorded behavior to the saved restriction condition without guessing missing events', () => {
    const rule = {
      kind: 'nap' as const,
      afterMinute: 900,
      longerThanMinutes: 30,
      matchingExposure: 'off' as const,
    };
    expect(
      inferBehavior(night, 'UTC', rule, {
        naps: [{ start: '2026-09-07T16:00:00Z', end: '2026-09-07T16:20:00Z' }],
      }).exposure,
    ).toBe('off');
    expect(
      inferBehavior(night, 'UTC', rule, {
        coverage: { from: '2026-09-06T23:00:00Z', to: night.sleepStart! },
      }).exposure,
    ).toBe('on');
    expect(inferBehavior(night, 'UTC', rule).exposure).toBe('unknown');
    expect(startExperiment({ ...startInput(), complianceRule: rule }).complianceRule).toEqual(rule);
  });
  it('no tag is unknown; explicit on/off tags can conflict', () => {
    const tag = {
      source: 'oura' as const,
      sourceId: 'tag',
      start: '2026-09-07T20:00:00Z',
      end: null,
      labels: ['alcohol'],
      rawPayloadId: 'tag',
    };
    expect(observationFromTags(night, [], { on: ['alcohol'], off: ['no_alcohol'] }).exposure).toBe(
      'unknown',
    );
    expect(
      observationFromTags(night, [tag], { on: ['alcohol'], off: ['no_alcohol'] }).exposure,
    ).toBe('on');
    expect(
      observationFromTags(night, [{ ...tag, labels: ['alcohol', 'no_alcohol'] }], {
        on: ['alcohol'],
        off: ['no_alcohol'],
      }).exposure,
    ).toBe('unknown');
  });
  it('the alcohol signature is only a suggestion until the person confirms it', () => {
    const shifted = {
      ...night,
      overnightHrvMs: 30,
      restingHeartRateBpm: 60,
      skinTemperatureDeviationC: 0.5,
    };
    const suggestion = alcoholSignature(shifted, {
      channel: { source: 'oura', hrvMethod: 'rmssd' },
      hrvMs: 40,
      restingHeartRateBpm: 50,
      temperatureDeviationC: 0,
    })!;
    expect(suggestion).toMatchObject({ exposure: 'unknown', confirmed: false });
    expect(confirmAlcoholSignature(suggestion, true)).toMatchObject({
      exposure: 'on',
      confirmed: true,
      provenance: 'self_report',
    });
    expect(confirmAlcoholSignature(suggestion, false).exposure).toBe('off');
  });
  it('compares confirmed on/off nights in real units and always labels them as a hypothesis', () => {
    const observations = history.map((row, index): BehaviorObservation => ({
      sleepDate: row.night.sleepDate,
      exposure: index < 14 ? 'on' : 'off',
      provenance: 'self_report',
      confirmed: true,
    }));
    const result = historyHypothesis(
      history,
      observations,
      'totalSleepMinutes',
      { source: 'oura' },
      '2026-10-05',
    );
    expect(result).toMatchObject({
      label: 'hypothesis',
      randomized: false,
      onNights: 14,
      offNights: 14,
      difference: 0,
    });
    expect(
      historyHypothesis(
        history,
        observations.map((row) => ({ ...row, confirmed: false })),
        'totalSleepMinutes',
        { source: 'oura' },
        '2026-10-05',
      ),
    ).toBeNull();
    expect(historyDataQuality(history, 'totalSleepMinutes', { source: 'oura' })).toBe(1);
  });
  it('history hypotheses require five confirmed usable nights on each side', () => {
    const observations = history.slice(0, 5).map((row): BehaviorObservation => ({
      sleepDate: row.night.sleepDate,
      exposure: 'on',
      provenance: 'self_report',
      confirmed: true,
    }));
    expect(
      historyHypothesis(
        history,
        observations,
        'totalSleepMinutes',
        { source: 'oura' },
        '2026-10-05',
      ),
    ).toBeNull();
  });
  it('unconfirmed physiological patterns cannot enter a history comparison or Protected output', () => {
    const observations = history.map((row, index): BehaviorObservation => ({
      sleepDate: row.night.sleepDate,
      exposure: index < 14 ? 'on' : 'off',
      provenance: 'alcohol_signature',
      confirmed: true,
    }));
    expect(
      historyHypothesis(
        history,
        observations,
        'totalSleepMinutes',
        { source: 'oura' },
        '2026-10-05',
      ),
    ).toBeNull();
    const item = routeStack([{ id: 'p', key: 'iron' }], { p: {} }).protected[0]!;
    expect(
      itemHistoryHypothesis(item, history, observations, { source: 'oura' }, '2026-10-05'),
    ).toBeNull();
  });
  it('data quality counts only the selected device channel while missing metrics lower quality', () => {
    const mixed = [
      ...history,
      ...history.map((row) => ({ night: { ...row.night, source: 'whoop' as const } })),
    ];
    expect(historyDataQuality(mixed, 'totalSleepMinutes', { source: 'oura' })).toBe(1);
    expect(
      historyDataQuality(
        [{ night: { ...history[0]!.night, totalSleepMinutes: null } }],
        'totalSleepMinutes',
        { source: 'oura' },
      ),
    ).toBe(0);
  });
  it('uses the local locking day rather than the server date', () => {
    const input = startInput({
      lockedAt: '2026-10-05T01:00:00Z',
      timeZone: 'America/Los_Angeles',
      baseline: planBaseline(
        history.map((row) => ({
          night: { ...row.night, sleepDate: addDays(row.night.sleepDate, -1) },
        })),
        'totalSleepMinutes',
        { source: 'oura' },
        '2026-10-04',
        '2026-10-04',
      ),
    });
    expect(startExperiment(input).schedule.startDate).toBe('2026-10-05');
    expect(lockedAt).toBe('2026-10-05T12:00:00Z');
  });
});
