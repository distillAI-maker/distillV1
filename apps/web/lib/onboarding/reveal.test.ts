import type { RitualPart } from '@distill/engine/ritual';
import { describe, expect, it } from 'vitest';
import { alwaysYours, revealNotes, ritualSections, type RevealDecision } from './reveal';

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
    expect(notes).toEqual({ letGo: [], wellFounded: ['cr'], worthALook: ['AG1'] });
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
  it('draws a section a moment, a row a part, with a time column and a short line on whose and how well-founded', () => {
    const sections = ritualSections([
      part('a', 'Creatine', 'morning', { at: '07:00' }, 0),
      { ...part('c', 'Gym', 'morning', { days: [], perWeek: 3 }, 1), lock: 'theirs', minutes: 45 } as RitualPart,
      part('f', 'Long run', 'morning', { days: ['sat', 'sun'] }, 2),
      part('d', 'Walk at lunch', 'midday', { days: ['mon', 'tue', 'wed', 'thu', 'fri'] }, 3),
      { ...part('e', 'Magnesium', 'night', { at: '21:00' }, 4), why: 'Part of your days as they are.' } as RitualPart,
      { ...part('h', 'Reading', 'night', {}, 5), why: 'Twenty pages, phone in the other room.' } as RitualPart,
      { ...part('g', 'Gone', 'evening'), status: 'removed' } as RitualPart,
    ], ['a']);
    expect(
      sections.map((c) => [c.key, c.label, c.rows.map((r) => [r.title, r.time.lines.join(' '), r.why, r.yours])]),
    ).toEqual([
      [
        'morning',
        'Morning',
        [
          ['Creatine', '7:00', 'Well-founded.', false],
          ['Gym', '3× a week', 'Yours.', true],
          ['Long run', 'Sat Sun', '', false],
        ],
      ],
      ['day', 'Day', [['Walk at lunch', 'Mon–Fri', '', false]]],
      [
        'night',
        'Evening',
        [
          ['Magnesium', '9:00 pm', '', false],
          ['Reading', 'Daily', 'Twenty pages, phone in the other room.', false],
        ],
      ],
    ]);
    expect(ritualSections([])).toEqual([]);
  });

  it('keeps what they would never give up, unless Claude already made it part of their Ritual', () => {
    const parts = [part('x', 'Music with dinner', 'evening')];
    expect(alwaysYours(parts, ['Music', 'My dog', 'Time with friends'])).toEqual(['My dog', 'Time with friends']);
  });
});
