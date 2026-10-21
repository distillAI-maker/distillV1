import { describe, expect, it } from 'vitest';
import { pickDaily } from '../../app/(app)/home/standard-home';
import { pickQuestion } from '../daily';
import { morePlaces } from '../catalog/common';
import { copy } from '../copy';
import { emptyProgress, type PictureLine, type Progress } from '../progress/types';
import { describePerson } from './companion';
import { mergePicture, type PersonContext } from './person';

const line = (text: string, by: PictureLine['by'], kind: PictureLine['kind'] = 'joy') => ({
  id: text,
  kind,
  text,
  by,
  at: '2026-10-01T00:00:00.000Z',
});

describe('mergePicture', () => {
  const current: Progress['picture'] = {
    lines: [line('Leah. Saturdays are hers.', 'you', 'people'), line('Mornings by the water.', 'distill')],
    removed: ['You love early nights.'],
    updatedAt: '2026-10-01T00:00:00.000Z',
  };

  it('keeps their own lines, keeps unchanged lines as they were, and reports only new ones', () => {
    const { picture, added } = mergePicture(current, [
      { kind: 'joy', text: 'Mornings by the water.' },
      { kind: 'toward', text: 'Your first half marathon, for you.' },
    ]);
    expect(picture.lines.map((l) => [l.text, l.by])).toEqual([
      ['Leah. Saturdays are hers.', 'you'],
      ['Mornings by the water.', 'distill'],
      ['Your first half marathon, for you.', 'distill'],
    ]);
    expect(picture.lines[1]?.id).toBe('Mornings by the water.');
    expect(added).toEqual(['Your first half marathon, for you.']);
  });

  it('never brings back a deleted line or repeats one of theirs', () => {
    const { picture, added } = mergePicture(current, [
      { kind: 'joy', text: 'You love early nights.' },
      { kind: 'people', text: 'leah. saturdays are hers.' },
    ]);
    expect(picture.lines.map((l) => l.text)).toEqual(['Leah. Saturdays are hers.']);
    expect(added).toEqual([]);
    expect(picture.removed).toEqual(['You love early nights.']);
  });
});

describe('describePerson', () => {
  const person: PersonContext = {
    name: 'Maya',
    idealDay: 'Coffee on the balcony, then Pilates with Leah.',
    goals: ['Feel calmer', 'Nothing specific'],
    rituals: [
      { name: 'Club Pilates', kind: 'Reformer Pilates', theirs: true, letGo: false, notes: ['With Leah.'] },
    ],
    answers: [{ q: 'Who do you feel your best around?', a: 'Leah.' }],
    picture: [{ kind: 'people', text: 'Leah. Saturdays are hers.', theirs: true }],
    removed: ['You love early nights.'],
  };

  it('gives notes only when asked, marks their own lines, and lists what they deleted', () => {
    const withNotes = describePerson(person, true);
    expect(withNotes).toContain('Note: With Leah.');
    expect(withNotes).toContain('Leah. Saturdays are hers. (theirs)');
    expect(withNotes).toContain('<removed>\n- You love early nights.\n</removed>');
    expect(withNotes).not.toContain('Nothing specific');
    expect(describePerson(person, false)).not.toContain('Note:');
  });
});

describe('pickQuestion', () => {
  it('asks about the part we know least, and never the same question twice while others remain', () => {
    const progress: Progress = {
      ...emptyProgress(),
      picture: {
        lines: [line('a', 'distill', 'joy'), line('b', 'distill', 'people'), line('c', 'distill', 'theirs')],
        removed: [],
        updatedAt: '',
      },
    };
    const toward = copy.home.questions.toward.map((x) => x.q);
    expect(toward).toContain(pickQuestion(3, progress));
    const asked = toward.map((q) => ({ q, a: 'x', at: '' }));
    expect(toward).not.toContain(pickQuestion(3, { ...progress, asks: asked }));
  });
});

describe('pickDaily', () => {
  const routed = { items: [], overlaps: [], queue: [] };
  const days = ['2026-10-12', '2026-10-13'];

  it('asks "anything we haven\'t seen?" every other day, a new place each time, until all are asked', () => {
    const fresh = { ...emptyProgress() };
    const picks = days.map((d) => pickDaily(d, routed, fresh));
    expect(picks.filter((p) => p.kind === 'more').map((p) => p.ref)).toEqual([morePlaces[0]?.id]);
    const later = { ...fresh, moreAsked: [morePlaces[0]?.id ?? ''] };
    expect(days.map((d) => pickDaily(d, routed, later)).find((p) => p.kind === 'more')?.ref).toBe(
      morePlaces[1]?.id,
    );
    const allAsked = { ...fresh, moreAsked: morePlaces.map((p) => p.id) };
    expect(days.map((d) => pickDaily(d, routed, allAsked).kind)).not.toContain('more');
  });
});
