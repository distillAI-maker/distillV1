import { personFromProgress } from '@distill/engine/ritual';
import { describe, expect, it } from 'vitest';
import { emptyProgress, progressSchema, type Progress, type StackItem } from '../progress/types';
import {
  addOwnThing,
  atBestLine,
  becoming,
  becomingLine,
  busyAnswer,
  dayAnswer,
  dayRead,
  lifePicks,
  ownWords,
  protectedThing,
  setBusy,
  setDay,
  setOwnWords,
  toggleBecoming,
  toggleLife,
  toggleYours,
} from './you';

const now = '2026-10-22T18:00:00.000Z';

function item(id: string, itemKey: string): StackItem {
  return { id, itemKey, monthlyCost: 10, answers: {}, chips: {}, unknown: [], status: 'listed', notes: [], position: 0 };
}
const start = (): Progress => ({ ...emptyProgress(), items: [item('gym', 'gym-membership'), item('ag1', 'greens-powder-ag1-etc')] });

describe('you, at your best', () => {
  it('saves each answer about their day as a question and answer, one tap each, and a second tap clears it', () => {
    let p = setDay(start(), 'who', 'Friends', now);
    expect(p.asks).toEqual([{ q: 'Who was there?', a: 'Friends', at: now }]);
    p = setDay(p, 'who', 'Family', now);
    expect(p.asks).toHaveLength(1);
    expect(dayAnswer(p, 'who')).toBe('Family');
    p = setDay(p, 'who', 'Family', now);
    expect(p.asks).toEqual([]);
    expect(setDay(p, 'who', 'Someone else', now)).toBe(p);
  });

  it('reads their day back as they tap, and what it says about them once they say who and what', () => {
    let p = setDay(start(), 'where', 'Outside', now);
    expect(atBestLine(p)).toBe('Outside.');
    expect(dayRead(p)).toBeNull();
    p = setDay(p, 'who', 'Friends', now);
    p = setDay(p, 'doing', 'Moving', now);
    expect(atBestLine(p)).toBe('Outside, with friends, moving.');
    expect(dayRead(p)).toBe('You come alive around people, in motion.');
    p = setDay(setDay(p, 'who', 'Just me', now), 'doing', 'Nothing at all', now);
    expect(atBestLine(p)).toBe('Outside, on your own, doing nothing at all.');
    expect(dayRead(p)).toBe('Quiet is where you come back to yourself.');
    expect(dayRead(setDay(p, 'who', 'My dog', now))).toBe('Quiet is where you come back to yourself.');
  });

  it('keeps what a busy week takes first as theirs, so it is protected, and swaps it cleanly', () => {
    let p = setBusy(start(), 'Time alone', now);
    expect(busyAnswer(p)).toBe('Time alone');
    expect(protectedThing(p)).toBe('Time alone');
    expect(lifePicks(p)).toEqual([]);
    p = setBusy(p, 'Sleep', now);
    expect(protectedThing(p)).toBe('Sleep');
    expect(p.picture!.lines.filter((l) => l.kind === 'theirs')).toHaveLength(1);
    p = setBusy(p, 'Sleep', now);
    expect(protectedThing(p)).toBeNull();
    expect(busyAnswer(p)).toBeUndefined();
  });

  it('keeps who they are becoming as their own toward lines, three at most', () => {
    let p = start();
    for (const b of ['Stronger', 'Calmer', 'More present', 'More social']) p = toggleBecoming(p, b, now);
    expect(becoming(p)).toEqual(['Stronger', 'Calmer', 'More present']);
    p = toggleBecoming(p, 'Calmer', now);
    expect(becoming(p)).toEqual(['Stronger', 'More present']);
    p = setOwnWords(p, 'Back on the bike before work', now);
    expect(ownWords(p)).toBe('Back on the bike before work');
    const person = personFromProgress(progressSchema.parse(p), { personId: 'x', timeZone: 'UTC', today: '2026-10-22' });
    expect(person.identity.toward.map((t) => t.text)).toEqual(['Stronger', 'More present', 'Back on the bike before work']);
    expect(ownWords(setOwnWords(p, '  ', now))).toBe('');
  });

  it('writes a short ideal day in their own voice, so compose has words to read', () => {
    let p = start();
    p = setDay(p, 'where', 'In the city', now);
    p = setDay(p, 'who', 'My partner', now);
    p = setDay(p, 'doing', 'A long meal', now);
    p = setBusy(p, 'Seeing people', now);
    p = toggleBecoming(p, 'Stronger', now);
    p = toggleLife(p, 'Music', now);
    p = addOwnThing(p, 'Sunday football', now);
    expect(p.lifeText).toBe(
      "At my best: in the city, with my partner, over a long meal. When a week gets busy, seeing people goes first. Becoming stronger. I'd never give up music and Sunday football.",
    );
    const person = personFromProgress(progressSchema.parse(p), { personId: 'x', timeZone: 'UTC', today: '2026-10-22' });
    expect(person.identity.idealDay).toBe(p.lifeText);
    expect(person.picture.filter((l) => l.kind === 'theirs').map((l) => l.text)).toEqual(['Seeing people', 'Music', 'Sunday football']);
  });

  it('keeps an ideal day someone typed in the older flow, and rewrites only its own part', () => {
    let p: Progress = { ...start(), lifeText: 'Coffee on the balcony, then a long walk.' };
    p = setDay(p, 'where', 'At home', now);
    expect(p.lifeText).toBe('Coffee on the balcony, then a long walk.\n\nAt my best: at home.');
    p = setDay(p, 'where', 'At home', now);
    expect(p.lifeText).toBe('Coffee on the balcony, then a long walk.');
  });

  it('says nothing at all when they skip every tap', () => {
    expect(atBestLine(start())).toBeNull();
    expect(dayRead(start())).toBeNull();
    expect(becomingLine(start())).toBeNull();
    expect(setDay(setDay(start(), 'doing', 'Moving', now), 'doing', 'Moving', now).lifeText).toBe('');
  });
});

describe('what makes you, you', () => {
  it('makes things from their list theirs, and locked', () => {
    let p = toggleYours(start(), 'gym');
    expect(p.dayOne.yours).toEqual(['gym']);
    const person = personFromProgress(progressSchema.parse(p), { personId: 'x', timeZone: 'UTC', today: '2026-10-22' });
    expect(person.values.gym!.attachment).toBe('theirs');
    expect(person.values.ag1!.attachment).toBe('unknown');
    p = toggleYours(p, 'gym');
    expect(p.dayOne.yours).toEqual([]);
    expect(toggleYours(p, 'not-on-the-list')).toBe(p);
  });

  it('keeps things from their life, and their own additions, as theirs in their words', () => {
    let p = toggleLife(start(), 'My dog', now);
    p = addOwnThing(p, '  Sunday   football ', now);
    p = addOwnThing(p, 'sunday football', now);
    expect(lifePicks(p)).toEqual(['My dog', 'Sunday football']);
    expect(p.picture!.lines.every((l) => l.kind === 'theirs' && l.by === 'you')).toBe(true);
    p = toggleLife(p, 'My dog', now);
    expect(lifePicks(p)).toEqual(['Sunday football']);
    expect(p.lifeText).toBe("At my best: I'd never give up Sunday football.");
    expect(progressSchema.safeParse(p).success).toBe(true);
  });
});
