import { describe, expect, it } from 'vitest';
import { emptyProgress, type Progress } from '../progress/types';
import { forgetAnswer, knownFromAnswers, setBusy, toggleLife } from './you';

const NOW = '2026-11-07T10:00:00.000Z';
const item = (id: string, over: Partial<Progress['items'][number]> = {}): Progress['items'][number] => ({ id, itemKey: id, monthlyCost: 0, position: 0, status: 'listed', answers: {}, chips: {}, unknown: [], notes: [], ...over });
const names = (id: string) => ({ ag: 'Greens powder', read: 'Reading before bed' })[id] ?? id;
const asked = (extra: Partial<Progress> = {}): Progress => ({
  ...emptyProgress(),
  asks: [
    { q: 'What time are you usually up?', a: '06:30', at: NOW },
    { q: 'What time are you usually in bed?', a: '22:45', at: NOW },
    { q: 'What are most days?', a: 'Shifts', at: NOW },
    { q: "When it's a lot, what do you reach for?", a: 'Scrolling', at: NOW },
    { q: 'Who do you want more time with?', a: 'Family', at: NOW },
  ],
  ...extra,
});

describe('what their answers say about them', () => {
  it('reads as plain sentences about them', () => {
    const lines = knownFromAnswers(setBusy(asked(), 'Sleep', NOW), names);
    expect(lines.map((l) => [l.group, l.text])).toEqual([
      ['days', "You're usually up at 6:30 am and in bed by 10:45 pm"],
      ['days', "Most days you're working shifts"],
      ['days', 'When a week gets busy, sleep goes first'],
      ['people', 'You want more time with your family'],
      ['you', 'When it’s a lot, you reach for your phone'],
    ]);
  });
  it('says what is theirs, and what came from social media', () => {
    const p = asked({
      items: [item('ag', { origin: 'online' }), item('read')],
      dayOne: { ...emptyProgress().dayOne, yours: ['read'] },
    });
    const texts = knownFromAnswers(toggleLife(p, 'Music', NOW), names).map((l) => l.text);
    expect(texts).toContain("You'd never give up music");
    expect(texts).toContain('Reading before bed is yours, always');
    expect(texts).toContain('Greens powder came from social media');
  });
  it('says nothing they never told us', () => {
    expect(knownFromAnswers(emptyProgress(), names)).toEqual([]);
  });
  it('takes an answer back when they say it is not right, and it stays out of what Claude reads', () => {
    const p = setBusy(asked(), 'Sleep', NOW);
    const without = forgetAnswer(p, 'answer:busy', NOW);
    expect(knownFromAnswers(without, names).map((l) => l.text)).not.toContain('When a week gets busy, sleep goes first');
    expect(without.lifeText).not.toMatch(/goes first/);
    const noDays = forgetAnswer(p, 'answer:day', NOW);
    expect(knownFromAnswers(noDays, names).map((l) => l.id)).not.toContain('answer:day');
    const noFeed = forgetAnswer(asked({ items: [item('ag', { origin: 'online' })] }), 'answer:feed', NOW);
    expect(knownFromAnswers(noFeed, names).map((l) => l.id)).not.toContain('answer:feed');
    expect(forgetAnswer(p, 'answer:nope', NOW)).toBe(p);
  });
});
