import {
  bigint,
  boolean,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { CheckIn, PreRegistration } from '@distill/engine/experiment';
import type { NightRecord, OAuthProviderId, ProviderId, Tag, Workout } from '@distill/providers';

export const accounts = pgTable('wearable_accounts', {
  userId: uuid('user_id').primaryKey(), // SQL migration references auth.users with cascade.
  deleting: boolean('deleting').notNull().default(false),
});
export const connections = pgTable(
  'wearable_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => accounts.userId, { onDelete: 'cascade' }),
    provider: text('provider').$type<OAuthProviderId>().notNull(),
    tokenEnvelope: text('token_envelope').notNull(),
    backfillBefore: date('backfill_before'),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    nextSyncAt: timestamp('next_sync_at', { withTimezone: true }).notNull().defaultNow(),
    lease: uuid('lease'),
    leaseUntil: timestamp('lease_until', { withTimezone: true }),
    errorCode: text('error_code'),
    disabled: boolean('disabled').notNull().default(false),
  },
  (t) => [
    uniqueIndex('wearable_connection_owner').on(t.userId, t.provider),
    index('wearable_sync_due').on(t.nextSyncAt),
  ],
);
export const oauthStates = pgTable('wearable_oauth_states', {
  hash: text('hash').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => accounts.userId, { onDelete: 'cascade' }),
  provider: text('provider').$type<OAuthProviderId>().notNull(),
  verifierEnvelope: text('verifier_envelope').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});
export const rawPayloads = pgTable(
  'wearable_raw_payloads',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => accounts.userId, { onDelete: 'cascade' }),
    source: text('source').$type<ProviderId>().notNull(),
    kind: text('kind').notNull(),
    sourceId: text('source_id').notNull(),
    payload: jsonb('payload').notNull(),
  },
  (t) => [uniqueIndex('wearable_raw_owner').on(t.userId, t.source, t.kind, t.sourceId)],
);
export const nights = pgTable(
  'wearable_nights',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => accounts.userId, { onDelete: 'cascade' }),
    source: text('source').$type<ProviderId>().notNull(),
    sleepDate: date('sleep_date').notNull(),
    record: jsonb('record').$type<NightRecord>().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.source, t.sleepDate] })],
);
export const events = pgTable(
  'wearable_events',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => accounts.userId, { onDelete: 'cascade' }),
    source: text('source').$type<ProviderId>().notNull(),
    kind: text('kind').notNull(),
    sourceId: text('source_id').notNull(),
    record: jsonb('record').$type<Workout | Tag>().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.source, t.kind, t.sourceId] })],
);
export const imports = pgTable(
  'wearable_imports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => accounts.userId, { onDelete: 'cascade' }),
    source: text('source').$type<'apple_export' | 'csv'>().notNull(),
    sourceName: text('source_name'),
    path: text('path').notNull(),
    status: text('status')
      .$type<'uploading' | 'queued' | 'running' | 'done' | 'failed'>()
      .notNull()
      .default('uploading'),
    lease: uuid('lease'),
    leaseUntil: timestamp('lease_until', { withTimezone: true }),
    errorCode: text('error_code'),
  },
  (t) => [uniqueIndex('wearable_import_path').on(t.path)],
);

export const experimentCycles = pgTable(
  'experiment_cycles',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => accounts.userId, { onDelete: 'cascade' }),
    vetoedItemId: text('vetoed_item_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (t) => [uniqueIndex('experiment_cycle_owner').on(t.id, t.userId)],
);
export const experiments = pgTable(
  'experiments',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => accounts.userId, { onDelete: 'cascade' }),
    cycleId: uuid('cycle_id').notNull(),
    preRegistration: jsonb('pre_registration').$type<PreRegistration>().notNull(),
    status: text('status').$type<'active' | 'completed' | 'switched' | 'cancelled'>().notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
  },
  (t) => [
    foreignKey({
      columns: [t.cycleId, t.userId],
      foreignColumns: [experimentCycles.id, experimentCycles.userId],
    }).onDelete('cascade'),
    uniqueIndex('one_active_experiment_per_user')
      .on(t.userId)
      .where(sql`${t.status} = 'active'`),
  ],
);
export const experimentCheckIns = pgTable(
  'experiment_check_ins',
  {
    experimentId: uuid('experiment_id')
      .notNull()
      .references(() => experiments.id, { onDelete: 'cascade' }),
    sleepDate: date('sleep_date').notNull(),
    entry: jsonb('entry').$type<CheckIn>().notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.experimentId, t.sleepDate] })],
);

// The engine (supabase/migrations/20261021000001_engine.sql). Server-only; read and written by
// apps/web/src/server/engine-store.ts with raw SQL. Defined here so the schema stays complete.
export const personModels = pgTable('person_models', {
  userId: uuid('user_id').primaryKey(),
  version: integer('version').notNull().default(1),
  model: jsonb('model').notNull(),
  builtFrom: text('built_from').$type<'progress-v1' | 'engine'>().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
export const ritualVersions = pgTable(
  'ritual_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    version: integer('version').notNull(),
    parentId: uuid('parent_id'),
    scope: text('scope').$type<'base' | 'day'>().notNull(),
    scopeDate: date('scope_date').notNull(),
    parts: jsonb('parts').notNull(),
    ops: jsonb('ops').notNull(),
    changes: jsonb('changes').notNull(),
    trigger: text('trigger').notNull(),
    causeEvent: bigint('cause_event', { mode: 'number' }),
    status: text('status').$type<'proposed' | 'accepted' | 'undone' | 'superseded'>().notNull(),
    reply: text('reply'),
    engine: jsonb('engine').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('ritual_versions_user_id_version_key').on(t.userId, t.version)],
);
export const contextMessages = pgTable('context_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  role: text('role').$type<'person' | 'companion'>().notNull(),
  text: text('text').notNull(),
  trigger: jsonb('trigger'),
  ritualVersionId: uuid('ritual_version_id'),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
});
export const decisions = pgTable('decisions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  stackItemId: text('stack_item_id'),
  itemKey: text('item_key'),
  kind: text('kind').notNull(),
  reason: text('reason').notNull(),
  line: text('line').notNull(),
  evidenceTier: text('evidence_tier'),
  money: numeric('money').notNull(),
  status: text('status').notNull(),
  engine: jsonb('engine').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  answeredAt: timestamp('answered_at', { withTimezone: true }),
});
export const engineEvents = pgTable('engine_events', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  userId: uuid('user_id'),
  device: text('device'),
  kind: text('kind').notNull(),
  payload: jsonb('payload').notNull(),
  engine: jsonb('engine'),
  model: text('model'),
  tokensIn: integer('tokens_in'),
  tokensOut: integer('tokens_out'),
  cacheRead: integer('cache_read'),
  costUsd: numeric('cost_usd'),
  latencyMs: integer('latency_ms'),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
});
