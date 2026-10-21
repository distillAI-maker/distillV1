import { z } from 'zod';
import { daysBetween } from './time.js';
import { areaSchema, aweSchema, type PersonModel, type Season } from './types.js';

/**
 * The fifth job: once the Ritual feels like theirs, Distill asks what they want to try and offers up
 * to three real things that fit. We ask; we never tell. Only ideas the founder certified are shown:
 * an "unverified" label doesn't stop someone turning up to a run club that doesn't exist, so ideas
 * Claude generates are saved for review instead of shown.
 */

export const ideaSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    title: z.string().min(1).max(120),
    kind: z.enum(['region', 'place', 'class', 'skill', 'scene', 'trip', 'book', 'community']),
    area: areaSchema,
    city: z.string().min(1).max(80),
    neighbourhood: z.string().max(80).optional(),
    awe: aweSchema.optional(),
    social: z.enum(['solo', 'pair', 'group']),
    cost: z.enum(['free', 'low', 'medium', 'high']),
    when: z.string().max(200),
    line: z.string().min(1).max(240),
    fitsWhen: z.string().min(1).max(240),
    url: z.string().url(),
    verifiedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    partner: z.boolean(),
    certified: z.boolean(),
  })
  .strict();
export type Idea = z.infer<typeof ideaSchema>;

export const exploreBankSchema = z
  .object({ version: z.literal(1), ideas: z.array(ideaSchema) })
  .strict();
export type ExploreBank = z.infer<typeof exploreBankSchema>;

export interface ExploreGateInput {
  readonly today: string;
  /** When their first Ritual was accepted. */
  readonly ritualAcceptedOn?: string;
  /** Clears they said yes to. */
  readonly clearsAccepted: number;
  /** Clears still waiting for an answer. */
  readonly clearsOpen: number;
  /** Whether any clear was ever proposed. */
  readonly clearsEver: number;
  readonly season: Season;
  readonly threadOpen: boolean;
}

/**
 * The time is right when the Ritual has been theirs for a week, room has been made, their season
 * has space for it, and no other explore thread is open. Someone whose stack was already clean
 * has nothing to clear, so after the first week that counts as room made.
 */
export function exploreGate(input: ExploreGateInput): { open: boolean; why: string } {
  if (!input.ritualAcceptedOn) return { open: false, why: 'no Ritual yet' };
  if (daysBetween(input.ritualAcceptedOn, input.today) < 7) return { open: false, why: 'Ritual is new' };
  const roomMade = input.clearsAccepted > 0 || (input.clearsEver === 0 && input.clearsOpen === 0);
  if (!roomMade) return { open: false, why: 'nothing has made room yet' };
  if (input.season === 'busy' || input.season === 'unwell') return { open: false, why: `season is ${input.season}` };
  if (input.threadOpen) return { open: false, why: 'a thread is already open' };
  return { open: true, why: 'room made' };
}

const words = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2),
  );

/**
 * Bank ideas that could fit what they want, best first: certified only, never one they declined,
 * near them, in the shape of what they love. Claude picks at most three of these and says why.
 */
export function ideasFor(
  bank: ExploreBank,
  ctx: { person: PersonModel; want: string; region?: string; declined: readonly string[]; limit?: number },
): Idea[] {
  const want = words(ctx.want);
  const region = (ctx.region ?? '').toLowerCase();
  const people = ctx.person.people.length > 0;
  const scored = bank.ideas
    .filter((i) => i.certified && !ctx.declined.includes(i.id))
    .map((i) => {
      const text = words(`${i.title} ${i.line} ${i.fitsWhen} ${i.kind} ${i.area}`);
      let score = 0;
      for (const w of want) if (text.has(w)) score += 2;
      if (region && (`${i.city} ${i.neighbourhood ?? ''}`.toLowerCase().includes(region) || i.city === 'anywhere'))
        score += 3;
      if (i.awe && ctx.person.identity.awe.includes(i.awe)) score += 2;
      if (people && i.social !== 'solo') score += 1;
      return { i, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.i.id.localeCompare(b.i.id));
  return scored.slice(0, ctx.limit ?? 12).map(({ i }) => i);
}
