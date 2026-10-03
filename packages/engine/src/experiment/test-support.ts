import { emptyMetrics } from '@distill/providers';
import { routeStack } from '../route/index.js';
import { planBaseline } from './baseline.js';
import { startExperiment } from './registration.js';
import type { StartExperimentInput } from './registration.js';
import type { HistoricalNight } from './types.js';
import { addDays } from './utils.js';

export const lockedAt = '2026-10-05T12:00:00Z';
export const history: HistoricalNight[] = Array.from({ length: 28 }, (_, index) => ({
  night: {
    ...emptyMetrics,
    sleepDate: addDays('2026-09-08', index),
    source: 'oura',
    sourceId: `night-${index}`,
    deviceModel: null,
    rawPayloadId: `raw-${index}`,
    hrvMethod: 'rmssd',
    sleepStart: `${addDays('2026-09-07', index)}T23:00:00Z`,
    sleepEnd: `${addDays('2026-09-08', index)}T07:00:00Z`,
    totalSleepMinutes: 400 + (index % 7) * 5,
    overnightHrvMs: 35 + (index % 7) * 3,
    restingHeartRateBpm: 50 + (index % 5),
    skinTemperatureDeviationC: (index % 5) / 10,
  },
}));
export function startInput(overrides: Partial<StartExperimentInput> = {}): StartExperimentInput {
  const candidate = routeStack([{ id: 'coffee', key: 'coffee-after-2pm' }], {
    coffee: { goal: 'sleep', time: '2 to 5pm' },
  }).runnable[0]!;
  return {
    experimentId: '20000000-0000-4000-8000-000000000001',
    cycleId: '30000000-0000-4000-8000-000000000001',
    candidate,
    baseline: planBaseline(
      history,
      'totalSleepMinutes',
      { source: 'oura' },
      '2026-10-05',
      '2026-10-05',
    ),
    lockedAt,
    timeZone: 'UTC',
    seed: 17,
    direction: 'lower',
    onDefinition: 'Your existing late-coffee timing',
    offDefinition: 'No coffee after noon',
    ...overrides,
  };
}
export const testRegistration = () => startExperiment(startInput());
