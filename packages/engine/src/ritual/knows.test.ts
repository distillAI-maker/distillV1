import { describe, expect, it } from 'vitest';
import { applyPersonOps, forgetFact, knowsOf, nowFromWords, nowOn, personFromProgress, refreshFromProgress, type ProgressLike } from './person.js';

const progress: ProgressLike = {
  name: 'Maya',
  lifeText: '',
  goals: ['Sleep better'],
  items: [],
  dayOne: { yours: [] },
  asks: [],
};
const today = '2026-11-05';
const maya = () => personFromProgress(progress, { personId: 'u', timeZone: 'UTC', today });
const ctx = { today, nameOf: () => null };

describe('what Distill reads from plain words', () => {
  it.each([
    ['I have injured my back', 'Your back is hurt'],
    ["I've pulled my left hamstring", 'Your hamstring is hurt'],
    ['my knees are really sore', 'Your knees are hurt'],
    ['My shoulder hurts', 'Your shoulder is hurt'],
    ['Got the flu', 'You have the flu'],
    ['I am sick', "You're not feeling well"],
  ])('%s', (said, line) => {
    expect(nowFromWords(said, today).map((o) => o.text)).toEqual([line]);
  });
  it.each(['my back does not hurt', "I didn't hurt my knee", 'I hurt my feelings', 'out late tonight', 'I used to have the flu'])(
    'reads nothing into "%s"',
    (said) => {
      expect(nowFromWords(said, today)).toEqual([]);
    },
  );
  it('keeps the words it came from', () => {
    const [op] = nowFromWords('Long week. I have injured my back.', today);
    expect(op!.quote).toBe('I have injured my back.');
  });
});

describe('right now', () => {
  it('applies only with their words behind it, and wears off', () => {
    const lied = applyPersonOps(maya(), [{ op: 'now', text: 'Your back is hurt', quote: 'my back hurts' }], 'out late', {
      today,
      at: today,
      from: 'message',
    });
    expect(lied.applied).toEqual([]);
    const { person } = applyPersonOps(maya(), [{ op: 'now', text: 'Your back is hurt', until: '2026-11-20', quote: 'my back hurts' }], 'my back hurts', {
      today,
      at: today,
      from: 'message',
    });
    expect(nowOn(person, '2026-11-20').map((n) => n.text)).toEqual(['Your back is hurt']);
    expect(nowOn(person, '2026-11-21')).toEqual([]);
  });
  it('ends when they say it has', () => {
    const { person } = applyPersonOps(maya(), [{ op: 'now', text: 'Your back is hurt', quote: 'my back hurts' }], 'my back hurts', { today, at: today, from: 'message' });
    const id = person.now![0]!.id;
    const over = applyPersonOps(person, [{ op: 'nowOver', id, quote: 'back is fine' }], 'my back is fine now', { today, at: today, from: 'message' });
    expect(over.person.now).toEqual([]);
  });
});

describe('what Distill knows', () => {
  it('leads with what is true right now, then the long view', () => {
    const { person } = applyPersonOps(
      maya(),
      [
        { op: 'person', name: 'Leah', what: 'reformer on Tuesdays', quote: 'Leah' },
        { op: 'now', text: 'Your back is hurt', quote: 'my back hurts' },
      ],
      'my back hurts. Leah',
      { today, at: today, from: 'message' },
    );
    const facts = knowsOf(person, ctx);
    expect(facts[0]).toMatchObject({ group: 'now', text: 'Your back is hurt', since: today });
    expect(facts.map((f) => f.text)).toContain('Leah: reformer on Tuesdays');
    expect(facts.map((f) => f.text)).toContain('Sleep better');
  });
  it('stays corrected when progress is read again', () => {
    const person = forgetFact(maya(), 'goal:Sleep better');
    expect(knowsOf(person, ctx).map((f) => f.text)).not.toContain('Sleep better');
    const again = refreshFromProgress(person, progress, today);
    expect(knowsOf(again, ctx).map((f) => f.text)).not.toContain('Sleep better');
  });
});
