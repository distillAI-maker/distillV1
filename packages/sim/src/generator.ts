import { emptyMetrics, nightRecordSchema } from '@distill/providers';
import type { NightRecord, Tag, Workout } from '@distill/providers';
import type { Exclusion, HistoricalNight, MetricField } from '@distill/engine/experiment';
import { addDays, assertDate, immutable, weekday } from '../../engine/src/experiment/utils.js';
import { deriveSeed, Random } from './random.js';
import { observedValue, personModels } from './model.js';
import type { MetricModel } from './model.js';

export interface GeneratorConfig {
  readonly seed: number;
  readonly personId: string;
  readonly from: string;
  readonly to: string;
  readonly rho?: number;
  readonly weekendSwing?: number;
  readonly illnessRate?: number;
  readonly missedTapRate?: number;
  readonly missingMetricRate?: number;
  readonly deviceNoiseFraction?: number;
  readonly missingness?: 'independent' | 'assignment_dependent' | 'outcome_assignment_dependent';
  /** Harness optimization; omitted fields remain genuinely missing, never zero. */
  readonly metrics?: readonly MetricField[];
  readonly effect?: {
    readonly metric: MetricField;
    readonly swingUnits: number;
    readonly direction: 'higher' | 'lower';
    readonly onDates: readonly string[];
    readonly carryoverDays?: number;
    readonly carryoverFraction?: number;
  };
}
export interface SyntheticDay {
  readonly sleepDate: string;
  readonly missedTap: boolean;
  readonly ill: boolean;
  readonly actualOn: boolean;
  /** Counterfactual same-night values before and after treatment, including sensor bounds. */
  readonly noTreatmentValue: number | null;
  readonly treatedValue: number | null;
}
export interface SyntheticPerson {
  readonly version: 1;
  readonly synthetic: true;
  readonly seed: number;
  readonly personId: string;
  readonly models: Readonly<Record<MetricField, MetricModel>>;
  readonly history: readonly HistoricalNight[];
  readonly days: readonly SyntheticDay[];
  readonly workouts: readonly Workout[];
  readonly tags: readonly Tag[];
}
export function generatePerson(config: GeneratorConfig): SyntheticPerson {
  assertDate(config.from);
  assertDate(config.to);
  const count = (+new Date(config.to) - +new Date(config.from)) / 86400000;
  if (!config.personId || !Number.isInteger(count) || count < 1 || count > 3660)
    throw new Error('Invalid synthetic person/date range');
  const rho = config.rho ?? 0.35,
    noise = config.deviceNoiseFraction ?? 0.1;
  const illnessRate = config.illnessRate ?? 0.02,
    missed = config.missedTapRate ?? 0.1;
  const missing = config.missingMetricRate ?? 0.02,
    weekend = config.weekendSwing ?? 0.25;
  if (
    !Number.isFinite(rho) ||
    Math.abs(rho) >= 1 ||
    !Number.isFinite(weekend) ||
    [noise, illnessRate, missed, missing].some(
      (value) => !Number.isFinite(value) || value < 0 || value > 1,
    ) ||
    (config.missingness !== undefined &&
      !['independent', 'assignment_dependent', 'outcome_assignment_dependent'].includes(
        config.missingness,
      ))
  )
    throw new Error('Invalid synthetic model parameters');
  const effect = config.effect;
  if (
    effect &&
    (!Number.isFinite(effect.swingUnits) ||
      !['higher', 'lower'].includes(effect.direction) ||
      !Number.isInteger(effect.carryoverDays ?? 0) ||
      (effect.carryoverDays ?? 0) < 0 ||
      (effect.carryoverDays ?? 0) > 14 ||
      !Number.isFinite(effect.carryoverFraction ?? 0) ||
      Math.abs(effect.carryoverFraction ?? 0) > 2)
  )
    throw new Error('Invalid injected effect');
  effect?.onDates.forEach(assertDate);
  const onDates = new Set(effect?.onDates ?? []);
  const models = personModels(deriveSeed(config.seed, 'person'));
  if (effect && !Object.hasOwn(models, effect.metric)) throw new Error('Unknown outcome metric');
  const fields = config.metrics ? [...config.metrics] : (Object.keys(models) as MetricField[]);
  if (
    !fields.length ||
    new Set(fields).size !== fields.length ||
    fields.some((field) => !Object.hasOwn(models, field)) ||
    (effect && !fields.includes(effect.metric))
  )
    throw new Error('Invalid generated metrics');
  const ar = new Map(
    fields.map((field) => [field, new Random(deriveSeed(config.seed, `ar:${field}`))]),
  );
  const sensor = new Map(
    fields.map((field) => [field, new Random(deriveSeed(config.seed, `sensor:${field}`))]),
  );
  const states = new Map(fields.map((field) => [field, ar.get(field)!.normal()]));
  const illness = new Random(deriveSeed(config.seed, 'illness'));
  const taps = new Random(deriveSeed(config.seed, 'taps'));
  const absence = new Random(deriveSeed(config.seed, 'missing'));
  const events = new Random(deriveSeed(config.seed, 'events'));
  const history: HistoricalNight[] = [],
    days: SyntheticDay[] = [],
    workouts: Workout[] = [],
    tags: Tag[] = [];
  let lastOn = -100;
  for (let index = 0; index < count; index++) {
    const sleepDate = addDays(config.from, index),
      activityDate = addDays(sleepDate, -1);
    const actualOn = onDates.has(sleepDate),
      ill = illness.uniform() < illnessRate;
    const tapDraw = taps.uniform();
    let missedTap =
      tapDraw <
      Math.min(1, missed + (config.missingness === 'assignment_dependent' && actualOn ? 0.35 : 0));
    const record: NightRecord = {
      ...emptyMetrics,
      sleepDate,
      source: 'synthetic',
      sourceId: `${config.personId}:${sleepDate}`,
      rawPayloadId: `${config.personId}:${sleepDate}:synthetic`,
      deviceModel: 'Distill synthetic v1',
      hrvMethod: 'rmssd',
      sleepStart: `${activityDate}T23:00:00Z`,
      sleepEnd: `${sleepDate}T07:00:00Z`,
    };
    let noTreatmentValue: number | null = null,
      treatedValue: number | null = null;
    for (const field of fields) {
      const model = models[field];
      const state = rho * states.get(field)! + Math.sqrt(1 - rho ** 2) * ar.get(field)!.normal();
      states.set(field, state);
      const center =
        field === 'overnightHrvMs' ? Math.log(model.mean) - model.swing ** 2 / 2 : model.mean;
      const illnessSign =
        field === 'overnightHrvMs' ||
        field === 'totalSleepMinutes' ||
        field === 'sleepEfficiencyPercent'
          ? -1
          : 1;
      const value =
        center +
        model.swing *
          (Math.sqrt(1 - noise ** 2) * state +
            noise * sensor.get(field)!.normal() +
            ([0, 6].includes(weekday(activityDate)) ? weekend : 0) +
            (ill ? 2.5 * illnessSign : 0));
      let observed = value;
      if (effect?.metric === field) {
        const delta = effect.swingUnits * model.swing * (effect.direction === 'higher' ? 1 : -1);
        noTreatmentValue = observedValue(field, value, model);
        treatedValue = observedValue(field, value + delta, model);
        if (actualOn) observed += delta;
        else if (index - lastOn <= (effect.carryoverDays ?? 0))
          observed += delta * (effect.carryoverFraction ?? 0);
      }
      const raw = observedValue(field, observed, model);
      record[field] = absence.uniform() < missing ? null : raw;
    }
    if (actualOn) lastOn = index;
    // Deliberately invalid stress: preferentially omit bad on-nights. No extra RNG draws.
    if (
      config.missingness === 'outcome_assignment_dependent' &&
      effect &&
      actualOn &&
      noTreatmentValue !== null
    ) {
      const model = models[effect.metric];
      const value =
        effect.metric === 'overnightHrvMs'
          ? Math.log(noTreatmentValue / model.mean)
          : noTreatmentValue - model.mean;
      const badNight = effect.direction === 'higher' ? value < 0 : value > 0;
      if (badNight && tapDraw < 0.7) missedTap = true;
    }
    if (record.totalSleepMinutes !== null) {
      const total = record.totalSleepMinutes;
      // Keep stages plausible without changing the outcome under test.
      if (record.deepSleepMinutes !== null && effect?.metric !== 'deepSleepMinutes')
        record.deepSleepMinutes = Math.min(record.deepSleepMinutes ?? 0, total * 0.35);
      if (record.remSleepMinutes !== null && effect?.metric !== 'remSleepMinutes')
        record.remSleepMinutes = Math.min(record.remSleepMinutes ?? 0, total * 0.4);
      const awake = record.wakeAfterSleepOnsetMinutes ?? 30;
      record.sleepStart = new Date(
        +new Date(record.sleepEnd!) - (total + awake) * 60000,
      ).toISOString();
    }
    const exclusions: Exclusion[] = ill ? ['ill'] : [];
    history.push({ night: nightRecordSchema.parse(record), exclusions });
    days.push({ sleepDate, missedTap, ill, actualOn, noTreatmentValue, treatedValue });
    if (events.uniform() < 0.4)
      workouts.push({
        source: 'synthetic',
        sourceId: `${config.personId}:workout:${activityDate}`,
        deviceModel: 'Distill synthetic v1',
        rawPayloadId: `${config.personId}:workout:${activityDate}:raw`,
        start: `${activityDate}T17:00:00Z`,
        end: `${activityDate}T18:00:00Z`,
        activity: 'training',
      });
    if (ill || actualOn)
      tags.push({
        source: 'synthetic',
        sourceId: `${config.personId}:tag:${activityDate}`,
        rawPayloadId: `${config.personId}:tag:${activityDate}:raw`,
        start: `${activityDate}T20:00:00Z`,
        end: null,
        labels: [ill ? 'synthetic_illness' : 'synthetic_on'],
      });
  }
  return immutable({
    version: 1,
    synthetic: true,
    seed: config.seed,
    personId: config.personId,
    models,
    history,
    days,
    workouts,
    tags,
  });
}
