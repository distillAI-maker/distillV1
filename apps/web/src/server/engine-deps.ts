import { sql, type Database } from '@distill/data';
import { claudeClient } from '../../lib/ai/engine/call';
import { engineCatalog } from '../../lib/catalog/engine';
import { catalog } from '../../lib/catalog/server';
import { exploreBank } from '../../lib/explore/bank';
import type { Progress } from '../../lib/progress/types';
import { Engine } from './engine';
import { EngineStore } from './engine-store';
import { Journey, shiftDate, syntheticHistory } from './journey';

/**
 * Claude runs only when the team turns it on with ENGINE_CLAUDE=on (and an ANTHROPIC_API_KEY):
 * no API spend before real people use it. Until then every step runs on rules and fixed lines.
 */
export function engineClient() {
  return process.env.ENGINE_CLAUDE === 'on' ? claudeClient() : null;
}

/** The last five weeks of nights: from their wearable, or the demo's synthetic person. */
export async function nightsFor(db: Database, userId: string, progress: Progress, through: string) {
  const source = progress.dataSource === 'demo' ? 'synthetic' : progress.dataSource;
  if (!source) return [];
  const night = (n: { sleepDate: string; totalSleepMinutes: number | null }) => ({
    date: n.sleepDate,
    ...(n.totalSleepMinutes === null ? {} : { sleepMin: n.totalSleepMinutes }),
  });
  if (source === 'synthetic') return syntheticHistory(through, undefined, userId).slice(-35).map((h) => night(h.night));
  const result = await db.execute(sql`select record from public.wearable_nights where user_id = ${userId}::uuid
    and source = ${source} and sleep_date >= ${shiftDate(through, -35)}::date and sleep_date <= ${through}::date
    order by sleep_date`);
  const rows = (Array.isArray(result) ? result : (result as { rows: unknown[] }).rows) as {
    record: { sleepDate: string; totalSleepMinutes: number | null };
  }[];
  return rows.map((r) => night(r.record));
}

export function createEngine(db: Database): Engine {
  const journey = new Journey(db);
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  return new Engine({
    store: new EngineStore(db),
    loadProgress: (userId) => journey.load(userId),
    loadNights: (userId, progress, through) => nightsFor(db, userId, progress, through),
    client: engineClient(),
    catalog: engineCatalog(),
    toneRules: catalog.toneRules,
    bank: exploreBank,
    ...(sha ? { gitSha: sha.slice(0, 12) } : {}),
  });
}
