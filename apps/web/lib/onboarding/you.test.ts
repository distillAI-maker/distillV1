import { personFromProgress } from '@distill/engine/ritual';
import { describe, expect, it } from 'vitest';
import { emptyProgress, progressSchema, type Progress, type StackItem } from '../progress/types';
import {
  addOwnThing,
  busyAnswer,
  confirmWake,
  feedLine,
  firstOpen,
  fromFeed,
  lifePicks,
  nudgeWake,
  protectedThing,
  readOf,
  setBusy,
  setPeople,
  setValve,
  setWork,
  toggleFeed,
  toggleLife,
  toggleYours,
  wakeLabel,
} from './you';

const now = '2026-10-23T09:00:00.000Z';

function item(id: string, itemKey: string, over: Partial<StackItem> = {}): StackItem {
  return { id, itemKey, monthlyCost: 10, answers: {}, chips: {}, unknown: [], status: 'listed', notes: [], position: 0, ...over };
}
const start = (): Progress => ({
  ...emptyProgress(),
  items: [
    item('ag1', 'greens-powder-ag1-etc'),
    item('gym', 'gym-membership'),
    item('statin', 'magnesium-any-form', { origin: 'doctor' }),
  ],
});
const person = (p: Progress) =>
  personFromProgress(progressSchema.parse(p), { personId: 'x', timeZone: 'UTC', today: '2026-10-23' });

describe('01, which came from a feed', () => {
  it('marks where it came from, so the engine can let a borrowed thing go, and a second tap undoes it', () => {
    let p = toggleFeed(start(), 'ag1');
    expect(p.items.find((i) => i.id === 'ag1')!.origin).toBe('online');
    expect(fromFeed(p)).toEqual(['ag1']);
    expect(feedLine(p)).toBe("One came from a feed. We'll look at it together.");
    p = toggleFeed(p, 'ag1');
    expect(p.items.find((i) => i.id === 'ag1')!.origin).toBeUndefined();
    expect(feedLine(p)).toBe('None from a feed. That makes you rare.');
  });

  it('never marks something a clinician gave them, and a feed thing stops being theirs', () => {
    expect(toggleFeed(start(), 'statin').items.find((i) => i.id === 'statin')!.origin).toBe('doctor');
    const p = toggleFeed(toggleYours(start(), 'gym'), 'gym');
    expect(p.dayOne.yours).toEqual([]);
  });
});

describe("02, what they'd never give up", () => {
  it('makes things from their list theirs, and locked', () => {
    const p = toggleYours(start(), 'gym');
    expect(p.dayOne.yours).toEqual(['gym']);
    expect(person(p).values.gym!.attachment).toBe('theirs');
    expect(toggleYours(p, 'gym').dayOne.yours).toEqual([]);
    expect(toggleYours(p, 'nope')).toBe(p);
  });

  it('keeps things from their life, and their own additions, as theirs in their words', () => {
    let p = toggleLife(start(), 'My dog', now);
    p = addOwnThing(p, '  Sunday   football ', now);
    p = addOwnThing(p, 'sunday football', now);
    expect(lifePicks(p)).toEqual(['My dog', 'Sunday football']);
    expect(p.picture!.lines.every((l) => l.kind === 'theirs' && l.by === 'you')).toBe(true);
    expect(lifePicks(toggleLife(p, 'My dog', now))).toEqual(['Sunday football']);
  });
});

describe('03 to 06, their week', () => {
  it('keeps the wake-up time in quarter hours between 5:00 and 9:30, and saves the default if untouched', () => {
    expect(wakeLabel(start())).toBe('7:00');
    let p = nudgeWake(nudgeWake(start(), -15, now), -15, now);
    expect(wakeLabel(p)).toBe('6:30');
    for (let i = 0; i < 20; i++) p = nudgeWake(p, -15, now);
    expect(wakeLabel(p)).toBe('5:00');
    expect(confirmWake(start(), now).asks).toEqual([{ q: 'What time are you usually up?', a: '07:00', at: now }]);
    expect(confirmWake(p, now)).toBe(p);
  });

  it('keeps what a busy week takes first as theirs, so it is protected, and swaps it cleanly', () => {
    let p = setBusy(start(), 'Time alone', now);
    expect(busyAnswer(p)).toBe('Time alone');
    expect(protectedThing(p)).toBe('Time alone');
    expect(lifePicks(p)).toEqual([]);
    p = setBusy(p, 'Sleep', now);
    expect(protectedThing(p)).toBe('Sleep');
    expect(p.picture!.lines.filter((l) => l.kind === 'theirs')).toHaveLength(1);
  });

  it('ignores answers that are not on the screen', () => {
    const p = start();
    expect(setWork(p, 'Astronaut', now)).toBe(p);
    expect(setValve(p, 'Yelling', now)).toBe(p);
    expect(setPeople(p, 'Everyone', now)).toBe(p);
  });
});

describe('the read', () => {
  it('reads them back from their own answers: the valve, their day, and the promise', () => {
    let p = nudgeWake(nudgeWake(start(), -15, now), -15, now);
    p = setWork(p, 'Desk 9–6', now);
    p = setValve(p, 'Pushing harder', now);
    p = setBusy(p, 'Sleep', now);
    p = setPeople(p, 'Friends', now);
    expect(readOf(p)).toEqual({
      title: ['When it’s a lot, you ', 'push harder.'],
      context: 'Up at 6:30, at a desk till 6. When it’s busy, sleep goes first.',
      promise: 'So: short weekday mornings, nothing touches your sleep, and room for your friends.',
    });
  });

  it('leaves out what they skipped, and never says something they did not tell us', () => {
    const p = setPeople(start(), 'Myself', now);
    expect(readOf(p)).toEqual({ title: ["Here's ", 'what we heard.'], context: null, promise: 'So: room for you.' });
    expect(readOf(start())).toEqual({ title: ["Here's ", 'what we heard.'], context: null, promise: null });
  });

  it('writes a short paragraph in their own voice for the engine, and keeps anything they typed before', () => {
    let p: Progress = { ...start(), lifeText: 'Coffee on the balcony.\n\nAt my best: outside, moving.' };
    p = confirmWake(p, now);
    p = setWork(p, 'Shifts', now);
    p = setValve(p, 'Calling someone', now);
    p = setBusy(p, 'Seeing people', now);
    p = setPeople(p, 'My partner' as never, now);
    p = setPeople(p, 'Partner', now);
    p = toggleLife(p, 'Music', now);
    expect(p.lifeText).toBe(
      "Coffee on the balcony.\n\nMy days: up at 7:00, working shifts. When it's a lot, I call someone. When a week gets busy, seeing people goes first. I want more time with my partner. I'd never give up music.",
    );
    expect(person(p).identity.idealDay).toBe(p.lifeText);
  });

  it('opens where they left off: the top for someone new, the read once everything is answered', () => {
    expect(firstOpen(start())).toBe(0);
    let p = confirmWake(start(), now);
    expect(firstOpen(p)).toBe(3);
    p = setPeople(setBusy(setValve(p, 'Scrolling', now), 'Sleep', now), 'Family', now);
    expect(firstOpen(p)).toBe(6);
  });
});
