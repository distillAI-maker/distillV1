import { sql, type Database, type SQL } from '@distill/data';
import {
  decisionSchema,
  personModelSchema,
  ritualVersionSchema,
  type Decision,
  type DecisionDraft,
  type EngineStamp,
  type PersonModel,
  type RitualVersion,
} from '@distill/engine/ritual';

/**
 * Where the engine keeps what it produces (supabase/migrations/20261021000001_engine.sql). Raw SQL
 * like the journey, every row parsed on the way out. Writes for one person happen inside
 * `withLock`, so two quick messages can't race for the same Ritual version number.
 */

type Executor = { execute(query: SQL): Promise<unknown> };
async function rows<T>(db: Executor, query: SQL): Promise<T[]> {
  const result = await db.execute(query);
  return (Array.isArray(result) ? result : (result as { rows: T[] }).rows) as T[];
}
const json = (value: unknown) => JSON.stringify(value);
/** Timestamps come back as Date objects or as Postgres text ("2026-10-21 00:00:00-08"). */
const iso = (v: unknown) => {
  if (v instanceof Date) return v.toISOString();
  const text = String(v);
  const parsed = new Date(text.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00'));
  return Number.isNaN(+parsed) ? text : parsed.toISOString();
};
const day = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));

export interface EngineEventRow {
  readonly userId?: string | null;
  readonly device?: string | null;
  readonly kind: string;
  readonly payload: Record<string, unknown>;
  readonly engine?: EngineStamp | null;
  readonly model?: string | null;
  readonly tokensIn?: number | null;
  readonly tokensOut?: number | null;
  readonly cacheRead?: number | null;
  readonly costUsd?: number | null;
  readonly latencyMs?: number | null;
}

export interface StoredMessage {
  readonly id: string;
  readonly role: 'person' | 'companion';
  readonly text: string;
  readonly trigger: unknown;
  readonly ritualVersionId: string | null;
  readonly at: string;
}

type VersionRow = {
  id: string;
  user_id: string;
  version: number;
  parent_id: string | null;
  scope: 'base' | 'day';
  scope_date: unknown;
  parts: unknown;
  ops: unknown;
  changes: unknown;
  trigger: RitualVersion['cause']['trigger'];
  cause_event: string | number | null;
  status: RitualVersion['status'];
  reply: string | null;
  engine: EngineStamp;
  created_at: unknown;
};
function versionFrom(r: VersionRow): RitualVersion {
  return ritualVersionSchema.parse({
    id: r.id,
    personId: r.user_id,
    version: Number(r.version),
    parentId: r.parent_id,
    scope:
      r.scope === 'base'
        ? { kind: 'base', effectiveFrom: day(r.scope_date) }
        : { kind: 'day', date: day(r.scope_date) },
    parts: r.parts,
    ops: r.ops,
    changes: r.changes,
    cause: { eventId: r.cause_event === null ? null : String(r.cause_event), trigger: r.trigger },
    status: r.status,
    ...(r.reply ? { reply: r.reply } : {}),
    engine: r.engine,
    createdAt: iso(r.created_at),
  });
}

type DecisionRow = {
  id: string;
  stack_item_id: string | null;
  item_key: string | null;
  kind: Decision['kind'];
  reason: Decision['reason'];
  line: string;
  evidence_tier: Decision['evidenceTier'] | null;
  money: string | number;
  status: Decision['status'];
  engine: EngineStamp;
  created_at: unknown;
  answered_at: unknown;
};
function decisionFrom(r: DecisionRow): Decision {
  return decisionSchema.parse({
    id: r.id,
    stackItemId: r.stack_item_id,
    itemKey: r.item_key,
    kind: r.kind,
    reason: r.reason,
    line: r.line,
    ...(r.evidence_tier ? { evidenceTier: r.evidence_tier } : {}),
    money: Number(r.money),
    status: r.status,
    engine: r.engine,
    createdAt: iso(r.created_at),
    ...(r.answered_at ? { answeredAt: iso(r.answered_at) } : {}),
  });
}

export class EngineStore {
  constructor(readonly db: Database) {}

  /** Runs `work` in a transaction holding this person's lock. */
  async withLock<T>(userId: string, work: (tx: Executor) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}::text))`);
      return work(tx);
    });
  }

  async person(userId: string, db: Executor = this.db): Promise<PersonModel | null> {
    const [row] = await rows<{ model: unknown }>(
      db,
      sql`select model from public.person_models where user_id = ${userId}::uuid`,
    );
    if (!row) return null;
    const parsed = personModelSchema.safeParse(row.model);
    return parsed.success ? parsed.data : null;
  }

  async savePerson(userId: string, model: PersonModel, builtFrom: 'progress-v1' | 'engine', db: Executor = this.db) {
    const valid = personModelSchema.parse(model);
    await db.execute(sql`insert into public.person_models (user_id, version, model, built_from)
      values (${userId}::uuid, ${valid.version}, ${json(valid)}::jsonb, ${builtFrom})
      on conflict (user_id) do update set version = excluded.version, model = excluded.model,
        built_from = excluded.built_from, updated_at = now()`);
  }

  async versions(userId: string, db: Executor = this.db): Promise<RitualVersion[]> {
    const found = await rows<VersionRow>(
      db,
      sql`select * from public.ritual_versions where user_id = ${userId}::uuid order by version`,
    );
    return found.map(versionFrom);
  }

  async nextVersion(userId: string, db: Executor): Promise<number> {
    const [row] = await rows<{ v: number | string | null }>(
      db,
      sql`select max(version) as v from public.ritual_versions where user_id = ${userId}::uuid`,
    );
    return Number(row?.v ?? 0) + 1;
  }

  async insertVersion(v: RitualVersion, db: Executor): Promise<void> {
    const valid = ritualVersionSchema.parse(v);
    const scopeDate = valid.scope.kind === 'base' ? valid.scope.effectiveFrom : valid.scope.date;
    await db.execute(sql`insert into public.ritual_versions
      (id, user_id, version, parent_id, scope, scope_date, parts, ops, changes, trigger, cause_event, status, reply, engine, created_at)
      values (${valid.id}::uuid, ${valid.personId}::uuid, ${valid.version}, ${valid.parentId}::uuid, ${valid.scope.kind},
        ${scopeDate}::date, ${json(valid.parts)}::jsonb, ${json(valid.ops)}::jsonb, ${json(valid.changes)}::jsonb,
        ${valid.cause.trigger}, ${valid.cause.eventId === null ? null : Number(valid.cause.eventId)},
        ${valid.status}, ${valid.reply ?? null}, ${json(valid.engine)}::jsonb, ${valid.createdAt}::timestamptz)`);
  }

  async setVersionStatus(userId: string, id: string, status: RitualVersion['status'], db: Executor = this.db) {
    await db.execute(sql`update public.ritual_versions set status = ${status}
      where id = ${id}::uuid and user_id = ${userId}::uuid`);
  }

  async decisions(userId: string, db: Executor = this.db): Promise<Decision[]> {
    const found = await rows<DecisionRow>(
      db,
      sql`select * from public.decisions where user_id = ${userId}::uuid order by created_at, id`,
    );
    return found.map(decisionFrom);
  }

  /**
   * Brings proposals in line with a fresh decide run: new ones are added, ones whose reason
   * changed are reworded, and proposals the engine no longer makes are withdrawn.
   */
  async syncDecisions(
    userId: string,
    drafts: readonly (DecisionDraft & { line: string })[],
    engine: EngineStamp,
    db: Executor,
  ): Promise<{ added: Decision[]; withdrawn: string[] }> {
    const open = (await this.decisions(userId, db)).filter((d) => d.status === 'proposed');
    const key = (stackItemId: string | null, kind: string) => `${stackItemId ?? ''}:${kind}`;
    const openByKey = new Map(open.map((d) => [key(d.stackItemId, d.kind), d]));
    const added: Decision[] = [];
    const wanted = new Set<string>();
    for (const d of drafts) {
      const k = key(d.stackItemId, d.kind);
      wanted.add(k);
      const existing = openByKey.get(k);
      if (existing && existing.reason === d.reason) continue;
      if (existing)
        await db.execute(sql`update public.decisions set status = 'withdrawn', answered_at = now()
          where id = ${existing.id}::uuid`);
      const [row] = await rows<DecisionRow>(
        db,
        sql`insert into public.decisions (user_id, stack_item_id, item_key, kind, reason, line, evidence_tier, money, status, engine)
          values (${userId}::uuid, ${d.stackItemId}, ${d.itemKey}, ${d.kind}, ${d.reason}, ${d.line.slice(0, 600)},
            ${d.evidenceTier ?? null}, ${d.money}, 'proposed', ${json(engine)}::jsonb)
          returning *`,
      );
      added.push(decisionFrom(row!));
    }
    const withdrawn: string[] = [];
    for (const d of open)
      if (!wanted.has(key(d.stackItemId, d.kind))) {
        await db.execute(sql`update public.decisions set status = 'withdrawn', answered_at = now()
          where id = ${d.id}::uuid`);
        withdrawn.push(d.id);
      }
    return { added, withdrawn };
  }

  async answerDecision(
    userId: string,
    id: string,
    answer: 'yes' | 'not-now' | 'theirs',
    db: Executor = this.db,
  ): Promise<Decision | null> {
    const [row] = await rows<DecisionRow>(
      db,
      sql`update public.decisions set status = ${answer}, answered_at = now()
        where id = ${id}::uuid and user_id = ${userId}::uuid and status = 'proposed' returning *`,
    );
    return row ? decisionFrom(row) : null;
  }

  async messages(userId: string, limit = 60, db: Executor = this.db): Promise<StoredMessage[]> {
    const found = await rows<{
      id: string;
      role: 'person' | 'companion';
      text: string;
      trigger: unknown;
      ritual_version_id: string | null;
      at: unknown;
    }>(
      db,
      sql`select * from (select * from public.context_messages where user_id = ${userId}::uuid
        order by at desc limit ${limit}) recent order by at`,
    );
    return found.map((m) => ({
      id: m.id,
      role: m.role,
      text: m.text,
      trigger: m.trigger,
      ritualVersionId: m.ritual_version_id,
      at: iso(m.at),
    }));
  }

  async addMessage(
    userId: string,
    m: { role: 'person' | 'companion'; text: string; trigger?: unknown; ritualVersionId?: string | null; at?: string },
    db: Executor = this.db,
  ): Promise<string> {
    const [row] = await rows<{ id: string }>(
      db,
      sql`insert into public.context_messages (user_id, role, text, trigger, ritual_version_id, at)
        values (${userId}::uuid, ${m.role}, ${m.text.slice(0, 2000)}, ${m.trigger === undefined ? null : json(m.trigger)}::jsonb,
          ${m.ritualVersionId ?? null}::uuid, ${m.at ?? new Date().toISOString()}::timestamptz) returning id`,
    );
    return row!.id;
  }

  async log(e: EngineEventRow, db: Executor = this.db): Promise<string> {
    const [row] = await rows<{ id: string | number }>(
      db,
      sql`insert into public.engine_events (user_id, device, kind, payload, engine, model, tokens_in, tokens_out, cache_read, cost_usd, latency_ms)
        values (${e.userId ?? null}::uuid, ${e.device ?? null}, ${e.kind}, ${json(e.payload)}::jsonb,
          ${e.engine ? json(e.engine) : null}::jsonb, ${e.model ?? null}, ${e.tokensIn ?? null}, ${e.tokensOut ?? null},
          ${e.cacheRead ?? null}, ${e.costUsd ?? null}, ${e.latencyMs ?? null}) returning id`,
    );
    return String(row!.id);
  }

  async events(
    userId: string,
    kinds: readonly string[],
    sinceIso: string,
    db: Executor = this.db,
  ): Promise<{ kind: string; payload: Record<string, unknown>; at: string }[]> {
    const found = await rows<{ kind: string; payload: Record<string, unknown>; at: unknown }>(
      db,
      sql`select kind, payload, at from public.engine_events where user_id = ${userId}::uuid
        and kind in (${sql.join(kinds.length ? kinds.map((k) => sql`${k}`) : [sql`''`], sql`, `)})
        and at >= ${sinceIso}::timestamptz order by at`,
    );
    return found.map((r) => ({ kind: r.kind, payload: r.payload, at: iso(r.at) }));
  }

  /** AI calls today, for the caps: by person when signed in, by device otherwise. */
  async callsSince(who: { userId?: string; device?: string }, sinceIso: string, kind = 'llm.call', db: Executor = this.db) {
    const [row] = await rows<{ n: string | number }>(
      db,
      who.userId
        ? sql`select count(*) as n from public.engine_events where user_id = ${who.userId}::uuid and kind = ${kind} and at >= ${sinceIso}::timestamptz`
        : sql`select count(*) as n from public.engine_events where user_id is null and device = ${who.device ?? ''} and kind = ${kind} and at >= ${sinceIso}::timestamptz`,
    );
    return Number(row?.n ?? 0);
  }
}
