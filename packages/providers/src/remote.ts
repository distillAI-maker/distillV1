import { ApiClient, number, minutes, object, string } from './http.js';
import { assertRange, dateLabel, emptyMetrics, inRange, primaryNights } from './types.js';
import type { NightRecord, Provider, RawWriter, Tag, Workout } from './types.js';

export class OuraProvider implements Provider {
  readonly id = 'oura' as const;
  constructor(
    private api: ApiClient,
    private raw: RawWriter,
    private userId: string,
    private scopes: string[],
  ) {}
  private rows(userId: string, kind: string, from: Date, to: Date) {
    if (userId !== this.userId) throw new Error('Wrong provider owner');
    assertRange(from, to);
    return this.api.pages(
      `/v2/usercollection/${kind}`,
      { start_date: dateLabel(from), end_date: dateLabel(to) },
      'data',
      'next_token',
    );
  }
  async fetchNights(userId: string, from: Date, to: Date): Promise<NightRecord[]> {
    const sleeps = await this.rows(userId, 'sleep', from, to);
    const readiness = await this.rows(userId, 'daily_readiness', from, to);
    const byDay = new Map(readiness.map((r) => [string(r.day), r]));
    for (const r of readiness) await this.raw('readiness', string(r.id), r);
    const nights: NightRecord[] = [];
    for (const s of sleeps) {
      if (s.type !== 'long_sleep' || !inRange(string(s.day), from, to)) continue;
      const r = byDay.get(string(s.day));
      nights.push({
        ...emptyMetrics,
        source: this.id,
        sourceId: string(s.id),
        sleepDate: string(s.day),
        deviceModel: null,
        rawPayloadId: await this.raw('sleep', string(s.id), s),
        hrvMethod: 'rmssd',
        sleepStart: string(s.bedtime_start),
        sleepEnd: string(s.bedtime_end),
        totalSleepMinutes: minutes(s.total_sleep_duration, 60),
        sleepLatencyMinutes: minutes(s.latency, 60),
        deepSleepMinutes: minutes(s.deep_sleep_duration, 60),
        remSleepMinutes: minutes(s.rem_sleep_duration, 60),
        // awake_time includes wake before sleep; it is not a documented WASO measurement.
        sleepEfficiencyPercent: number(s.efficiency),
        overnightHrvMs: number(s.average_hrv),
        restingHeartRateBpm: number(s.lowest_heart_rate),
        breathingRatePerMinute: number(s.average_breath),
        skinTemperatureDeviationC: number(r?.temperature_deviation),
      });
    }
    return primaryNights(nights);
  }
  async fetchWorkouts(userId: string, from: Date, to: Date): Promise<Workout[]> {
    if (!this.scopes.includes('workout')) return [];
    const rows = await this.rows(userId, 'workout', from, to);
    return Promise.all(
      rows
        .filter((r) => inRange(string(r.day), from, to))
        .map(async (r) => ({
          source: this.id,
          sourceId: string(r.id),
          start: string(r.start_datetime),
          end: string(r.end_datetime),
          activity: string(r.activity),
          deviceModel: null,
          rawPayloadId: await this.raw('workout', string(r.id), r),
        })),
    );
  }
  async fetchTags(userId: string, from: Date, to: Date): Promise<Tag[]> {
    if (!this.scopes.includes('tag')) return [];
    const result: Tag[] = [];
    for (const kind of ['tag', 'enhanced_tag']) {
      for (const r of await this.rows(userId, kind, from, to)) {
        const start = string(kind === 'tag' ? r.timestamp : r.start_time);
        const day =
          typeof r.day === 'string'
            ? r.day
            : typeof r.start_day === 'string'
              ? r.start_day
              : start.slice(0, 10);
        if (!inRange(day, from, to)) continue;
        const labels =
          kind === 'tag'
            ? (r.tags as string[])
            : ([r.custom_name ?? r.tag_type_code].filter((v) => typeof v === 'string') as string[]);
        result.push({
          source: this.id,
          sourceId: `${kind}:${string(r.id)}`,
          start,
          end: typeof r.end_time === 'string' ? r.end_time : null,
          labels,
          rawPayloadId: await this.raw(kind, string(r.id), r),
        });
      }
    }
    return result;
  }
}

export class WhoopProvider implements Provider {
  readonly id = 'whoop' as const;
  constructor(
    private api: ApiClient,
    private raw: RawWriter,
    private userId: string,
  ) {}
  private rows(userId: string, kind: string, from: Date, to: Date) {
    if (userId !== this.userId) throw new Error('Wrong provider owner');
    assertRange(from, to);
    // UTC query padded for local calendar boundaries, including extreme time zones.
    return this.api.pages(
      `/developer/v2/${kind}`,
      {
        start: new Date(+from - 86400000).toISOString(),
        end: new Date(+to + 86400000).toISOString(),
        limit: '25',
      },
      'records',
      'nextToken',
    );
  }
  async fetchNights(userId: string, from: Date, to: Date): Promise<NightRecord[]> {
    const sleeps = await this.rows(userId, 'activity/sleep', from, to);
    const recoveries = await this.rows(userId, 'recovery', from, to);
    const cycles = await this.rows(userId, 'cycle', from, to);
    for (const c of cycles) await this.raw('cycle', String(c.id), c);
    for (const r of recoveries) await this.raw('recovery', String(r.cycle_id), r);
    const bySleep = new Map(recoveries.map((r) => [string(r.sleep_id), r]));
    const nights: NightRecord[] = [];
    for (const s of sleeps) {
      if (s.nap !== false || s.score_state !== 'SCORED') continue;
      const offset = string(s.timezone_offset);
      if (!/^[+-]\d{2}:\d{2}$/.test(offset)) throw new Error('Invalid WHOOP offset');
      const offsetMs =
        (Number(offset.slice(1, 3)) * 60 + Number(offset.slice(4))) *
        60000 *
        (offset[0] === '-' ? -1 : 1);
      const day = dateLabel(new Date(+new Date(string(s.end)) + offsetMs));
      if (!inRange(day, from, to)) continue;
      const score = object(s.score),
        stage = object(score.stage_summary);
      const recovery = bySleep.get(string(s.id));
      const r = recovery?.score_state === 'SCORED' && recovery.score ? object(recovery.score) : {};
      const light = number(stage.total_light_sleep_time_milli),
        deep = number(stage.total_slow_wave_sleep_time_milli),
        rem = number(stage.total_rem_sleep_time_milli);
      nights.push({
        ...emptyMetrics,
        source: this.id,
        sourceId: string(s.id),
        sleepDate: day,
        deviceModel: null,
        rawPayloadId: await this.raw('sleep', string(s.id), s),
        hrvMethod: 'rmssd',
        sleepStart: string(s.start),
        sleepEnd: string(s.end),
        totalSleepMinutes:
          light === null || deep === null || rem === null ? null : (light + deep + rem) / 60000,
        deepSleepMinutes: deep === null ? null : deep / 60000,
        remSleepMinutes: rem === null ? null : rem / 60000,
        sleepEfficiencyPercent: number(score.sleep_efficiency_percentage),
        overnightHrvMs: r.user_calibrating === true ? null : number(r.hrv_rmssd_milli),
        restingHeartRateBpm: number(r.resting_heart_rate),
        breathingRatePerMinute: number(score.respiratory_rate),
        // WHOOP reports absolute skin_temp_celsius, not a baseline deviation.
      });
    }
    return primaryNights(nights);
  }
  async fetchWorkouts(userId: string, from: Date, to: Date): Promise<Workout[]> {
    const rows = await this.rows(userId, 'activity/workout', from, to);
    return Promise.all(
      rows
        .filter((r) => +new Date(string(r.start)) >= +from && +new Date(string(r.start)) < +to)
        .map(async (r) => ({
          source: this.id,
          sourceId: string(r.id),
          start: string(r.start),
          end: string(r.end),
          activity:
            typeof r.sport_name === 'string' ? r.sport_name : `whoop-sport-${String(r.sport_id)}`,
          deviceModel: null,
          rawPayloadId: await this.raw('workout', string(r.id), r),
        })),
    );
  }
  // WHOOP does not expose Journal/tag answers in the documented public API.
}
