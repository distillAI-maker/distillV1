import { describe, expect, it } from 'vitest';
import type { PictureLine } from './progress/types';
import { sayings, thoughtFor } from './wisdom';

const line = (kind: PictureLine['kind'], text: string): PictureLine => ({
  id: text,
  kind,
  text,
  by: 'distill',
  at: '',
});

describe("today's thought", () => {
  it('takes turns before we know them', () => {
    expect(thoughtFor('2026-10-13', undefined).saying).not.toBe(
      thoughtFor('2026-10-12', undefined).saying,
    );
  });

  it('picks a saying about a part of their picture', () => {
    const picture = {
      lines: [line('people', 'Leah, and the talk after class.')],
      removed: [],
      updatedAt: '',
    };
    for (const date of ['2026-10-12', '2026-10-13', '2026-10-14'])
      expect(thoughtFor(date, picture).saying.about).toContain('people');
  });

  it('every saying says what it means in plain words, and who said it', () => {
    for (const s of sayings) {
      expect(s.who && s.source).toBeTruthy();
      expect(s.plain.length).toBeLessThan(90);
    }
  });
});
