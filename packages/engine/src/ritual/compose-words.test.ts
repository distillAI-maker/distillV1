import { describe, expect, it } from 'vitest';
import { checkLine, type LineContext } from './check-line.js';
import { idealDayMention, whenFromWords } from './compose.js';
import { plannedMinutes } from './ritual.js';
import { fitsCap, momentCounts } from './validate.js';
import type { RitualPart } from './types.js';

const veer =
  "Waking up early, phone away from bed, morning meditation, natural light, eating a light protein-filled breakfast, go to the gym. After 4:00pm I'd typically go do something fun with friends like a sport. Winding down would start around 10:00pm. Grateful for journaling.";

describe('reading their ideal day', () => {
  it('finds the phrase that names a thing, ignoring time words', () => {
    expect(idealDayMention(veer, 'Morning meditation')).toBe('morning meditation');
    expect(idealDayMention(veer, 'Journalling before bed')).toBe('Grateful for journaling');
  });
  it('needs more than half the name, not one shared word', () => {
    const omar = 'Sleep through the night, just once, without anything strapped to my face. Then chai, a day of debugging boards, and Saturday cricket with the guys.';
    expect(idealDayMention(omar, 'Morning sleep check')).toBeUndefined();
    expect(idealDayMention(omar, 'Saturday cricket with the guys')).toBe('and Saturday cricket with the guys');
  });
  it('finds nothing for a name made only of time words or short words', () => {
    expect(idealDayMention(veer, 'Morning run')).toBeUndefined();
    expect(idealDayMention(veer, 'Gym')).toBeUndefined();
    expect(idealDayMention(veer, '500 ml of water in the morning')).toBeUndefined();
  });
});

describe('when, from their words', () => {
  it('reads "wine night" and "a few nights a week" as an evening, not night', () => {
    expect(whenFromWords('Wine night or a fun dinner with friends, a few nights a week.').slot).toBe('evening');
  });
  it('still reads night when they mean it', () => {
    expect(whenFromWords('Journal before bed').slot).toBe('night');
  });
});

const part = (id: string, days: RitualPart['when']['days'], slot: RitualPart['when']['slot'] = 'morning'): RitualPart => ({
  id,
  when: { slot, days },
  order: 0,
  title: id,
  area: 'mind',
  why: 'x',
  source: { kind: 'engine', rule: 'walk' },
  status: 'active',
  lock: null,
});

describe('the day-one cap', () => {
  const all = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
  it('counts a whole weekend day as one moment', () => {
    const counts = momentCounts([part('a', [...all]), part('b', [...all], 'night')]);
    expect(counts.get('mon:morning')).toBe(1);
    expect(counts.get('sat:saturday')).toBe(2);
  });
  it('lets a moment the rules overfilled stay that full, never fuller', () => {
    const rules = [part('a', ['sat']), part('b', ['sat']), part('c', ['sat']), part('d', ['sat'])];
    const baseline = momentCounts(rules);
    expect(fitsCap(rules, 3, baseline)).toBe(true);
    expect(fitsCap([...rules, part('e', ['sat'])], 3, baseline)).toBe(false);
    expect(fitsCap([...rules, part('e', ['mon'])], 3, baseline)).toBe(true);
  });
});

describe('more words read right', () => {
  it('reads "a fun night out over a cozy night in" as an evening', () => {
    expect(whenFromWords('Wine night or a fun dinner with friends. I would pick a fun night out over a cozy night in.').slot).toBe('evening');
  });
});

describe('their own words quoted back', () => {
  const ctx: LineContext = {
    toneRules: { bannedPhrases: [], maxWordsExclusive: 60 as const, gatedMaxWords: 60 as const },
    allowedNumbers: [],
    names: [],
    theirWords: "Dinner with friends where nobody checks their phone.",
  };
  it('lets "their" through inside three or more of their words', () => {
    expect(checkLine('A long dinner where nobody checks their phone, just as you like it.', ctx)).toEqual([]);
  });
  it('still flags writing about the reader, but never "they" about other people', () => {
    expect(checkLine('The person loves a long dinner with friends.', ctx).map((i) => i.code)).toContain('TONE');
    expect(checkLine('Your crew had the best night, and their Saturday starts slow too.', ctx)).toEqual([]);
  });
});

describe('rest is lighter', () => {
  it('does not count sleeping in as a fuller day', () => {
    const sleepIn = { ...part('s', ['sat']), title: 'Sleep in', source: { kind: 'engine' as const, rule: 'slow-start' }, minutes: 60 };
    expect(plannedMinutes([part('a', ['sat']), sleepIn])).toBe(plannedMinutes([part('a', ['sat'])]));
  });
});
