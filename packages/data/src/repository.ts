import { createHash, randomUUID } from 'node:crypto';
import { and, eq, gt, lte, or, isNull, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { ImportedData, OAuthProviderId, ProviderId } from '@distill/providers';
import { dateLabel, nightRecordSchema } from '@distill/providers';
import * as s from './schema.js';

export type Database = PostgresJsDatabase<typeof s>;
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
export type Connection = typeof s.connections.$inferSelect;
export type ImportJob = typeof s.imports.$inferSelect;
export interface RawRow {
  id: string;
  userId: string;
  source: ProviderId;
  kind: string;
  sourceId: string;
  payload: unknown;
}
export function rawCollector(userId: string, source: ProviderId) {
  const rows = new Map<string, RawRow>();
  return {
    rows,
    write: async (kind: string, sourceId: string, payload: unknown) => {
      const hex = createHash('sha256')
        .update(JSON.stringify([userId, source, kind, sourceId]))
        .digest('hex')
        .slice(0, 32);
      const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
      rows.set(id, { id, userId, source, kind, sourceId, payload });
      return id;
    },
  };
}
export class Repository {
  constructor(readonly db: Database) {}
  async ensureAccount(userId: string) {
    await this.db.insert(s.accounts).values({ userId }).onConflictDoNothing();
    const [account] = await this.db.select().from(s.accounts).where(eq(s.accounts.userId, userId));
    if (!account || account.deleting) throw new Error('Account unavailable');
  }
  private async active(tx: Transaction, userId: string) {
    const [a] = await tx
      .select()
      .from(s.accounts)
      .where(eq(s.accounts.userId, userId))
      .for('update');
    if (!a || a.deleting) throw new Error('Account unavailable');
  }
  async saveOAuthState(value: typeof s.oauthStates.$inferInsert) {
    await this.db.transaction(async (tx) => {
      await this.active(tx, value.userId);
      await tx.insert(s.oauthStates).values(value);
    });
  }
  async consumeOAuthState(hash: string, provider: OAuthProviderId, now: Date) {
    const [state] = await this.db
      .delete(s.oauthStates)
      .where(
        and(
          eq(s.oauthStates.hash, hash),
          eq(s.oauthStates.provider, provider),
          gt(s.oauthStates.expiresAt, now),
        ),
      )
      .returning();
    return state;
  }
  async connect(userId: string, provider: OAuthProviderId, tokenEnvelope: string, now: Date) {
    await this.db.transaction(async (tx) => {
      await this.active(tx, userId);
      const tomorrow = dateLabel(new Date(+new Date(dateLabel(now)) + 86400000));
      await tx
        .insert(s.connections)
        .values({ userId, provider, tokenEnvelope, backfillBefore: tomorrow, nextSyncAt: now })
        .onConflictDoUpdate({
          target: [s.connections.userId, s.connections.provider],
          set: {
            tokenEnvelope,
            backfillBefore: tomorrow,
            nextSyncAt: now,
            disabled: false,
            errorCode: null,
            lease: null,
            leaseUntil: null,
          },
        });
    });
  }
  async claimConnection(now: Date, userId?: string): Promise<Connection | undefined> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(s.connections)
        .where(
          and(
            eq(s.connections.disabled, false),
            lte(s.connections.nextSyncAt, now),
            or(isNull(s.connections.leaseUntil), lte(s.connections.leaseUntil, now)),
            userId ? eq(s.connections.userId, userId) : undefined,
          ),
        )
        .orderBy(s.connections.nextSyncAt)
        .limit(1)
        .for('update', { skipLocked: true });
      if (!row) return undefined;
      const [claimed] = await tx
        .update(s.connections)
        .set({ lease: randomUUID(), leaseUntil: new Date(+now + 10 * 60000) })
        .where(eq(s.connections.id, row.id))
        .returning();
      return claimed;
    });
  }
  async saveTokens(row: Connection, tokenEnvelope: string) {
    const result = await this.db
      .update(s.connections)
      .set({ tokenEnvelope })
      .where(and(eq(s.connections.id, row.id), eq(s.connections.lease, row.lease!)))
      .returning({ id: s.connections.id });
    if (!result.length) throw new Error('Sync lease lost');
  }
  private async saveData(
    tx: Transaction,
    userId: string,
    source: ProviderId,
    data: ImportedData,
    raw: Iterable<RawRow>,
  ) {
    for (const r of raw) {
      if (r.userId !== userId || r.source !== source) throw new Error('Raw owner mismatch');
      await tx
        .insert(s.rawPayloads)
        .values(r)
        .onConflictDoUpdate({ target: s.rawPayloads.id, set: { payload: r.payload } });
    }
    for (const n of data.nights) {
      nightRecordSchema.parse(n);
      if (n.source !== source) throw new Error('Night source mismatch');
      await tx
        .insert(s.nights)
        .values({ userId, source, sleepDate: n.sleepDate, record: n })
        .onConflictDoUpdate({
          target: [s.nights.userId, s.nights.source, s.nights.sleepDate],
          set: { record: n },
        });
    }
    for (const [kind, records] of [
      ['workout', data.workouts],
      ['tag', data.tags],
    ] as const)
      for (const record of records) {
        if (record.source !== source) throw new Error('Event source mismatch');
        await tx
          .insert(s.events)
          .values({ userId, source, kind, sourceId: record.sourceId, record })
          .onConflictDoUpdate({
            target: [s.events.userId, s.events.source, s.events.kind, s.events.sourceId],
            set: { record },
          });
      }
  }
  async finishConnection(
    row: Connection,
    data: ImportedData,
    raw: Iterable<RawRow>,
    patch: Partial<Connection>,
  ) {
    await this.db.transaction(async (tx) => {
      await this.active(tx, row.userId);
      const [current] = await tx
        .select()
        .from(s.connections)
        .where(and(eq(s.connections.id, row.id), eq(s.connections.lease, row.lease!)))
        .for('update');
      if (!current) throw new Error('Sync lease lost');
      await this.saveData(tx, row.userId, row.provider, data, raw);
      await tx
        .update(s.connections)
        .set({ ...patch, lease: null, leaseUntil: null, errorCode: null })
        .where(eq(s.connections.id, row.id));
    });
  }
  async failConnection(row: Connection, errorCode: string, retryAt: Date, disabled: boolean) {
    await this.db
      .update(s.connections)
      .set({ errorCode, nextSyncAt: retryAt, disabled, lease: null, leaseUntil: null })
      .where(and(eq(s.connections.id, row.id), eq(s.connections.lease, row.lease!)));
  }
  async createImport(row: typeof s.imports.$inferInsert) {
    return this.db.transaction(async (tx) => {
      await this.active(tx, row.userId);
      return (await tx.insert(s.imports).values(row).returning())[0]!;
    });
  }
  async queueImport(userId: string, id: string) {
    const [row] = await this.db
      .update(s.imports)
      .set({ status: 'queued', errorCode: null })
      .where(
        and(
          eq(s.imports.id, id),
          eq(s.imports.userId, userId),
          or(eq(s.imports.status, 'uploading'), eq(s.imports.status, 'failed')),
        ),
      )
      .returning();
    return row;
  }
  async claimImport(now: Date, userId?: string): Promise<ImportJob | undefined> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(s.imports)
        .where(
          and(
            or(
              eq(s.imports.status, 'queued'),
              and(eq(s.imports.status, 'running'), lte(s.imports.leaseUntil, now)),
            ),
            userId ? eq(s.imports.userId, userId) : undefined,
          ),
        )
        .limit(1)
        .for('update', { skipLocked: true });
      if (!row) return undefined;
      return (
        await tx
          .update(s.imports)
          .set({ status: 'running', lease: randomUUID(), leaseUntil: new Date(+now + 10 * 60000) })
          .where(eq(s.imports.id, row.id))
          .returning()
      )[0];
    });
  }
  async finishImport(row: ImportJob, data: ImportedData, raw: Iterable<RawRow>) {
    await this.db.transaction(async (tx) => {
      await this.active(tx, row.userId);
      const [current] = await tx
        .select()
        .from(s.imports)
        .where(and(eq(s.imports.id, row.id), eq(s.imports.lease, row.lease!)))
        .for('update');
      if (!current) throw new Error('Import lease lost');
      await this.saveData(tx, row.userId, row.source, data, raw);
      await tx
        .update(s.imports)
        .set({ status: 'done', lease: null, leaseUntil: null, errorCode: null })
        .where(eq(s.imports.id, row.id));
    });
  }
  async failImport(row: ImportJob) {
    await this.db
      .update(s.imports)
      .set({ status: 'failed', lease: null, leaseUntil: null, errorCode: 'import_failed' })
      .where(and(eq(s.imports.id, row.id), eq(s.imports.lease, row.lease!)));
  }
  async status(userId: string) {
    const connected = await this.db
      .select({
        provider: s.connections.provider,
        backfillBefore: s.connections.backfillBefore,
        lastSyncedAt: s.connections.lastSyncedAt,
        errorCode: s.connections.errorCode,
        disabled: s.connections.disabled,
      })
      .from(s.connections)
      .where(eq(s.connections.userId, userId));
    const uploads = await this.db
      .select({
        id: s.imports.id,
        source: s.imports.source,
        status: s.imports.status,
        errorCode: s.imports.errorCode,
      })
      .from(s.imports)
      .where(eq(s.imports.userId, userId));
    return { connections: connected, imports: uploads };
  }
  async readNights(userId: string, from: string, to: string) {
    return this.db
      .select({ record: s.nights.record })
      .from(s.nights)
      .where(
        and(
          eq(s.nights.userId, userId),
          sql`${s.nights.sleepDate} >= ${from}::date`,
          sql`${s.nights.sleepDate} < ${to}::date`,
        ),
      )
      .orderBy(s.nights.sleepDate);
  }
  async beginDeletion(userId: string) {
    await this.db.update(s.accounts).set({ deleting: true }).where(eq(s.accounts.userId, userId));
  }
  async uploadPaths(userId: string) {
    return this.db
      .select({ path: s.imports.path })
      .from(s.imports)
      .where(eq(s.imports.userId, userId));
  }
  async purge(userId: string, email?: string) {
    await this.db.transaction(async (tx) => {
      await tx.delete(s.accounts).where(eq(s.accounts.userId, userId));
      if (email)
        await tx.execute(sql`delete from public.signups where email = lower(btrim(${email}))`);
    });
  }
  async deleteSignup(email?: string) {
    if (email)
      await this.db.execute(sql`delete from public.signups where email = lower(btrim(${email}))`);
  }
  async pruneStates(now: Date) {
    await this.db.delete(s.oauthStates).where(lte(s.oauthStates.expiresAt, now));
  }
}
