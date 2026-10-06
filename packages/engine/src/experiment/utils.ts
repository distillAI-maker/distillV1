export function assertDate(value: string): void {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(+new Date(`${value}T00:00:00Z`)) ||
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value
  )
    throw new Error('Invalid local date');
}
export function addDays(value: string, days: number): string {
  assertDate(value);
  return new Date(+new Date(`${value}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
}
export function weekday(value: string): number {
  assertDate(value);
  return new Date(`${value}T00:00:00Z`).getUTCDay();
}
export function nextMonday(value: string): string {
  return addDays(value, (8 - weekday(value)) % 7);
}
export function localDateTime(instant: string, timeZone: string): { date: string; minute: number } {
  if (!Number.isFinite(+new Date(instant))) throw new Error('Invalid timestamp');
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(instant));
  const get = (type: string) => parts.find((part) => part.type === type)!.value;
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minute: Number(get('hour')) * 60 + Number(get('minute')),
  };
}
/** Detach input references as well as freezing nested values. */
export function immutable<T>(input: T): T {
  const copy = structuredClone(input);
  const freeze = (value: unknown) => {
    if (value && typeof value === 'object') {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
  };
  freeze(copy);
  return copy;
}
export function median(values: readonly number[]): number {
  if (!values.length) throw new Error('No measurements');
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}
export function sameJson(a: unknown, b: unknown): boolean {
  const normalize = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(normalize);
    if (value && typeof value === 'object')
      return Object.fromEntries(
        Object.entries(value)
          .filter(([, entry]) => entry !== undefined)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, entry]) => [key, normalize(entry)]),
      );
    return value;
  };
  return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
}
