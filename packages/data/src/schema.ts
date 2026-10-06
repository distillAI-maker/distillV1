import {
  boolean,
  date,
  foreignKey,
  index,
  jsonb,
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
