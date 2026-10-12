import type { PictureKind, Progress } from './progress/types';

/**
 * Today's thought, behind the painting on Your Standard: a line from the ancients about a part of
 * who they are, what it means in plain words, and (written by Claude, lib/ai/companion.ts) one line
 * on how it touches their own life, so the painting is never a random picture.
 * Every saying is quoted word for word from a public-domain translation (named in `source`).
 */
export interface Saying {
  text: string;
  /** What it means, in plain words: the old translations are hard to read. */
  plain: string;
  who: string;
  source: string;
  /** The parts of "What we've learned about you" it speaks to. */
  about: readonly PictureKind[];
}

export const sayings: readonly Saying[] = [
  {
    text: 'It is not the man who has too little, but the man who craves more, that is poor.',
    plain: 'Wanting more, not having less, is what makes us feel poor.',
    who: 'Seneca',
    source: 'Letters to Lucilius, tr. Richard M. Gummere',
    about: ['theirs'],
  },
  {
    text: 'Nothing, Lucilius, is ours, except time.',
    plain: 'Your time is the one thing that is truly yours.',
    who: 'Seneca',
    source: 'Letters to Lucilius, tr. Richard M. Gummere',
    about: ['joy', 'theirs'],
  },
  {
    text: 'Of all the means which are procured by wisdom to ensure happiness throughout the whole of life, by far the most important is the acquisition of friends.',
    plain: 'Of everything that makes a good life, friends matter most.',
    who: 'Epicurus',
    source: 'Principal Doctrines, tr. R. D. Hicks',
    about: ['people'],
  },
  {
    text: 'Men seek retreats for themselves, houses in the country, sea-shores, and mountains … it is in thy power whenever thou shalt choose to retire into thyself.',
    plain: "You don't need a getaway to find calm. You can go inward, anywhere.",
    who: 'Marcus Aurelius',
    source: 'Meditations, tr. George Long',
    about: ['joy'],
  },
  {
    text: 'Such as are thy habitual thoughts, such also will be the character of thy mind; for the soul is dyed by the thoughts.',
    plain: 'What you think about every day becomes who you are.',
    who: 'Marcus Aurelius',
    source: 'Meditations, tr. George Long',
    about: ['toward', 'theirs'],
  },
  {
    text: 'The unexamined life is not worth living.',
    plain: 'A life is worth more when you stop to look at it.',
    who: 'Socrates',
    source: "Plato's Apology, tr. Benjamin Jowett",
    about: ['toward'],
  },
  {
    text: 'Men are disturbed not by things, but by the views which they take of things.',
    plain: "It's rarely the thing that upsets us. It's the story we tell about it.",
    who: 'Epictetus',
    source: 'Enchiridion, tr. T. W. Higginson',
    about: ['theirs', 'joy'],
  },
  {
    text: 'There are things which are within our power, and there are things which are beyond our power.',
    plain: 'Put your energy into what you can shape, and let the rest go.',
    who: 'Epictetus',
    source: 'Enchiridion, tr. T. W. Higginson',
    about: ['toward'],
  },
  {
    text: 'It is not one swallow or one fine day that makes a spring, so it is not one day or a short time that makes a man blessed and happy.',
    plain: 'A good life is built over time, not in a day.',
    who: 'Aristotle',
    source: 'Nicomachean Ethics, tr. D. P. Chase',
    about: ['theirs', 'toward'],
  },
];

export interface Thought {
  saying: Saying;
}

/**
 * Today's saying for this person: a part of their picture in turn, and a saying about that part.
 * With no picture yet, the sayings simply take turns.
 */
export function thoughtFor(date: string, picture: Progress['picture']): Thought {
  const day = Math.floor(Date.parse(`${date}T12:00:00Z`) / 86_400_000);
  const at = <T>(list: readonly T[], n: number) => list[((n % list.length) + list.length) % list.length] as T;
  const lines = picture?.lines ?? [];
  const kinds = (['joy', 'people', 'toward', 'theirs'] as const).filter((k) =>
    lines.some((l) => l.kind === k),
  );
  if (!kinds.length) return { saying: at(sayings, day) };
  const kind = at(kinds, day);
  const fits = sayings.filter((s) => s.about.includes(kind));
  return { saying: at(fits, Math.floor(day / kinds.length)) };
}
