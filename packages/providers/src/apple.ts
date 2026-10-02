import { Readable } from 'node:stream';
import { StringDecoder } from 'node:string_decoder';
import { SaxesParser } from 'saxes';
import { Parse } from 'unzipper';
import { createHash } from 'node:crypto';
import { emptyMetrics, primaryNights } from './types.js';
import type { NightRecord, RawWriter, Workout } from './types.js';
import type { ImportedData } from './imports.js';

type Sample = {
  type: string;
  value: string;
  start: string;
  end: string;
  unit: string;
  device: string | null;
};
const sleepType = 'HKCategoryTypeIdentifierSleepAnalysis';
const wanted = new Set([
  sleepType,
  'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
  'HKQuantityTypeIdentifierRestingHeartRate',
  'HKQuantityTypeIdentifierRespiratoryRate',
]);
const asleep = (s: Sample) =>
  /HKCategoryValueSleepAnalysisAsleep(?:Unspecified|Core|Deep|REM)?$/.test(s.value);
const stamp = (value: string): string => {
  const result = value.replace(' ', 'T').replace(/ ([+-]\d{2})(\d{2})$/, '$1:$2');
  if (!Number.isFinite(+new Date(result)) || !/(Z|[+-]\d{2}:\d{2})$/.test(result))
    throw new Error('Apple timestamp requires offset');
  return result;
};
const id = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function unionMinutes(samples: Sample[]): number {
  const intervals = samples
    .map((s) => [+new Date(s.start), +new Date(s.end)] as const)
    .sort((a, b) => a[0] - b[0]);
  let total = 0,
    right = -Infinity;
  for (const [start, end] of intervals) {
    total += Math.max(0, end - Math.max(start, right));
    right = Math.max(right, end);
  }
  return total / 60000;
}
export interface AppleImportOptions {
  /** Explicit selection avoids combining duplicated samples from Watch, iPhone and third-party apps. */
  sourceName: string;
  maxXmlBytes?: number;
  maxRelevantRecords?: number;
}

/** SAX parsing holds only selected sleep/metric records, never the XML tree or unrelated health data. */
export async function parseAppleXml(
  input: AsyncIterable<Uint8Array>,
  options: AppleImportOptions,
  raw: RawWriter,
): Promise<ImportedData> {
  if (!options.sourceName.trim()) throw new Error('Apple sourceName is required');
  const samples: Sample[] = [];
  const workoutRows: Record<string, string>[] = [];
  const parser = new SaxesParser({ xmlns: false });
  const decoder = new StringDecoder('utf8');
  let bytes = 0,
    root = false,
    records = 0;
  parser.on('doctype', (dtd) => {
    // Apple's internal element declarations are harmless; entities/external DTDs are not accepted.
    if (/<!ENTITY|\bSYSTEM\b|\bPUBLIC\b/i.test(dtd))
      throw new Error('External XML entities are not allowed');
  });
  parser.on('opentag', (node) => {
    if (!root) {
      if (node.name !== 'HealthData') throw new Error('Expected Apple HealthData XML');
      root = true;
    }
    const a = node.attributes as Record<string, string>;
    if (a.sourceName !== options.sourceName) return;
    if (node.name === 'Record' && wanted.has(a.type ?? '')) {
      const sample: Sample = {
        type: a.type!,
        value: a.value ?? '',
        unit: a.unit ?? '',
        start: stamp(a.startDate ?? ''),
        end: stamp(a.endDate ?? ''),
        device: a.device ?? null,
      };
      if (+new Date(sample.end) < +new Date(sample.start)) throw new Error('Reversed Apple sample');
      samples.push(sample);
      records++;
    } else if (node.name === 'Workout') {
      workoutRows.push(a);
      records++;
    }
    if (records > (options.maxRelevantRecords ?? 1000000))
      throw new Error('Apple record limit exceeded');
  });
  for await (const chunk of input) {
    bytes += chunk.length;
    if (bytes > (options.maxXmlBytes ?? 1024 * 1024 * 1024))
      throw new Error('Apple XML limit exceeded');
    parser.write(decoder.write(Buffer.from(chunk)));
  }
  parser.write(decoder.end()).close();
  if (!root) throw new Error('Empty Apple XML');
  const sleep = samples
    .filter((s) => s.type === sleepType && asleep(s))
    .sort((a, b) => +new Date(a.start) - +new Date(b.start));
  const episodes: Sample[][] = [];
  let right = -Infinity;
  for (const sample of sleep) {
    // Infer sessions, not missing awake minutes. Unknown gaps stay unknown.
    if (+new Date(sample.start) - right > 90 * 60000) episodes.push([]);
    episodes.at(-1)!.push(sample);
    right = Math.max(right, +new Date(sample.end));
  }
  const nights: NightRecord[] = [];
  for (const episode of episodes) {
    const first = episode[0]!,
      last = [...episode].sort((a, b) => +new Date(a.end) - +new Date(b.end)).at(-1)!;
    const start = +new Date(first.start),
      end = +new Date(last.end);
    const day = last.end.slice(0, 10);
    const within = samples.filter((s) => +new Date(s.start) >= start && +new Date(s.end) <= end);
    const average = (type: string, unit: string) => {
      const relevant = within.filter((s) => s.type === type);
      if (!relevant.length) return null;
      if (
        relevant.some(
          (s) => s.unit !== unit || !Number.isFinite(Number(s.value)) || !s.value.trim(),
        )
      )
        throw new Error('Unsupported Apple metric unit/value');
      const unique = [...new Map(relevant.map((s) => [id(s), s])).values()];
      return unique.reduce((sum, s) => sum + Number(s.value), 0) / unique.length;
    };
    const stagesReported = episode.some((s) => /Asleep(Core|Deep|REM)$/.test(s.value));
    const awake = within.filter(
      (s) => s.type === sleepType && s.value === 'HKCategoryValueSleepAnalysisAwake',
    );
    const sourceId = id({ sourceName: options.sourceName, start: first.start, end: last.end });
    nights.push({
      ...emptyMetrics,
      sleepDate: day,
      source: 'apple_export',
      sourceId,
      deviceModel: first.device,
      hrvMethod: 'sdnn',
      sleepStart: first.start,
      sleepEnd: last.end,
      totalSleepMinutes: unionMinutes(episode),
      deepSleepMinutes: stagesReported
        ? unionMinutes(episode.filter((s) => s.value.endsWith('AsleepDeep')))
        : null,
      remSleepMinutes: stagesReported
        ? unionMinutes(episode.filter((s) => s.value.endsWith('AsleepREM')))
        : null,
      wakeAfterSleepOnsetMinutes: awake.length ? unionMinutes(awake) : null,
      overnightHrvMs: average('HKQuantityTypeIdentifierHeartRateVariabilitySDNN', 'ms'),
      breathingRatePerMinute: average('HKQuantityTypeIdentifierRespiratoryRate', 'count/min'),
      // Apple resting-HR samples are daily aggregates, not overnight HR. Retain selected raw samples.
      // Wrist temperature exports are absolute values; never relabel them as deviations.
      rawPayloadId: await raw('apple_sleep', sourceId, {
        sourceName: options.sourceName,
        samples: [...episode, ...within],
      }),
    });
  }
  const workouts: Workout[] = [];
  for (const a of workoutRows) {
    const sourceId = id(a);
    workouts.push({
      source: 'apple_export',
      sourceId,
      start: stamp(a.startDate ?? ''),
      end: stamp(a.endDate ?? ''),
      activity: a.workoutActivityType ?? 'unknown',
      deviceModel: a.device ?? null,
      rawPayloadId: await raw('apple_workout', sourceId, a),
    });
  }
  if (!nights.length && !workouts.length)
    throw new Error('No supported records for the selected Apple sourceName');
  return { nights: primaryNights(nights), workouts, tags: [] };
}

/** Does not extract paths to disk. Consumes export.xml and drains other ZIP members with limits. */
export async function parseAppleZip(
  input: AsyncIterable<Uint8Array>,
  options: AppleImportOptions,
  raw: RawWriter,
): Promise<ImportedData> {
  async function* limited() {
    let size = 0;
    for await (const chunk of input) {
      size += chunk.length;
      if (size > 256 * 1024 * 1024) throw new Error('Apple ZIP limit exceeded');
      yield chunk;
    }
  }
  const source = Readable.from(limited());
  const zip = Parse({ forceStream: true });
  source.on('error', (error) => zip.destroy(error));
  source.pipe(zip);
  let result: ImportedData | undefined,
    entries = 0;
  try {
    for await (const entry of zip) {
      if (++entries > 10000) throw new Error('Too many ZIP entries');
      if (entry.path === 'apple_health_export/export.xml' || entry.path === 'export.xml') {
        if (result) throw new Error('Duplicate export.xml');
        result = await parseAppleXml(entry, options, raw);
      } else {
        await entry.autodrain().promise();
      }
    }
    if (!result) throw new Error('ZIP must contain export.xml');
    return result;
  } finally {
    source.destroy();
    zip.destroy();
  }
}
