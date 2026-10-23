import { personFromProgress } from '@distill/engine/ritual';
import { describe, expect, it } from 'vitest';
import { emptyProgress, progressSchema, type Progress, type StackItem } from '../progress/types';
import {
  addOwnThing,
  atBestLine,
  becoming,
  becomingLine,
  lifePicks,
  ownWords,
  pairAnswer,
  setOwnWords,
  setPair,
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
  it('saves each this-or-that as a question and answer, one tap each, and a second tap clears it', () => {
    let p = setPair(start(), 0, 'Early mornings', now);
    expect(p.asks).toEqual([{ q: 'Early mornings or late nights?', a: 'Early mornings', at: now }]);
    p = setPair(p, 0, 'Late nights', now);
    expect(p.asks).toHaveLength(1);
    expect(pairAnswer(p, 0)).toBe('Late nights');
    p = setPair(p, 0, 'Late nights', now);
    expect(p.asks).toEqual([]);
    expect(setPair(p, 0, 'Something else', now)).toBe(p);
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

  it('writes a short ideal day from the taps, so compose has words to read', () => {
    let p = start();
    p = setPair(p, 0, 'Early mornings', now);
    p = setPair(p, 1, 'Go with the flow', now);
    p = setPair(p, 2, 'A slow night in', now);
    p = setPair(p, 3, 'Outdoors', now);
    p = toggleBecoming(p, 'Stronger', now);
    p = toggleLife(p, 'Music', now);
    p = addOwnThing(p, 'Sunday football', now);
    expect(atBestLine(p)).toBe('Up early, outdoors, going with the flow and a slow night in.');
    expect(becomingLine(p)).toBe('Becoming stronger.');
    expect(p.lifeText).toBe(
      "At my best: up early, outdoors, going with the flow and a slow night in. Becoming stronger. I'd never give up music and Sunday football.",
    );
    const person = personFromProgress(progressSchema.parse(p), { personId: 'x', timeZone: 'UTC', today: '2026-10-22' });
    expect(person.identity.idealDay).toBe(p.lifeText);
  });

  it('keeps an ideal day someone typed in the older flow, and rewrites only its own part', () => {
    let p: Progress = { ...start(), lifeText: 'Coffee on the balcony, then a long walk.' };
    p = setPair(p, 3, 'The city', now);
    expect(p.lifeText).toBe('Coffee on the balcony, then a long walk.\n\nAt my best: in the city.');
    p = setPair(p, 3, 'The city', now);
    expect(p.lifeText).toBe('Coffee on the balcony, then a long walk.');
  });

  it('says nothing at all when they skip every tap', () => {
    expect(atBestLine(start())).toBeNull();
    expect(becomingLine(start())).toBeNull();
    expect(setPair(setPair(start(), 1, 'Set plans', now), 1, 'Set plans', now).lifeText).toBe('');
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
