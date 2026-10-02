import { z } from 'zod';

export const providerIdSchema = z.enum([
  'oura',
  'whoop',
  'fitbit',
  'apple_export',
  'garmin',
  'csv',
  'synthetic',
]);
export type ProviderId = z.infer<typeof providerIdSchema>;
export type OAuthProviderId = 'oura' | 'whoop' | 'fitbit';
export const sleepDateSchema = z.iso.date();
const duration = z.number().finite().min(0).max(1440).nullable();
export const metricsSchema = z.object({
  totalSleepMinutes: duration,
  sleepLatencyMinutes: duration,
  deepSleepMinutes: duration,
  remSleepMinutes: duration,
  wakeAfterSleepOnsetMinutes: duration,
  sleepEfficiencyPercent: z.number().min(0).max(100).nullable(),
  overnightHrvMs: z.number().min(0).max(1000).nullable(),
  restingHeartRateBpm: z.number().positive().max(300).nullable(),
  breathingRatePerMinute: z.number().positive().max(100).nullable(),
  skinTemperatureDeviationC: z.number().min(-10).max(10).nullable(),
});
export const nightRecordSchema = metricsSchema.extend({
  sleepDate: sleepDateSchema,
  source: providerIdSchema,
  sourceId: z.string().min(1).max(512),
  deviceModel: z.string().max(512).nullable(),
  rawPayloadId: z.string().min(1),
  // SDNN and RMSSD are different measurements; downstream code must not pool them.
  hrvMethod: z.enum(['rmssd', 'sdnn']).nullable(),
  sleepStart: z.iso.datetime({ offset: true }).nullable(),
  sleepEnd: z.iso.datetime({ offset: true }).nullable(),
});
export type NightRecord = z.infer<typeof nightRecordSchema>;
export const emptyMetrics: z.infer<typeof metricsSchema> = {
  totalSleepMinutes: null,
  sleepLatencyMinutes: null,
  deepSleepMinutes: null,
  remSleepMinutes: null,
  wakeAfterSleepOnsetMinutes: null,
  sleepEfficiencyPercent: null,
  overnightHrvMs: null,
  restingHeartRateBpm: null,
  breathingRatePerMinute: null,
  skinTemperatureDeviationC: null,
};
export interface Workout {
  source: ProviderId;
  sourceId: string;
  start: string;
  end: string | null;
  activity: string;
  deviceModel: string | null;
  rawPayloadId: string;
}
export interface Tag {
  source: ProviderId;
  sourceId: string;
  start: string;
  end: string | null;
  labels: string[];
  rawPayloadId: string;
}
/** Date bounds are UTC calendar labels: inclusive from, exclusive to, for local sleep dates. */
export interface Provider {
  id: ProviderId;
  fetchNights(userId: string, from: Date, to: Date): Promise<NightRecord[]>;
  fetchWorkouts(userId: string, from: Date, to: Date): Promise<Workout[]>;
  fetchTags?(userId: string, from: Date, to: Date): Promise<Tag[]>;
}
export type RawWriter = (kind: string, sourceId: string, payload: unknown) => Promise<string>;
export function dateLabel(date: Date): string {
  return date.toISOString().slice(0, 10);
}
export function inRange(day: string, from: Date, to: Date): boolean {
  return day >= dateLabel(from) && day < dateLabel(to);
}
export function localDate(instant: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(instant));
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function assertRange(from: Date, to: Date): void {
  if (!Number.isFinite(+from) || !Number.isFinite(+to) || from >= to)
    throw new Error('Invalid date range');
}
/** Keep the longest primary sleep, with stable tie-breaking; never add naps or two devices together. */
export function primaryNights(nights: NightRecord[]): NightRecord[] {
  const days = new Map<string, NightRecord>();
  for (const night of nights) {
    nightRecordSchema.parse(night);
    const previous = days.get(night.sleepDate);
    if (
      !previous ||
      (night.totalSleepMinutes ?? -1) > (previous.totalSleepMinutes ?? -1) ||
      (night.totalSleepMinutes === previous.totalSleepMinutes && night.sourceId < previous.sourceId)
    )
      days.set(night.sleepDate, night);
  }
  return [...days.values()].sort((a, b) => a.sleepDate.localeCompare(b.sleepDate));
}
