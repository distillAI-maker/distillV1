import { parse } from 'csv-parse';
import { z } from 'zod';
import { assertRange, emptyMetrics, inRange, nightRecordSchema, primaryNights } from './types.js';
import type { NightRecord, Provider, ProviderId, RawWriter, Tag, Workout } from './types.js';
import { ProviderError } from './http.js';

export interface ImportedData {
  nights: NightRecord[];
  workouts: Workout[];
  tags: Tag[];
}
export class ImportedProvider implements Provider {
  constructor(
    readonly id: 'apple_export' | 'csv' | 'synthetic',
    private owner: string,
    private data: ImportedData,
  ) {}
  async fetchNights(userId: string, from: Date, to: Date) {
    this.check(userId);
    assertRange(from, to);
    return this.data.nights.filter((n) => inRange(n.sleepDate, from, to));
  }
  async fetchWorkouts(userId: string, from: Date, to: Date) {
    this.check(userId);
    assertRange(from, to);
    return this.data.workouts.filter(
      (w) => +new Date(w.start) >= +from && +new Date(w.start) < +to,
    );
  }
  async fetchTags(userId: string, from: Date, to: Date) {
    this.check(userId);
    assertRange(from, to);
    return this.data.tags.filter((t) => +new Date(t.start) >= +from && +new Date(t.start) < +to);
  }
  private check(userId: string) {
    if (userId !== this.owner) throw new Error('Wrong provider owner');
  }
}
export class UnavailableProvider implements Provider {
  constructor(
    readonly id: ProviderId,
    private reason: string,
  ) {}
  async fetchNights(): Promise<NightRecord[]> {
    throw new ProviderError(this.reason, 503);
  }
  async fetchWorkouts(): Promise<Workout[]> {
    throw new ProviderError(this.reason, 503);
  }
}
export const garminProvider = new UnavailableProvider('garmin', 'garmin_partner_approval_required');
/** Synthetic fixtures are owner-bound, just like imports; there is no shared global user. */
export function syntheticProvider(owner: string, data: ImportedData): Provider {
  if (
    !owner ||
    [...data.nights, ...data.workouts, ...data.tags].some((record) => record.source !== 'synthetic')
  )
    throw new Error('Synthetic provider requires an owner and synthetic-only records');
  return new ImportedProvider('synthetic', owner, structuredClone(data));
}

export async function parseNightCsv(
  input: AsyncIterable<Uint8Array>,
  raw: RawWriter,
): Promise<ImportedData> {
  const allowed = new Set(['sleepDate', 'deviceModel', 'hrvMethod', ...Object.keys(emptyMetrics)]);
  const parser = parse({
    columns: (headers: string[]) => {
      if (new Set(headers).size !== headers.length) throw new Error('Duplicate CSV column');
      if (!headers.includes('sleepDate')) throw new Error('Missing sleepDate column');
      if (headers.some((header) => !allowed.has(header))) throw new Error('Unknown CSV column');
      return headers;
    },
    bom: true,
    skip_empty_lines: true,
    max_record_size: 32768,
  });
  const feed = (async () => {
    try {
      let bytes = 0;
      for await (const chunk of input) {
        bytes += chunk.length;
        if (bytes > 20 * 1024 * 1024) throw new Error('CSV too large');
        if (!parser.write(chunk))
          await new Promise<void>((resolve, reject) => {
            parser.once('drain', resolve);
            parser.once('error', reject);
          });
      }
      parser.end();
    } catch (error) {
      parser.destroy(error as Error);
    }
  })();
  const nights: NightRecord[] = [];
  const dates = new Set<string>();
  try {
    for await (const row of parser) {
      const r = z.record(z.string(), z.string()).parse(row);
      if (Object.keys(r).some((k) => !allowed.has(k))) throw new Error('Unknown CSV column');
      const metrics = { ...emptyMetrics };
      for (const key of Object.keys(metrics) as (keyof typeof metrics)[]) {
        const cell = r[key]?.trim();
        if (cell) {
          if (!/^-?\d+(\.\d+)?$/.test(cell)) throw new Error(`Invalid CSV metric: ${key}`);
          metrics[key] = Number(cell);
        }
      }
      const day = r.sleepDate?.trim();
      if (!day || dates.has(day)) throw new Error('Missing or duplicate sleepDate');
      dates.add(day);
      const night = nightRecordSchema.parse({
        ...metrics,
        sleepDate: day,
        source: 'csv',
        sourceId: day,
        deviceModel: r.deviceModel?.trim() || null,
        hrvMethod: r.hrvMethod?.trim() || null,
        rawPayloadId: 'pending',
        sleepStart: null,
        sleepEnd: null,
      });
      if (night.overnightHrvMs !== null && !night.hrvMethod)
        throw new Error('hrvMethod required for HRV');
      night.rawPayloadId = await raw('csv', day, r);
      nights.push(night);
      if (nights.length > 50000) throw new Error('Too many CSV nights');
    }
    await feed;
  } finally {
    parser.destroy();
  }
  if (!nights.length) throw new Error('CSV contains no nights');
  return { nights: primaryNights(nights), workouts: [], tags: [] };
}
