import type { PictureKind, Progress } from './progress/types';

/**
 * Today's thought, behind the painting on Your Standard: a line from the ancients that speaks to
 * who they are, with one of their own lines beside it, so the painting is never a random picture.
 * Every saying is quoted word for word from a public-domain translation (named in `source`).
 */
export interface Saying {
  text: string;
  who: string;
  source: string;
  /** The parts of "What we've learned about you" it speaks to. */
  about: readonly PictureKind[];
}

export const sayings: readonly Saying[] = [
  {
    text: 'Know thyself.',
    who: 'Inscribed at Delphi',
    source: 'Temple of Apollo',
    // The first thought, before we know them; after that, a saying about a part of who they are.
    about: [],
  },
  {
    text: 'It is not the man who has too little, but the man who craves more, that is poor.',
    who: 'Seneca',
    source: 'Letters to Lucilius, tr. Richard M. Gummere',
    about: ['theirs'],
  },
  {
    text: 'Nothing, Lucilius, is ours, except time.',
    who: 'Seneca',
    source: 'Letters to Lucilius, tr. Richard M. Gummere',
    about: ['joy', 'theirs'],
  },
  {
    text: 'If you would be loved, love.',
    who: 'Hecato, as quoted by Seneca',
    source: 'Letters to Lucilius, tr. Richard M. Gummere',
    about: ['people'],
  },
  {
    text: 'Of all the means which are procured by wisdom to ensure happiness throughout the whole of life, by far the most important is the acquisition of friends.',
    who: 'Epicurus',
    source: 'Principal Doctrines, tr. R. D. Hicks',
    about: ['people'],
  },
  {
    text: 'Men seek retreats for themselves, houses in the country, sea-shores, and mountains … it is in thy power whenever thou shalt choose to retire into thyself.',
    who: 'Marcus Aurelius',
    source: 'Meditations, tr. George Long',
    about: ['joy'],
  },
  {
    text: 'Such as are thy habitual thoughts, such also will be the character of thy mind; for the soul is dyed by the thoughts.',
    who: 'Marcus Aurelius',
    source: 'Meditations, tr. George Long',
    about: ['toward', 'theirs'],
  },
  {
    text: 'The unexamined life is not worth living.',
    who: 'Socrates',
    source: "Plato's Apology, tr. Benjamin Jowett",
    about: ['toward'],
  },
  {
    text: 'Men are disturbed not by things, but by the views which they take of things.',
    who: 'Epictetus',
    source: 'Enchiridion, tr. T. W. Higginson',
    about: ['theirs', 'joy'],
  },
  {
    text: 'There are things which are within our power, and there are things which are beyond our power.',
    who: 'Epictetus',
    source: 'Enchiridion, tr. T. W. Higginson',
    about: ['toward'],
  },
  {
    text: 'It is not one swallow or one fine day that makes a spring, so it is not one day or a short time that makes a man blessed and happy.',
    who: 'Aristotle',
    source: 'Nicomachean Ethics, tr. D. P. Chase',
    about: ['theirs', 'toward'],
  },
];

export interface Thought {
  saying: Saying;
  /** One of their own lines from the same part of their picture, when there is one. */
  mine?: string;
}

/**
 * Today's thought for this person: a part of their picture in turn, a saying about that part, and
 * one of their lines from it. With no picture yet, the sayings simply take turns.
 */
export function thoughtFor(date: string, picture: Progress['picture']): Thought {
  const day = Math.floor(Date.parse(`${date}T12:00:00Z`) / 86_400_000);
  const at = <T>(list: readonly T[], n: number) => list[((n % list.length) + list.length) % list.length] as T;
  const lines = picture?.lines ?? [];
  const kinds = (['joy', 'people', 'toward', 'theirs'] as const).filter((k) =>
    lines.some((l) => l.kind === k),
  );
  if (!kinds.length) return { saying: sayings[0] as Saying };
  const kind = at(kinds, day);
  const fits = sayings.filter((s) => s.about.includes(kind));
  const mine = lines.filter((l) => l.kind === kind);
  return {
    saying: at(fits, Math.floor(day / kinds.length)),
    mine: at(mine, Math.floor(day / kinds.length)).text,
  };
}
