import type { RitualPart } from '@distill/engine/ritual';
import { describe, expect, it } from 'vitest';
import { alwaysYours, momentCards, revealNotes, type RevealDecision } from './reveal';

const keep = (id: string, name: string, reason: string, tier?: string): RevealDecision => ({
  stackItemId: id,
  kind: 'keep',
  reason,
  ...(tier ? { evidenceTier: tier } : {}),
  money: 0,
  name,
});
const items = [
  { id: 'cr', status: 'listed' },
  { id: 'ag1', status: 'listed' },
  { id: 'emf', status: 'listed' },
  { id: 'col', status: 'listed' },
  { id: 'tea', status: 'listed' },
];

describe('the reveal notes', () => {
  it('is clean with what is well-founded, and asks about a no-evidence thing we know nothing about', () => {
    const notes = revealNotes(
      [keep('cr', 'Creatine', 'TRAINS', 'A'), keep('ag1', 'AG1', 'NOTHING_TO_CLEAR', 'N'), keep('emf', 'EMF sticker', 'NOTHING_TO_CLEAR', 'U')],
      items,
      [],
    );
    expect(notes).toEqual({ letGo: [], wellFounded: ['Creatine'], worthALook: ['AG1'] });
  });

  it('never asks about something that is theirs, or that they told us the origin of', () => {
    const ds = [keep('ag1', 'AG1', 'NOTHING_TO_CLEAR', 'N'), keep('col', 'Collagen', 'NOTHING_TO_CLEAR', 'N')];
    expect(revealNotes(ds, [{ id: 'ag1', status: 'listed', origin: 'friend' }, { id: 'col', status: 'listed' }], ['col']).worthALook).toEqual([]);
  });

  it('shows what can go with the money a year, and takes WORTH_A_LOOK from the engine as it comes', () => {
    const notes = revealNotes(
      [
        { stackItemId: 'col', itemKey: null, kind: 'clear', reason: 'BORROWED_WEAK', money: 35, name: 'Collagen' } as RevealDecision,
        { stackItemId: 'emf', kind: 'curate', reason: 'WORTH_A_LOOK', money: 0, name: 'EMF sticker' },
        keep('cr', 'Creatine', 'TRAINS', 'A'),
      ],
      items,
      [],
    );
    expect(notes.letGo).toEqual([{ name: 'Collagen', yearly: 420 }]);
    expect(notes.worthALook).toEqual(['EMF sticker']);
  });

  it('leaves a name holding a word Distill never says off these lines', () => {
    const notes = revealNotes([keep('tea', 'Detox tea', 'NOTHING_TO_CLEAR', 'N')], items, [], ['detox']);
    expect(notes.worthALook).toEqual([]);
  });
});

const part = (id: string, title: string, slot: RitualPart['when']['slot'], over: Partial<RitualPart['when']> = {}, order = 0): RitualPart =>
  ({
    id,
    title,
    when: { slot, days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], ...over },
    order,
    area: 'mind',
    why: '',
    source: { kind: 'stack', stackItemId: id, itemKey: null },
    status: 'active',
    lock: null,
  }) as RitualPart;

describe('the reveal lines', () => {
  it('draws a card a moment, a row a part, with when and whose in a short line', () => {
    const cards = momentCards([
      part('a', 'Creatine', 'morning', {}, 0),
      { ...part('c', 'Gym', 'morning', { days: [], perWeek: 3 }, 1), lock: 'theirs' } as RitualPart,
      part('f', 'Long run', 'morning', { days: ['sat'], at: '07:30' }, 2),
      part('d', 'Walk at lunch', 'midday', {}, 3),
      part('e', 'Journaling', 'night', {}, 4),
      { ...part('g', 'Gone', 'evening'), status: 'removed' } as RitualPart,
    ]);
    expect(cards.map((c) => [c.key, c.title, c.rows.map((r) => [r.title, r.meta])])).toEqual([
      ['morning', 'Begin with yourself.', [['Creatine', ''], ['Gym', 'Yours · 3 times a week'], ['Long run', '7:30am · Weekends']]],
      ['day', 'Through the day.', [['Walk at lunch', '']]],
      ['night', 'Close the day.', [['Journaling', '']]],
    ]);
    expect(momentCards([])).toEqual([]);
  });

  it('keeps what they would never give up, unless Claude already made it part of their Ritual', () => {
    const parts = [part('x', 'Music with dinner', 'evening')];
    expect(alwaysYours(parts, ['Music', 'My dog', 'Time with friends'])).toEqual(['My dog', 'Time with friends']);
  });
});
