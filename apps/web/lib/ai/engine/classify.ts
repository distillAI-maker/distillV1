import { z } from 'zod';
import {
  conditionSchema,
  momentSchema,
  seasonSchema,
  whenSchema,
  type PersonModel,
} from '@distill/engine/ritual';
import { callJson, HAIKU, type CallResult, type ClaudeClient } from './call';
import { CLASSIFY_EXAMPLES, CLASSIFY_JOB, PROMPT_VERSIONS, WHO } from './prompts';
import { arr, dropNulls, en, int, nul, obj, str } from './schema';
import { nowBlock } from './brief';

/** Step 1: read a message (Haiku 5.5, low). Nothing it writes is shown; code acts on it. */
export const PROMPT_VERSION = PROMPT_VERSIONS.classify;

export const classificationSchema = z
  .object({
    intent: z.enum(['context', 'plan', 'feeling', 'question', 'stack-change', 'chat']),
    trigger: z
      .object({
        kind: z.enum(['message', 'plan']),
        when: whenSchema,
        dates: z.array(z.string()).max(31),
        moments: z.array(momentSchema).max(4),
        durability: z.enum(['once', 'ongoing']),
        load: z.enum(['lighter', 'same', 'heavier']),
        mentions: z.object({ people: z.array(z.string()).max(10), places: z.array(z.string()).max(10) }).strict(),
      })
      .strict()
      .optional(),
    season: seasonSchema.exclude(['steady']).optional(),
    safety: z.enum(['ok', 'clinical', 'crisis']),
    condition: conditionSchema.optional(),
    stack: z.object({ action: z.enum(['started', 'stopped']), name: z.string().max(120) }).strict().optional(),
  })
  .strict();
export type Classification = z.infer<typeof classificationSchema>;

const relative = {
  anyOf: [
    obj({ kind: en(['today']) }),
    obj({ kind: en(['tonight']) }),
    obj({ kind: en(['tomorrow']) }),
    obj({ kind: en(['weekday']), day: en(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']), which: en(['this', 'next']) }),
    obj({ kind: en(['weekend']), which: en(['this', 'next']) }),
    obj({ kind: en(['week']), which: en(['this', 'next']) }),
    obj({ kind: en(['in-days']), n: int() }),
    obj({ kind: en(['date']), month: int(), day: int() }),
  ],
};
export const CLASSIFY_SCHEMA = obj({
  intent: en(['context', 'plan', 'feeling', 'question', 'stack-change', 'chat']),
  trigger: nul(
    obj({
      kind: en(['message', 'plan']),
      when: obj({ phrase: str(), start: relative, end: nul(relative) }),
      dates: arr(str('YYYY-MM-DD')),
      moments: arr(en(['morning', 'night', 'saturday', 'sunday'])),
      durability: en(['once', 'ongoing']),
      load: en(['lighter', 'same', 'heavier']),
      mentions: obj({ people: arr(str()), places: arr(str()) }),
    }),
  ),
  season: nul(en(['busy', 'stressed', 'travelling', 'energised', 'low', 'unwell'])),
  safety: en(['ok', 'clinical', 'crisis']),
  condition: nul(en(conditionSchema.options)),
  stack: nul(obj({ action: en(['started', 'stopped']), name: str() })),
});

/** A last line of defence that needs no model: words that always mean a person may be in danger. */
export const CRISIS_WORDS =
  /\b(kill myself|end my life|suicid\w*|want to die|don'?t want to (?:be alive|live)|hurt myself|self[- ]harm)\b/i;

export async function classifyMessage(
  client: ClaudeClient | null,
  input: { text: string; person: PersonModel; instant: string; today: string; minute: number; ritualTitles: readonly string[] },
): Promise<CallResult<Classification>> {
  const content = [
    nowBlock(input.instant, input.person.timeZone, input.today, input.minute),
    `<person>First name: ${input.person.name || 'unknown'}. People: ${input.person.people.map((p) => p.name).join(', ') || 'none named yet'}.</person>`,
    `<ritual>The next week includes: ${input.ritualTitles.slice(0, 30).join('; ') || 'nothing yet'}</ritual>`,
    `<message>${input.text.slice(0, 2000)}</message>`,
  ].join('\n');
  const result = await callJson(client, {
    step: 'classify',
    model: HAIKU,
    effort: 'low',
    system: [WHO, CLASSIFY_JOB, CLASSIFY_EXAMPLES],
    content,
    jsonSchema: CLASSIFY_SCHEMA,
    parse: z.preprocess(dropNulls, classificationSchema) as unknown as z.ZodType<Classification>,
    timeoutMs: 4000,
    maxTokens: 1200,
  });
  // Code never relies on the model alone to notice someone in danger.
  if (CRISIS_WORDS.test(input.text)) {
    const base: Classification = result.ok ? result.data : { intent: 'feeling', safety: 'crisis' };
    return { ok: true, data: { ...base, safety: 'crisis' }, usage: result.ok ? result.usage : result.usage ?? zeroUsage() };
  }
  return result;
}

function zeroUsage() {
  return { model: HAIKU, tokensIn: 0, tokensOut: 0, cacheRead: 0, cacheWrite: 0, costUsd: 0, latencyMs: 0, stopReason: null, attempts: 0 };
}
