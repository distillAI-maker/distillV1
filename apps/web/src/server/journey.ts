import { randomInt, randomUUID } from 'node:crypto';
import { sql } from '@distill/data';
import type { SQL } from '@distill/data';
import { Repository } from '@distill/data';
import type { Database } from '@distill/data';
import {
  planBaseline,
  startExperiment,
  recordCheckIn,
  measurement,
  metricFields,
} from '@distill/engine/experiment';
import type {
  CheckIn,
  HistoricalNight,
  PreRegistration,
  Exclusion,
} from '@distill/engine/experiment';
import { analyzeExperiment, experimentResultCard } from '@distill/engine/stats';
import { renderExperimentVerdict, roundMeasurement } from '@distill/engine/verdict';
import { emptyMetrics, localDate } from '@distill/providers';
import type { ProviderId } from '@distill/providers';
import { progressSchema } from '../../lib/progress/types';
import type { Progress } from '../../lib/progress/types';
import type { Experiment, Night, Verdict } from '../../lib/data/types';
import { audit } from './audit';
import { HttpError } from './service';

type Executor = { execute(query: SQL): Promise<unknown> };
async function rows<T>(db: Executor, query: SQL): Promise<T[]> {
  const result = await db.execute(query);
  return (Array.isArray(result) ? result : (result as { rows: T[] }).rows) as T[];
}
export const shiftDate = (date: string, days: number) =>
  new Date(+new Date(`${date}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
type Context = {
  synthetic: boolean;
  name: string;
  cost: number;
  origin?: Progress['items'][number]['origin'];
  months?: number;
  source: ProviderId;
};
type Stored = {
  id: string;
  pre_registration: PreRegistration;
  status: string;
  app_context: Context;
  verdict?: Verdict;
};

/** Stable synthetic measurements; never stored in wearable tables or mixed with real measurements. */
export function syntheticHistory(
  through: string,
  registration?: PreRegistration,
): HistoricalNight[] {
  return Array.from({ length: 240 }, (_, i) => {
    const date = shiftDate(through, i - 239);
    const offset = Math.round(+new Date(date) / 86400000);
    const noise = ((offset * 17) % 23) - 11;
    const on = registration?.schedule.days.find((d) => d.sleepDate === date)?.condition === 'on';
    return {
      night: {
        ...emptyMetrics,
        totalSleepMinutes: 420 + noise * 2 - (on ? 20 : 0),
        sleepLatencyMinutes: 25 + noise / 2 + (on ? 5 : 0),
        deepSleepMinutes: 75 + noise,
        remSleepMinutes: 90 + noise,
        wakeAfterSleepOnsetMinutes: 30 + noise / 2,
        sleepEfficiencyPercent: 90 + noise / 4,
        overnightHrvMs: 60 + noise,
        restingHeartRateBpm: 60 + noise / 3,
        breathingRatePerMinute: 15 + noise / 10,
        skinTemperatureDeviationC: noise / 20,
        source: 'synthetic' as const,
        sourceId: `demo-${date}`,
        rawPayloadId: `demo-${date}`,
        deviceModel: 'Synthetic demo',
        hrvMethod: 'rmssd' as const,
        sleepDate: date,
        sleepStart: null,
        sleepEnd: null,
      },
    };
  });
}

export class Journey {
  constructor(readonly db: Database) {}
  private async active(db: Executor, userId: string) {
    const [account] = await rows<{ deleting: boolean }>(
      db,
      sql`select deleting from public.wearable_accounts where user_id = ${userId}::uuid for update`,
    );
    if (!account || account.deleting) throw new HttpError(409, 'account_unavailable');
  }
  async load(userId: string, db: Executor = this.db) {
    const [row] = await rows<{ progress: Progress }>(
      db,
      sql`select progress from public.app_journeys where user_id = ${userId}::uuid`,
    );
    return row ? progressSchema.parse(row.progress) : null;
  }
  async save(userId: string, input: Progress) {
    const progress = progressSchema.parse(input);
    await new Repository(this.db).ensureAccount(userId);
    await this.db.transaction(async (tx) => {
      await this.active(tx, userId);
      const [running] = await rows<{ id: string }>(
        tx,
        sql`select id from public.experiments where user_id = ${userId}::uuid and status = 'active'`,
      );
      const current = await this.load(userId, tx);
      if (running && current?.dataSource !== progress.dataSource)
        throw new HttpError(409, 'finish_or_cancel_before_changing_source');
      await tx.execute(sql`insert into public.app_journeys(user_id, progress) values (${userId}::uuid, ${JSON.stringify(progress)}::jsonb)
        on conflict(user_id) do update set progress = excluded.progress, updated_at = now()`);
    });
  }
  async clear(userId: string) {
    // Reset progress, not a live provider disconnect or account deletion.
    const active = await this.records(userId);
    if (active.some((r) => r.status === 'active'))
      throw new HttpError(409, 'finish_or_cancel_before_reset');
    await this.db.execute(sql`delete from public.app_journeys where user_id = ${userId}::uuid`);
  }
  async records(userId: string, db: Executor = this.db) {
    return rows<Stored>(
      db,
      sql`select e.id, e.pre_registration, e.status, e.app_context, r.verdict
      from public.experiments e left join public.experiment_results r on r.experiment_id = e.id
      where e.user_id = ${userId}::uuid and e.app_context is not null order by e.started_at desc`,
    );
  }
  private async history(
    userId: string,
    source: ProviderId,
    through: string,
    registration?: PreRegistration,
    db: Executor = this.db,
  ) {
    if (source === 'synthetic') return syntheticHistory(through, registration);
    return (
      await rows<{ record: HistoricalNight['night'] }>(
        db,
        sql`select record from public.wearable_nights where user_id = ${userId}::uuid and source = ${source}
      and sleep_date >= ${shiftDate(through, -365)}::date and sleep_date <= ${through}::date order by sleep_date`,
      )
    )
      .filter((r) => r.record.source === source)
      .map((r) => ({ night: r.record }));
  }
  async start(
    userId: string,
    input: {
      itemKey: string;
      timeZone: string;
      days: 14 | 28 | 42;
      onDefinition: string;
      offDefinition: string;
    },
    now = new Date(),
  ) {
    const today = localDate(now.toISOString(), input.timeZone);
    const progress = await this.load(userId);
    if (!progress) throw new HttpError(409, 'save_stack_before_starting');
    const candidate = audit(progress).runnable.find((i) => i.key === input.itemKey);
    if (!candidate) throw new HttpError(409, 'item_not_ready_for_testing');
    const stack = progress.items.find((i) => i.id === candidate.id)!;
    const source: ProviderId | undefined =
      progress.dataSource === 'demo' ? 'synthetic' : progress.dataSource;
    if (!source) throw new HttpError(409, 'choose_a_data_source');
    const history = await this.history(userId, source, today);
    const metric = metricFields[candidate.metric ?? ''];
    if (!metric) throw new HttpError(409, 'metric_not_available');
    const [state] = await rows<{ baseline_requested_date: string | null }>(
      this.db,
      sql`select baseline_requested_date::text from public.app_journeys where user_id = ${userId}::uuid`,
    );
    const recent = history.findLast((h) => h.night[metric] !== null);
    const channel = {
      source,
      deviceModel: recent?.night.deviceModel,
      ...(metric === 'overnightHrvMs' ? { hrvMethod: recent?.night.hrvMethod ?? undefined } : {}),
    };
    const baseline = planBaseline(
      history,
      metric,
      channel,
      state?.baseline_requested_date ?? today,
      today,
    );
    if (baseline.status !== 'ready') {
      await this.db.execute(
        sql`update public.app_journeys set baseline_requested_date = coalesce(baseline_requested_date, ${today}::date) where user_id = ${userId}::uuid`,
      );
      throw new HttpError(409, `baseline_${baseline.status}`);
    }
    const record = startExperiment({
      candidate,
      baseline,
      experimentId: randomUUID(),
      cycleId: randomUUID(),
      lockedAt: now.toISOString(),
      timeZone: input.timeZone,
      seed: randomInt(0, 0x7fffffff),
      direction: [
        'sleepLatencyMinutes',
        'wakeAfterSleepOnsetMinutes',
        'restingHeartRateBpm',
      ].includes(metric)
        ? 'lower'
        : 'higher',
      onDefinition: input.onDefinition,
      offDefinition: input.offDefinition,
      config: { totalDays: input.days, minimumNightsPerSide: 5 },
    });
    const context: Context = {
      synthetic: source === 'synthetic',
      source,
      name: candidate.name,
      cost: stack.monthlyCost,
      origin: stack.origin,
      ...(progress.dayOne.months != null ? { months: progress.dayOne.months } : {}),
    };
    await this.db.transaction(async (tx) => {
      await this.active(tx, userId);
      const running = await rows(
        tx,
        sql`select id from public.experiments where user_id = ${userId}::uuid and status = 'active'`,
      );
      if (running.length) throw new HttpError(409, 'experiment_already_active');
      await tx.execute(
        sql`insert into public.experiment_cycles(id,user_id,created_at) values (${record.cycleId}::uuid,${userId}::uuid,${now})`,
      );
      await tx.execute(sql`insert into public.experiments(id,user_id,cycle_id,pre_registration,status,started_at,app_context)
        values (${record.experimentId}::uuid,${userId}::uuid,${record.cycleId}::uuid,${JSON.stringify(record)}::jsonb,'active',${now},${JSON.stringify(context)}::jsonb)`);
      if (context.synthetic)
        await tx.execute(
          sql`update public.app_journeys set demo_through = ${record.schedule.days[0]!.sleepDate}::date where user_id = ${userId}::uuid`,
        );
    });
    return { id: record.experimentId };
  }
  async checkIn(
    userId: string,
    id: string,
    input: {
      sleepDate: string;
      tap?: 'did' | 'didnt';
      exposure?: 'on' | 'off';
      exclusions?: Exclusion[];
    },
    now = new Date(),
  ) {
    return this.db.transaction(async (tx) => {
      await this.active(tx, userId);
      const [row] = await rows<Stored>(
        tx,
        sql`select id, pre_registration, status, app_context from public.experiments where id = ${id}::uuid and user_id = ${userId}::uuid for update`,
      );
      if (!row || row.status !== 'active') throw new HttpError(404, 'active_experiment_not_found');
      const through = await this.through(userId, row, now, tx);
      if (input.sleepDate > through) throw new HttpError(400, 'future_check_in');
      const entry = recordCheckIn(row.pre_registration, input);
      await tx.execute(sql`insert into public.experiment_check_ins(experiment_id,sleep_date,entry,recorded_at)
        values (${id}::uuid,${entry.sleepDate}::date,${JSON.stringify(entry)}::jsonb,${now})
        on conflict(experiment_id,sleep_date) do update set entry = excluded.entry, recorded_at = excluded.recorded_at`);
      return entry;
    });
  }
  private async through(userId: string, row: Stored, now: Date, db: Executor = this.db) {
    if (!row.app_context.synthetic)
      return localDate(now.toISOString(), row.pre_registration.timeZone);
    const [state] = await rows<{ through: string }>(
      db,
      sql`select demo_through::text as through from public.app_journeys where user_id = ${userId}::uuid`,
    );
    return state?.through ?? row.pre_registration.schedule.days[0]!.sleepDate;
  }
  private async checks(userId: string, id: string, db: Executor = this.db) {
    return (
      await rows<{ entry: CheckIn }>(
        db,
        sql`select c.entry from public.experiment_check_ins c join public.experiments e on e.id = c.experiment_id
      where e.user_id = ${userId}::uuid and e.id = ${id}::uuid order by c.sleep_date`,
      )
    ).map((r) => r.entry);
  }
  async snapshot(userId: string, now = new Date(), db: Executor = this.db) {
    const experiments: Experiment[] = [],
      verdicts: Verdict[] = [];
    for (const row of await this.records(userId, db)) {
      const r = row.pre_registration,
        c = row.app_context;
      const through = await this.through(userId, row, now, db);
      const checks = await this.checks(userId, row.id, db);
      const history = await this.history(userId, c.source, through, r, db);
      const nights: Night[] = r.schedule.days.map((d) => {
        const check = checks.find((e) => e.sleepDate === d.sleepDate);
        const night = history.find((h) => h.night.sleepDate === d.sleepDate);
        return {
          date: d.sleepDate,
          condition: d.condition === 'off' ? 'off' : 'on',
          value: night ? measurement(night, r.metric, r.channel) : null,
          tap: check?.tap ?? 'unknown',
          counted: Boolean(check?.usable && !d.excludedForCarryover),
        };
      });
      const analysis = analyzeExperiment({
        registration: r,
        nights: history,
        checkIns: checks,
        through,
        bootstrap: { enabled: false },
      });
      const card = experimentResultCard(analysis);
      const activity = r.schedule.days.find((d) => d.date === through);
      if (row.status === 'active' || row.status === 'completed')
        experiments.push({
          id: row.id,
          itemKey: r.itemKey,
          name: c.name,
          status:
            row.status === 'completed' ? 'done' : row.status === 'active' ? 'running' : 'done',
          startDate: r.schedule.startDate,
          days: r.schedule.totalDays,
          schedule: nights.map((n) => n.condition),
          observeOnly: r.onDays === 'observe',
          metric: r.metricName,
          unit: card.unit,
          direction: r.direction === 'higher' ? 'better' : 'worse',
          prereg: {
            metric: r.metricName,
            direction: r.direction === 'higher' ? 'better' : 'worse',
            alpha: r.alpha,
            swing: card.swing?.value ?? r.personalSwing.value,
            schedule: nights.map((n) => n.condition),
            lockedAt: r.lockedAt,
          },
          instruction: { on: r.onDefinition, off: r.offDefinition },
          monthlyCost: c.cost,
          monthsIn: c.months,
          nights,
          through,
          synthetic: c.synthetic,
          canFinish: row.status === 'active' && through >= r.schedule.days.at(-1)!.sleepDate,
          instructionForToday: activity
            ? activity.condition === 'observe'
              ? 'Keep your usual routine; record what happens.'
              : activity.condition === 'on'
                ? r.onDefinition
                : r.offDefinition
            : undefined,
        });
      if (row.verdict) verdicts.push(row.verdict);
    }
    return { experiments, verdicts };
  }
  async finish(userId: string, id: string, now = new Date()) {
    return this.db.transaction(async (tx) => {
      await this.active(tx, userId);
      const [row] = await rows<Stored>(
        tx,
        sql`select e.*, r.verdict from public.experiments e left join public.experiment_results r on r.experiment_id = e.id where e.id = ${id}::uuid and e.user_id = ${userId}::uuid for update of e`,
      );
      if (!row) throw new HttpError(404, 'experiment_not_found');
      if (row.verdict) return row.verdict;
      if (row.status !== 'active') throw new HttpError(409, 'experiment_not_active');
      const r = row.pre_registration,
        c = row.app_context;
      const through = await this.through(userId, row, now, tx);
      if (through < r.schedule.days.at(-1)!.sleepDate)
        throw new HttpError(409, 'experiment_not_finished');
      const checks = await this.checks(userId, id, tx);
      const history = await this.history(userId, c.source, through, r, tx);
      const analysis = analyzeExperiment({
        registration: r,
        nights: history,
        checkIns: checks,
        through,
        bootstrap: { enabled: false },
      });
      const card = experimentResultCard(analysis);
      const narrative = renderExperimentVerdict(analysis, {
        itemName: c.name,
        monthlyCost: c.cost,
        monthsUsed: c.months,
        source: c.origin,
        dropsCharge: false,
      });
      const snap = await this.snapshot(userId, now, tx);
      const verdict: Verdict = {
        id,
        experimentId: id,
        itemKey: r.itemKey,
        name: c.name,
        word: card.word,
        templateName:
          narrative.status === 'ready' ? (narrative.templateId ?? 'contextual') : 'needs_review',
        text: narrative.text ?? 'This result needs review before a recommendation can be shown.',
        metric: r.metricName,
        unit: card.unit,
        change: card.number ? roundMeasurement(card.number.change, card.unit) : null,
        swing: card.swing ? roundMeasurement(card.swing.value, card.swing.unit) : null,
        nights: snap.experiments.find((e) => e.id === id)!.nights!,
        effort: {
          days: r.schedule.totalDays,
          taps: checks.filter((e) => e.tap !== 'unknown').length,
        },
        monthlyCost: c.cost,
        decidedAt: through,
        synthetic: c.synthetic,
        reasons: [...card.reasons],
        swingUnit: card.swing?.unit,
      };
      await tx.execute(
        sql`insert into public.experiment_results(experiment_id,verdict) values (${id}::uuid,${JSON.stringify(verdict)}::jsonb)`,
      );
      await tx.execute(
        sql`update public.experiments set status = 'completed', ended_at = ${now} where id = ${id}::uuid`,
      );
      return verdict;
    });
  }
  async advanceDemo(userId: string, id: string, all: boolean, now = new Date()) {
    const row = (await this.records(userId)).find((e) => e.id === id && e.status === 'active');
    if (!row?.app_context.synthetic) throw new HttpError(409, 'demo_only');
    const last = row.pre_registration.schedule.days.at(-1)!.sleepDate;
    const through = all
      ? last
      : [shiftDate(await this.through(userId, row, now), 1), last].sort()[0]!;
    await this.db.transaction(async (tx) => {
      await this.active(tx, userId);
      const [current] = await rows<{ status: string }>(
        tx,
        sql`select status from public.experiments where id = ${id}::uuid and user_id = ${userId}::uuid for update`,
      );
      if (current?.status !== 'active') throw new HttpError(409, 'experiment_not_active');
      await tx.execute(
        sql`update public.app_journeys set demo_through = ${through}::date where user_id = ${userId}::uuid`,
      );
      if (all)
        for (const day of row.pre_registration.schedule.days) {
          const entry = recordCheckIn(row.pre_registration, {
            sleepDate: day.sleepDate,
            tap: 'did',
            ...(day.condition === 'observe'
              ? { exposure: day.block % 2 ? ('on' as const) : ('off' as const) }
              : {}),
          });
          await tx.execute(sql`insert into public.experiment_check_ins(experiment_id,sleep_date,entry,recorded_at)
          values (${id}::uuid,${day.sleepDate}::date,${JSON.stringify(entry)}::jsonb,${now}) on conflict do nothing`);
        }
    });
    return { through };
  }
  async cancel(userId: string, id: string, now = new Date()) {
    await this.db.transaction(async (tx) => {
      await this.active(tx, userId);
      const updated = await rows(
        tx,
        sql`update public.experiments set status = 'cancelled', ended_at = ${now} where id = ${id}::uuid and user_id = ${userId}::uuid and status = 'active' returning id`,
      );
      if (!updated.length) throw new HttpError(404, 'active_experiment_not_found');
    });
    return { status: 'cancelled' };
  }
}
