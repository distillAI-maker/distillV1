import { z } from 'zod';
import type { CatalogView } from '@distill/catalog';
import {
  applyPersonOps,
  conditionSchema,
  personOpSchema,
  type PersonModel,
  type PersonPatchResult,
  type StackItemLike,
} from '@distill/engine/ritual';
import { callJson, OPUS, type CallUsage, type ClaudeClient } from './call';
import { itemsBlock, personBlock } from './brief';
import { PROMPT_VERSIONS, UPDATE_PERSON_JOB, voice, WHO } from './prompts';
import { arr, bool, dropNulls, en, nul, obj, str } from './schema';

/** Step 2: what a note, answer or message teaches about who they are (Opus 5.5, low). */
export const PROMPT_VERSION = PROMPT_VERSIONS.updatePerson;

const out = z.object({ ops: z.array(personOpSchema).max(20) }).strict();
const UPDATE_SCHEMA = obj({
  ops: arr({
    anyOf: [
      obj({ op: en(['attachment']), stackItemId: str(), attachment: en(['loved', 'neutral', 'borrowed', 'unknown']), basis: en(['explicit', 'implied']), quote: str() }),
      obj({ op: en(['person']), name: str(), relation: nul(str()), what: str(), quote: str() }),
      obj({ op: en(['place']), name: str(), what: str(), quote: str() }),
      obj({ op: en(['toward']), text: str(), hard: bool(), by: nul(str('YYYY-MM or YYYY-MM-DD')), quote: str() }),
      obj({ op: en(['atBest']), text: str(), quote: str() }),
      obj({ op: en(['awe']), awe: en(['nature', 'music', 'visual', 'collective', 'moral', 'spiritual', 'life', 'epiphany']), quote: str() }),
      obj({ op: en(['season']), season: en(['steady', 'busy', 'stressed', 'travelling', 'energised', 'low', 'unwell']), until: nul(str('YYYY-MM-DD')), quote: str() }),
      obj({ op: en(['condition']), condition: en(conditionSchema.options), quote: str() }),
      obj({ op: en(['feels']), stackItemId: str(), feels: bool(), quote: str() }),
      obj({ op: en(['occasion']), stackItemId: str(), occasion: str(), quote: str() }),
    ],
  }),
});

export interface UpdatePersonResult extends PersonPatchResult {
  readonly usage?: CallUsage;
  readonly status: 'ok' | 'off' | 'failed';
}

/**
 * Asks Claude what their words teach, then lets code decide what sticks (quotes must be theirs,
 * "theirs" is final, loved things are never downgraded without asking). With Claude off, nothing
 * changes: their words are still saved where they wrote them.
 */
export async function updatePerson(
  client: ClaudeClient | null,
  input: {
    person: PersonModel;
    stack: readonly StackItemLike[];
    catalog: CatalogView;
    banned: readonly string[];
    kind: 'note' | 'answer' | 'message' | 'onboarding';
    text: string;
    question?: string;
    stackItemId?: string;
    today: string;
    at: string;
  },
): Promise<UpdatePersonResult> {
  const unchanged = { person: input.person, applied: [], dropped: [], ask: [] };
  if (!client) return { ...unchanged, status: 'off' };
  const what =
    input.kind === 'onboarding'
      ? `They just finished onboarding. Read everything they've told us: <person> (their ideal day and answers) and every note in <items>. Return everything it teaches, for every item their words speak to.\n<everything>${input.text.slice(0, 8000)}</everything>`
      : input.kind === 'note'
      ? `They wrote this note about item ${input.stackItemId}:\n<notes>${input.text.slice(0, 4000)}</notes>`
      : input.kind === 'answer'
        ? `They answered the daily question "${input.question ?? ''}":\n<answer>${input.text.slice(0, 2000)}</answer>`
        : `They sent this message:\n<message>${input.text.slice(0, 2000)}</message>`;
  const content = [
    personBlock(input.person, { today: input.today }),
    itemsBlock(input.person, input.stack, input.catalog),
    what,
  ].join('\n');
  const result = await callJson(client, {
    step: 'update-person',
    model: OPUS,
    effort: 'low',
    system: [WHO, voice(input.banned), UPDATE_PERSON_JOB],
    content,
    jsonSchema: UPDATE_SCHEMA,
    parse: z.preprocess(dropNulls, out) as unknown as z.ZodType<z.infer<typeof out>>,
    timeoutMs: input.kind === 'onboarding' ? 40000 : 15000,
    maxTokens: input.kind === 'onboarding' ? 6000 : 3000,
  });
  if (!result.ok) return { ...unchanged, status: 'failed', ...(result.usage ? { usage: result.usage } : {}) };
  const patch = applyPersonOps(input.person, result.data.ops, input.text, {
    today: input.today,
    at: input.at,
    from: input.kind,
  });
  return { ...patch, usage: result.usage, status: 'ok' };
}
