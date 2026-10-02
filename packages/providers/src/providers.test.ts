import { describe, expect, it, vi } from 'vitest';
import { Readable } from 'node:stream';
import { deflateRawSync } from 'node:zlib';
import { ApiClient, ProviderError } from './http.js';
import { OuraProvider, WhoopProvider } from './remote.js';
import { FitbitProvider } from './fitbit.js';
import { parseAppleXml, parseAppleZip } from './apple.js';
import { garminProvider, parseNightCsv, ImportedProvider } from './imports.js';
import { emptyMetrics, nightRecordSchema } from './types.js';

const from = new Date('2026-03-08'),
  to = new Date('2026-03-09');
const raw = vi.fn(async (kind: string, id: string, _payload: unknown) => `${kind}:${id}`);
function mockApi(replies: unknown[]) {
  const fetcher = vi.fn<typeof fetch>(async () => Response.json(replies.shift()));
  return { fetcher, api: new ApiClient('https://example.test', async () => 'access', fetcher) };
}
const sleep = {
  id: 'sleep1',
  day: '2026-03-08',
  type: 'long_sleep',
  bedtime_start: '2026-03-07T23:00:00-08:00',
  bedtime_end: '2026-03-08T07:00:00-07:00',
  total_sleep_duration: 24000,
  deep_sleep_duration: 3600,
  rem_sleep_duration: 5400,
  latency: 600,
  efficiency: 95,
  average_hrv: 42,
  lowest_heart_rate: 51,
  average_breath: 14,
};

describe('provider contracts', () => {
  it('Oura consumes every page, joins readiness, converts seconds and excludes naps', async () => {
    const { api, fetcher } = mockApi([
      { data: [{ ...sleep, type: 'late_nap' }], next_token: 'second' },
      { data: [sleep], next_token: null },
      { data: [{ id: 'ready1', day: sleep.day, temperature_deviation: -0.2 }], next_token: null },
    ]);
    const [night] = await new OuraProvider(api, raw, 'user', ['daily']).fetchNights(
      'user',
      from,
      to,
    );
    expect(night).toMatchObject({
      sleepDate: '2026-03-08',
      totalSleepMinutes: 400,
      deepSleepMinutes: 60,
      remSleepMinutes: 90,
      sleepLatencyMinutes: 10,
      skinTemperatureDeviationC: -0.2,
      wakeAfterSleepOnsetMinutes: null,
    });
    expect(new URL(String(fetcher.mock.calls[1]![0])).searchParams.get('next_token')).toBe(
      'second',
    );
  });
  it('Oura preserves zero values and missing measurements', async () => {
    const { api } = mockApi([
      { data: [{ ...sleep, average_hrv: null, deep_sleep_duration: 0 }] },
      { data: [] },
    ]);
    const [night] = await new OuraProvider(api, raw, 'user', ['daily']).fetchNights(
      'user',
      from,
      to,
    );
    expect(night?.deepSleepMinutes).toBe(0);
    expect(night?.overnightHrvMs).toBeNull();
    expect(night?.skinTemperatureDeviationC).toBeNull();
  });
  it('pulls both Oura tag formats without inventing tags from prose', async () => {
    const { api } = mockApi([
      {
        data: [
          {
            id: 'old',
            day: sleep.day,
            timestamp: sleep.bedtime_start,
            tags: ['caffeine'],
            text: 'unknown',
          },
        ],
      },
      {
        data: [
          {
            id: 'new',
            start_day: sleep.day,
            start_time: sleep.bedtime_end,
            end_time: null,
            tag_type_code: 'alcohol',
            custom_name: null,
          },
        ],
      },
    ]);
    const tags = await new OuraProvider(api, raw, 'user', ['tag']).fetchTags('user', from, to);
    expect(tags.map((t) => t.labels)).toEqual([['caffeine'], ['alcohol']]);
  });
  it('WHOOP v2 joins by sleep UUID, preserves local wake date and does not call absolute temperature deviation', async () => {
    const { api } = mockApi([
      {
        records: [
          {
            id: 'uuid',
            start: '2026-03-07T16:00:00Z',
            end: '2026-03-07T23:00:00Z',
            timezone_offset: '+09:00',
            nap: false,
            score_state: 'SCORED',
            score: {
              respiratory_rate: 14,
              sleep_efficiency_percentage: 90,
              stage_summary: {
                total_light_sleep_time_milli: 18000000,
                total_slow_wave_sleep_time_milli: 3600000,
                total_rem_sleep_time_milli: 3600000,
              },
            },
          },
        ],
      },
      {
        records: [
          {
            sleep_id: 'uuid',
            cycle_id: 1,
            score_state: 'SCORED',
            score: { hrv_rmssd_milli: 52, resting_heart_rate: 60, skin_temp_celsius: 33.7 },
          },
        ],
      },
      { records: [{ id: 1, start: '2026-03-07T00:00:00Z' }] },
    ]);
    const [night] = await new WhoopProvider(api, raw, 'user').fetchNights('user', from, to);
    expect(night).toMatchObject({
      sleepDate: '2026-03-08',
      totalSleepMinutes: 420,
      overnightHrvMs: 52,
      restingHeartRateBpm: 60,
      skinTemperatureDeviationC: null,
      sleepLatencyMinutes: null,
    });
    expect(raw).toHaveBeenCalledWith('cycle', '1', expect.anything());
  });
  it('does not report pagination loops as a successful partial history', async () => {
    const { api } = mockApi([
      { data: [], next_token: 'same' },
      { data: [], next_token: 'same' },
    ]);
    await expect(api.pages('/sleep', {}, 'data', 'next_token')).rejects.toThrow('pagination_loop');
  });
  it('does not leak OAuth headers on an off-host pagination URL', async () => {
    const { api, fetcher } = mockApi([]);
    await expect(api.get('https://attacker.invalid/')).rejects.toThrow('unsafe_provider_url');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('propagates rate limit timing without the provider response body', async () => {
    const api = new ApiClient(
      'https://example.test',
      async () => 'secret',
      vi.fn(
        async () => new Response('sensitive', { status: 429, headers: { 'Retry-After': '120' } }),
      ),
    );
    await expect(api.get('/sleep')).rejects.toMatchObject({
      status: 429,
      retryAfterSeconds: 120,
      message: 'provider_request_failed',
    });
  });
  it('gates Fitbit both by approval flag and shutdown date', async () => {
    const { api, fetcher } = mockApi([]);
    await expect(new FitbitProvider(api, raw, 'u').fetchNights('u', from, to)).rejects.toThrow(
      'fitbit_migration_required',
    );
    await expect(
      new FitbitProvider(api, raw, 'u', true, () => new Date('2026-10-30')).fetchNights(
        'u',
        from,
        to,
      ),
    ).rejects.toThrow('fitbit_migration_required');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('normalizes legacy Fitbit summaries while keeping offset-less timestamps out of UTC fields', async () => {
    const { api } = mockApi([
      {
        sleep: [
          {
            logId: 10,
            dateOfSleep: '2026-03-08',
            isMainSleep: true,
            type: 'stages',
            minutesAsleep: 410,
            efficiency: 91,
            minutesToFallAsleep: 0,
            levels: { summary: { deep: { minutes: 50 }, rem: { minutes: 100 } } },
          },
        ],
      },
      { hrv: [{ dateTime: '2026-03-08', value: { dailyRmssd: 44 } }] },
      { 'activities-heart': [{ dateTime: '2026-03-08', value: { restingHeartRate: 61 } }] },
      { br: [] },
      { tempSkin: [] },
    ]);
    const [night] = await new FitbitProvider(
      api,
      raw,
      'u',
      true,
      () => new Date('2026-10-02'),
    ).fetchNights('u', from, to);
    expect(night).toMatchObject({
      totalSleepMinutes: 410,
      overnightHrvMs: 44,
      restingHeartRateBpm: 61,
      sleepStart: null,
      breathingRatePerMinute: null,
    });
  });
  it('fails honestly for Garmin approval rather than returning an empty successful sync', async () => {
    await expect(garminProvider.fetchNights()).rejects.toBeInstanceOf(ProviderError);
  });
  it('rejects impossible normalized metric values', () => {
    expect(() =>
      nightRecordSchema.parse({
        ...emptyMetrics,
        source: 'csv',
        sourceId: '1',
        sleepDate: '2026-02-30',
        rawPayloadId: 'raw',
        deviceModel: null,
        hrvMethod: null,
        sleepStart: null,
        sleepEnd: null,
        sleepEfficiencyPercent: 101,
      }),
    ).toThrow();
  });
});

function xml(records: string) {
  return `<?xml version="1.0"?><!DOCTYPE HealthData [<!ELEMENT HealthData ANY>]><HealthData>${records}</HealthData>`;
}
function record(value: string, start: string, end: string, extra = '') {
  return `<Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Watch" value="HKCategoryValueSleepAnalysis${value}" startDate="${start}" endDate="${end}" ${extra}/>`;
}
function chunks(text: string) {
  return Readable.from([...Buffer.from(text)].map((byte) => Buffer.from([byte])));
}
function zip(name: string, text: string) {
  const data = Buffer.from(text),
    compressed = deflateRawSync(data),
    file = Buffer.from(name);
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let b = 0; b < 8; b++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  crc = (crc ^ 0xffffffff) >>> 0;
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(8, 8);
  header.writeUInt32LE(crc, 14);
  header.writeUInt32LE(compressed.length, 18);
  header.writeUInt32LE(data.length, 22);
  header.writeUInt16LE(file.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(compressed.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(file.length, 28);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + file.length, 12);
  end.writeUInt32LE(header.length + file.length + compressed.length, 16);
  return Buffer.concat([header, file, compressed, central, file, end]);
}
describe('streaming fallback imports', () => {
  const content = xml(
    record('AsleepDeep', '2026-03-07 23:00:00 -0800', '2026-03-08 01:00:00 -0800') +
      record('AsleepREM', '2026-03-08 01:00:00 -0800', '2026-03-08 04:00:00 -0700') +
      record('Asleep', '2026-03-07 23:00:00 -0800', '2026-03-08 04:00:00 -0700') +
      '<Record type="HKQuantityTypeIdentifierHeartRateVariabilitySDNN" sourceName="Watch" unit="ms" value="42" startDate="2026-03-08 00:00:00 -0800" endDate="2026-03-08 00:00:00 -0800"/>',
  );
  it('streams XML split at every byte, joins midnight/DST and avoids double-counting generic sleep', async () => {
    const data = await parseAppleXml(chunks(content), { sourceName: 'Watch' }, raw);
    expect(data.nights).toHaveLength(1);
    expect(data.nights[0]).toMatchObject({
      sleepDate: '2026-03-08',
      totalSleepMinutes: 240,
      deepSleepMinutes: 120,
      remSleepMinutes: 120,
      overnightHrvMs: 42,
      hrvMethod: 'sdnn',
      sleepEfficiencyPercent: null,
    });
  });
  it('reads export.zip without extracting arbitrary paths', async () => {
    const data = await parseAppleZip(
      Readable.from([zip('apple_health_export/export.xml', content)]),
      { sourceName: 'Watch' },
      raw,
    );
    expect(data.nights[0]?.totalSleepMinutes).toBe(240);
    await expect(
      parseAppleZip(
        Readable.from([zip('../../export.xml', content)]),
        { sourceName: 'Watch' },
        raw,
      ),
    ).rejects.toThrow('must contain');
  });
  it('rejects entity declarations, truncated XML, limits and unmatched sources', async () => {
    await expect(
      parseAppleXml(
        chunks('<!DOCTYPE HealthData [<!ENTITY x SYSTEM "file:///secrets">]><HealthData/>'),
        { sourceName: 'Watch' },
        raw,
      ),
    ).rejects.toThrow('entities');
    await expect(
      parseAppleXml(chunks('<HealthData>'), { sourceName: 'Watch' }, raw),
    ).rejects.toThrow();
    await expect(
      parseAppleXml(chunks(content), { sourceName: 'Watch', maxXmlBytes: 20 }, raw),
    ).rejects.toThrow('limit');
    await expect(
      parseAppleXml(chunks(content), { sourceName: 'Different watch' }, raw),
    ).rejects.toThrow('No supported');
  });
  it('CSV supports quoted cells, preserves blank/null versus zero and enforces an HRV method', async () => {
    const data = await parseNightCsv(
      chunks(
        'sleepDate,totalSleepMinutes,deepSleepMinutes,deviceModel\r\n2026-03-08,400,0,"Watch, model 2"\r\n',
      ),
      raw,
    );
    expect(data.nights[0]).toMatchObject({
      deepSleepMinutes: 0,
      remSleepMinutes: null,
      deviceModel: 'Watch, model 2',
    });
    await expect(
      parseNightCsv(chunks('sleepDate,overnightHrvMs\n2026-03-08,50'), raw),
    ).rejects.toThrow('hrvMethod');
    await expect(
      parseNightCsv(chunks('sleepDate,totalSleepMinutes\n2026-03-08,NaN'), raw),
    ).rejects.toThrow('Invalid CSV metric');
    await expect(parseNightCsv(chunks('sleepDate\n2026-03-08\n2026-03-08'), raw)).rejects.toThrow(
      'duplicate',
    );
    const provider = new ImportedProvider('csv', 'owner', data);
    expect(await provider.fetchNights('owner', from, to)).toHaveLength(1);
    await expect(provider.fetchNights('someone-else', from, to)).rejects.toThrow('owner');
  });
});
