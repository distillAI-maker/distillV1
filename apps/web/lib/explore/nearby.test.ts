import { describe, expect, it } from 'vitest';
import { bankCity, bankHas, nearbyFor, threadIdeaIds } from './nearby';
import { THREADS } from './threads';

describe('real places near them', () => {
  it('only names ideas that are really in the bank, for threads that really exist', () => {
    for (const id of threadIdeaIds()) expect(bankHas(id), id).toBe(true);
    const threads = new Set(THREADS.map((t) => t.id));
    expect(threads.has('heat-cold')).toBe(true);
  });
  it('knows the cities it has places in, however they write them', () => {
    expect(bankCity('san francisco')).toBe('San Francisco Bay Area');
    expect(bankCity('SF')).toBe('San Francisco Bay Area');
    expect(bankCity('Oakland, CA')).toBe('San Francisco Bay Area');
    expect(bankCity('Brooklyn')).toBe('New York City');
    expect(bankCity('NYC')).toBe('New York City');
    expect(bankCity('Tulsa')).toBeNull();
    expect(bankCity('Sfax')).toBeNull();
  });
  it('is only ever a next step for something they do', () => {
    const titles = nearbyFor([{ id: 'heat-cold' }], 'San Francisco').map((n) => n.title);
    expect(titles).toEqual(['A bay swim and sauna at the Dolphin Club']);
    expect(nearbyFor([], 'San Francisco')).toEqual([]);
  });
  it('stays in their city', () => {
    const sf = nearbyFor([{ id: 'heat-cold' }], 'San Francisco').map((n) => n.id);
    const ny = nearbyFor([{ id: 'heat-cold' }], 'New York').map((n) => n.id);
    expect(sf).toEqual(['idea:sf-dolphin-club-swim-and-sauna']);
    expect(ny).toEqual(['idea:nyc-russian-turkish-baths']);
    expect(nearbyFor([{ id: 'heat-cold' }], 'Tulsa')).toEqual([]);
  });
  it('mixes what they do, not three of the same in a row', () => {
    const list = nearbyFor([{ id: 'walking' }, { id: 'heat-cold' }, { id: 'stillness' }], 'San Francisco');
    expect(list.slice(0, 3).map((n) => n.thread)).toEqual(['walking', 'heat-cold', 'stillness']);
    expect(list.filter((n) => n.thread === 'walking').length).toBeLessThanOrEqual(3);
  });
  it('never repeats one that fits two things, and leaves out what they said no to', () => {
    const list = nearbyFor([{ id: 'heat-cold' }, { id: 'swimming' }], 'San Francisco');
    expect(list.map((n) => n.id)).toEqual(['idea:sf-dolphin-club-swim-and-sauna']);
    expect(nearbyFor([{ id: 'heat-cold' }], 'San Francisco', new Set(['idea:sf-dolphin-club-swim-and-sauna']))).toEqual([]);
  });
  it('says when in a few words', () => {
    for (const n of nearbyFor(THREADS, 'San Francisco')) expect(n.when.length, n.title).toBeLessThanOrEqual(46);
    expect(nearbyFor([{ id: 'walking' }], 'San Francisco')[0]!.when).toBe('Any day');
  });
});
