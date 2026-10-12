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
  it('takes turns before we know them, with no line of theirs', () => {
    const first = thoughtFor('2026-10-12', undefined);
    expect(first.mine).toBeUndefined();
    expect(thoughtFor('2026-10-13', undefined).saying).not.toBe(first.saying);
  });

  it('pairs a saying about a part of their picture with one of their own lines from it', () => {
    const picture = {
      lines: [line('people', 'Leah, and the talk after class.'), line('joy', 'Mornings on the balcony.')],
      removed: [],
      updatedAt: '',
    };
    for (const date of ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15']) {
      const { saying, mine } = thoughtFor(date, picture);
      const kind = picture.lines.find((l) => l.text === mine)?.kind;
      expect(kind && saying.about).toContain(kind);
    }
  });

  it('every saying names who said it and where it is from', () => {
    for (const s of sayings) expect(s.who && s.source && s.text.length <= 200).toBeTruthy();
  });
});
