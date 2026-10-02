import { ApiClient, ProviderError, minutes, number, object, objects, string } from './http.js';
import { assertRange, dateLabel, emptyMetrics, inRange, primaryNights } from './types.js';
import type { NightRecord, Provider, RawWriter, Workout } from './types.js';

/** Legacy compatibility only. New projects need Google Health API approval; see DATA_SOURCES.md. */
export class FitbitProvider implements Provider {
  readonly id = 'fitbit' as const;
  constructor(
    private api: ApiClient,
    private raw: RawWriter,
    private userId: string,
    private enabled = false,
    private now: () => Date = () => new Date(),
  ) {}
  private check(userId: string, from: Date, to: Date) {
    if (userId !== this.userId) throw new Error('Wrong provider owner');
    assertRange(from, to);
    if (!this.enabled || this.now() >= new Date('2026-10-30T00:00:00Z'))
      throw new ProviderError('fitbit_migration_required', 503);
  }
  async fetchNights(userId: string, from: Date, to: Date): Promise<NightRecord[]> {
    this.check(userId, from, to);
    const nights: NightRecord[] = [];
    // Legacy range endpoints have different limits. Use <=30 dates for all summaries.
    for (let cursor = +from; cursor < +to; cursor += 30 * 86400000) {
      const start = dateLabel(new Date(cursor)),
        end = dateLabel(new Date(Math.min(+to, cursor + 30 * 86400000) - 86400000));
      const sleeps = objects(
        (await this.api.get(`/1.2/user/-/sleep/date/${start}/${end}.json`)).sleep,
      );
      const hrv = objects((await this.api.get(`/1/user/-/hrv/date/${start}/${end}.json`)).hrv);
      const heart = objects(
        (await this.api.get(`/1/user/-/activities/heart/date/${start}/${end}.json`))[
          'activities-heart'
        ],
      );
      const breathing = objects((await this.api.get(`/1/user/-/br/date/${start}/${end}.json`)).br);
      const temperature = objects(
        (await this.api.get(`/1/user/-/temp/skin/date/${start}/${end}.json`)).tempSkin,
      );
      const summaries = { hrv, heart, breathing, temperature };
      for (const [kind, rows] of Object.entries(summaries))
        for (const r of rows) await this.raw(kind, string(r.dateTime), r);
      const valueFor = (rows: Record<string, unknown>[], day: string) => {
        const row = rows.find((r) => r.dateTime === day);
        return row ? object(row.value) : {};
      };
      for (const s of sleeps) {
        const day = string(s.dateOfSleep);
        if (s.isMainSleep !== true || !inRange(day, from, to)) continue;
        const levels = s.levels ? object(s.levels) : {};
        const summary = levels.summary ? object(levels.summary) : {};
        const stage = (key: string) => (summary[key] ? number(object(summary[key]).minutes) : null);
        const rawPayloadId = await this.raw('sleep', String(s.logId), s);
        nights.push({
          ...emptyMetrics,
          source: this.id,
          sourceId: String(s.logId),
          sleepDate: day,
          deviceModel: null,
          rawPayloadId,
          hrvMethod: 'rmssd',
          // Legacy Fitbit times have no offset. Keep them in raw data, never invent a UTC instant.
          sleepStart: null,
          sleepEnd: null,
          totalSleepMinutes: number(s.minutesAsleep),
          sleepLatencyMinutes: number(s.minutesToFallAsleep),
          deepSleepMinutes: s.type === 'stages' ? stage('deep') : null,
          remSleepMinutes: s.type === 'stages' ? stage('rem') : null,
          sleepEfficiencyPercent: number(s.efficiency),
          overnightHrvMs: number(valueFor(hrv, day).dailyRmssd),
          restingHeartRateBpm: number(valueFor(heart, day).restingHeartRate),
          breathingRatePerMinute: number(valueFor(breathing, day).breathingRate),
          skinTemperatureDeviationC: number(valueFor(temperature, day).nightlyRelative),
        });
      }
    }
    return primaryNights(nights);
  }
  async fetchWorkouts(userId: string, from: Date, to: Date): Promise<Workout[]> {
    this.check(userId, from, to);
    const result: Workout[] = [];
    let offset = 0;
    while (true) {
      const response = await this.api.get('/1/user/-/activities/list.json', {
        afterDate: dateLabel(new Date(+from - 86400000)),
        sort: 'asc',
        offset: String(offset),
        limit: '100',
      });
      const rows = objects(response.activities);
      let reachedEnd = false;
      for (const r of rows) {
        const start = string(r.startTime);
        // Workout list supplies a numeric UTC offset in its timestamp.
        if (!/[+-]\d{2}:?\d{2}$|Z$/.test(start))
          throw new ProviderError('fitbit_workout_timezone_missing');
        if (+new Date(start) >= +to) {
          reachedEnd = true;
          continue;
        }
        if (+new Date(start) < +from) continue;
        const duration = minutes(r.duration, 1);
        result.push({
          source: this.id,
          sourceId: String(r.logId),
          start,
          end: duration == null ? null : new Date(+new Date(start) + duration).toISOString(),
          activity: string(r.activityName),
          deviceModel: null,
          rawPayloadId: await this.raw('workout', String(r.logId), r),
        });
      }
      if (rows.length < 100 || reachedEnd) break;
      offset += rows.length;
      if (offset > 1000000) throw new ProviderError('pagination_limit');
    }
    return result;
  }
}
