import { describe, expect, it } from 'vitest';
import { portraitOf } from './standard-home';

describe('portraitOf', () => {
  it('drops the lead-in and keeps what a good day holds, in their words', () => {
    expect(
      portraitOf(
        "A good morning, for me, looks like a walk before I touch my phone, Pilates with people I like, and Friday dinners where I'm actually there. What gets in the way is that I keep adding things because someone online swears by them.",
      ),
    ).toEqual([
      'A walk before I touch my phone.',
      'Pilates with people I like.',
      "Friday dinners where I'm actually there.",
    ]);
  });
  it('keeps short sentences whole and leaves out what gets in the way', () => {
    expect(
      portraitOf(
        'I start the day with a morning meditation in the sunlight. But work gets in the way.',
      ),
    ).toEqual(['I start the day with a morning meditation in the sunlight.']);
  });
  it('returns nothing for an empty page', () => {
    expect(portraitOf('')).toEqual([]);
  });
});
