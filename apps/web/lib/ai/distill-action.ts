'use server';

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { pictureKindSchema } from '../progress/types';
import { readPerson, readRitual, type PersonReading, type RitualReading } from './companion';
import type { PersonContext } from './person';

/**
 * The companion's two server actions (lib/ai/companion.ts holds the prompts). No key or a failed
 * call means nothing changes: their own words stand.
 */

const text = (n: number) => z.string().max(n);
const personSchema = z.object({
  name: text(80),
  idealDay: text(4000),
  goals: z.array(text(80)).max(12),
  rituals: z
    .array(
      z.object({
        name: text(120),
        kind: text(80).optional(),
        theirs: z.boolean(),
        letGo: z.boolean(),
        essence: text(600).optional(),
        notes: z.array(text(4000)).max(200),
      }),
    )
    .max(80),
  answers: z.array(z.object({ q: text(200), a: text(2000) })).max(30),
  picture: z
    .array(z.object({ kind: pictureKindSchema, text: text(200), theirs: z.boolean() }))
    .max(40),
  removed: z.array(text(200)).max(100),
}) satisfies z.ZodType<PersonContext>;

const ritualSchema = z.object({
  person: personSchema,
  ritual: z.object({
    name: text(120),
    kind: text(80).optional(),
    itemKey: text(120).nullable().optional(),
    notes: z.array(text(4000)).max(200),
    declined: z.array(text(300)).max(30).optional(),
  }),
});

export type Off = { status: 'off' } | { status: 'failed' };

function failed(error: unknown): Off {
  if (error instanceof Anthropic.APIError) console.error(`companion: API error ${error.status}`);
  else console.error('companion: request failed');
  return { status: 'failed' };
}

/** What a ritual gives them, read from their notes and who they are. */
export async function distillNotes(
  input: z.input<typeof ritualSchema>,
): Promise<({ status: 'ok' } & RitualReading) | Off> {
  if (!process.env.ANTHROPIC_API_KEY) return { status: 'off' };
  const parsed = ritualSchema.safeParse(input);
  if (!parsed.success) return { status: 'failed' };
  try {
    const reading = await readRitual(new Anthropic(), parsed.data);
    return reading ? { status: 'ok', ...reading } : { status: 'failed' };
  } catch (error) {
    return failed(error);
  }
}

/** Claude's lines for "What we've learned about you", from everything they have shared. */
export async function learnAbout(
  input: PersonContext,
): Promise<({ status: 'ok' } & PersonReading) | Off> {
  if (!process.env.ANTHROPIC_API_KEY) return { status: 'off' };
  const parsed = personSchema.safeParse(input);
  if (!parsed.success) return { status: 'failed' };
  try {
    const reading = await readPerson(new Anthropic(), parsed.data);
    return reading ? { status: 'ok', ...reading } : { status: 'failed' };
  } catch (error) {
    return failed(error);
  }
}
