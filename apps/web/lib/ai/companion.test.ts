import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import { companionVoice, readRitual, RITUAL_SYSTEM, systemFor } from './companion';
import type { PersonContext } from './person';

/** Answers every request with one scripted reply. */
const fake = (reply: unknown) =>
  ({
    beta: {
      messages: {
        create: async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(reply) }] }),
      },
    },
  }) as unknown as Anthropic;

const person: PersonContext = {
  name: 'Ana',
  idealDay: 'Slow Saturday mornings, then coffee with Sam at 10.',
  goals: [],
  rituals: [],
  answers: [],
  picture: [],
  removed: [],
};
const ritual = { name: 'Saturday coffee', notes: ['Coffee with Sam at 10, the same corner table every week.'] };

describe('the companion voice', () => {
  it('stays on today’s voice until the team switches it after the A/B', () => {
    expect(companionVoice()).toBe(process.env.COMPANION_VOICE === 'v2' ? 'v2' : 'v1');
    expect(systemFor('ritual', 'v1')).toBe(RITUAL_SYSTEM);
    expect(systemFor('ritual', 'v2')).toMatch(/One to three full sentences, 40 words at most/);
    expect(systemFor('ritual', 'v2')).toMatch(/a friend who is deep into wellness/);
  });
  it('v1 drops any line with a figure; v2 lets a line repeat their own numbers and names', async () => {
    const line = 'Coffee with Sam at 10 is the hour of your week that belongs to nobody else, and it shows.';
    expect(await readRitual(fake({ line, thought: '' }), { person, ritual }, 'v1')).toBeNull();
    expect(await readRitual(fake({ line, thought: '' }), { person, ritual }, 'v2')).toEqual({ line });
  });
  it('v2 still drops numbers that are not theirs, and people they never mentioned', async () => {
    expect(await readRitual(fake({ line: 'Coffee with Sam at 11 is yours.', thought: '' }), { person, ritual }, 'v2')).toBeNull();
    expect(await readRitual(fake({ line: 'Coffee with Priya is yours.', thought: '' }), { person, ritual }, 'v2')).toBeNull();
  });
});
