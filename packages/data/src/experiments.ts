import { and, eq } from 'drizzle-orm';
import { assertPreRegistration, recordCheckIn } from '@distill/engine/experiment';
import type { PreRegistration } from '@distill/engine/experiment';
import type { Database } from './repository.js';
import * as s from './schema.js';

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
/** Caller derives userId from verified Auth. Browser clients have no direct table permissions. */
export class ExperimentRepository {
  constructor(readonly db: Database) {}
  private async activeAccount(tx: Transaction, userId: string) {
    const [account] = await tx
      .select()
      .from(s.accounts)
      .where(eq(s.accounts.userId, userId))
      .for('update');
    if (!account || account.deleting) throw new Error('Account unavailable');
  }
  async createCycle(userId: string, id: string, now: Date) {
    await this.db.transaction(async (tx) => {
      await this.activeAccount(tx, userId);
      await tx.insert(s.experimentCycles).values({ id, userId, createdAt: now });
    });
  }
  async veto(userId: string, cycleId: string, itemId: string) {
    if (!itemId) throw new Error('Item ID required');
    await this.db.transaction(async (tx) => {
      await this.activeAccount(tx, userId);
      const [running] = await tx
        .select()
        .from(s.experiments)
        .where(and(eq(s.experiments.userId, userId), eq(s.experiments.status, 'active')));
      if (running) throw new Error('Switch the active test instead of vetoing');
      const [cycle] = await tx
        .select()
        .from(s.experimentCycles)
        .where(and(eq(s.experimentCycles.id, cycleId), eq(s.experimentCycles.userId, userId)))
        .for('update');
      if (!cycle) throw new Error('Cycle not found');
      if (cycle.vetoedItemId) throw new Error('Veto already used in this cycle');
      await tx
        .update(s.experimentCycles)
        .set({ vetoedItemId: itemId })
        .where(eq(s.experimentCycles.id, cycleId));
    });
  }
  private async insert(tx: Transaction, userId: string, record: PreRegistration) {
    const [cycle] = await tx
      .select()
      .from(s.experimentCycles)
      .where(and(eq(s.experimentCycles.id, record.cycleId), eq(s.experimentCycles.userId, userId)));
    if (!cycle || cycle.vetoedItemId === record.itemId)
      throw new Error('Cycle unavailable or item vetoed');
    await tx.insert(s.experiments).values({
      id: record.experimentId,
      userId,
      cycleId: record.cycleId,
      preRegistration: record,
      status: 'active',
      startedAt: new Date(record.lockedAt),
    });
  }
  async start(userId: string, record: PreRegistration) {
    assertPreRegistration(record);
    await this.db.transaction(async (tx) => {
      await this.activeAccount(tx, userId);
      await this.insert(tx, userId, record);
    });
  }
  async switch(userId: string, currentId: string, next: PreRegistration) {
    assertPreRegistration(next);
    await this.db.transaction(async (tx) => {
      await this.activeAccount(tx, userId);
      const [current] = await tx
        .select()
        .from(s.experiments)
        .where(
          and(
            eq(s.experiments.id, currentId),
            eq(s.experiments.userId, userId),
            eq(s.experiments.status, 'active'),
          ),
        )
        .for('update');
      if (
        !current ||
        next.cycleId !== current.cycleId ||
        next.itemId === current.preRegistration.itemId ||
        +new Date(next.lockedAt) < +current.startedAt
      )
        throw new Error('Invalid experiment switch');
      await tx
        .update(s.experiments)
        .set({ status: 'switched', endedAt: new Date(next.lockedAt) })
        .where(eq(s.experiments.id, currentId));
      await this.insert(tx, userId, next);
    });
  }
  async checkIn(
    userId: string,
    experimentId: string,
    input: Parameters<typeof recordCheckIn>[1],
    now: Date,
  ) {
    return this.db.transaction(async (tx) => {
      await this.activeAccount(tx, userId);
      const [experiment] = await tx
        .select()
        .from(s.experiments)
        .where(
          and(
            eq(s.experiments.id, experimentId),
            eq(s.experiments.userId, userId),
            eq(s.experiments.status, 'active'),
          ),
        )
        .for('update');
      if (!experiment) throw new Error('Active experiment not found');
      const localDate = new Intl.DateTimeFormat('en-CA', {
        timeZone: experiment.preRegistration.timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(now);
      if (input.sleepDate > localDate) throw new Error('Cannot record a future night');
      const entry = recordCheckIn(experiment.preRegistration, input);
      await tx
        .insert(s.experimentCheckIns)
        .values({ experimentId, sleepDate: entry.sleepDate, entry, recordedAt: now })
        .onConflictDoUpdate({
          target: [s.experimentCheckIns.experimentId, s.experimentCheckIns.sleepDate],
          set: { entry, recordedAt: now },
        });
      return entry;
    });
  }
  async close(userId: string, id: string, status: 'completed' | 'cancelled', now: Date) {
    if (!['completed', 'cancelled'].includes(status)) throw new Error('Invalid close status');
    await this.db.transaction(async (tx) => {
      await this.activeAccount(tx, userId);
      const [row] = await tx
        .select()
        .from(s.experiments)
        .where(
          and(
            eq(s.experiments.id, id),
            eq(s.experiments.userId, userId),
            eq(s.experiments.status, 'active'),
          ),
        )
        .for('update');
      if (!row || +now < +row.startedAt)
        throw new Error('Active experiment not found or invalid close time');
      const lastWakeDate = row.preRegistration.schedule.days.at(-1)!.sleepDate;
      const date = new Intl.DateTimeFormat('en-CA', {
        timeZone: row.preRegistration.timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(now);
      if (status === 'completed' && date < lastWakeDate)
        throw new Error('Experiment schedule has not finished');
      await tx.update(s.experiments).set({ status, endedAt: now }).where(eq(s.experiments.id, id));
    });
  }
  async read(userId: string) {
    return this.db
      .select()
      .from(s.experiments)
      .where(eq(s.experiments.userId, userId))
      .orderBy(s.experiments.startedAt);
  }
  async readCheckIns(userId: string, id: string) {
    return this.db
      .select({ entry: s.experimentCheckIns.entry })
      .from(s.experimentCheckIns)
      .innerJoin(s.experiments, eq(s.experiments.id, s.experimentCheckIns.experimentId))
      .where(and(eq(s.experiments.id, id), eq(s.experiments.userId, userId)))
      .orderBy(s.experimentCheckIns.sleepDate);
  }
}
