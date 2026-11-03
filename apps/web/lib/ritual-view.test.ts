import { describe, expect, it } from 'vitest';
import { changesBetween, clock, longDate, partsOn, timeLabel, weekdayLetter } from './ritual-view';

const part = (id: string, when: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  ({ id, title: id, order: 0, status: 'active' as const, when: { days: [], ...when }, ...extra }) as never;

describe('the Ritual tab, read from the engine', () => {
  it('says times the way a person does', () => {
    expect(clock('07:30')).toBe('7:30');
    expect(clock('18:30')).toBe('6:30 pm');
    expect(timeLabel(part('a', { slot: 'evening' }))).toBe('Evening');
    expect(longDate('2026-10-30')).toBe('Friday, 30 October');
    expect(weekdayLetter('2026-10-31')).toBe('S');
  });

  it('puts every-day parts and that weekday’s parts on a date, morning to night', () => {
    const parts = [
      part('wine', { slot: 'evening', days: ['fri'] }),
      part('coffee', { slot: 'morning', at: '07:30' }),
      part('pilates', { slot: 'morning', days: ['sat'], at: '09:00' }),
      part('swim', { slot: 'morning', perWeek: 2 }),
    ];
    expect(partsOn(parts, '2026-10-30').map((p: { id: string }) => p.id)).toEqual(['coffee', 'wine']);
    expect(partsOn(parts, '2026-10-31').map((p: { id: string }) => p.id)).toEqual(['coffee', 'pilates']);
  });

  it('marks what changed on a day: later with the old time, lighter, added', () => {
    const before = [
      part('coffee', { slot: 'morning', at: '07:30' }),
      part('run', { slot: 'morning', at: '09:00' }, { minutes: 45 }),
    ];
    const after = [
      part('coffee', { slot: 'morning', at: '08:15' }),
      part('run', { slot: 'morning', at: '09:00' }, { minutes: 20 }),
      part('sleep-in', { slot: 'morning' }),
    ];
    const marks = changesBetween(before, after);
    expect(marks.get('coffee')).toEqual({ label: 'later', was: '7:30' });
    expect(marks.get('run')).toEqual({ label: 'lighter' });
    expect(marks.get('sleep-in')).toEqual({ label: 'added' });
  });
});
