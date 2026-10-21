import { z } from 'zod';
import type { ToneRules } from '@distill/catalog';
import { checkLine, type Idea, type LineContext, type PersonModel } from '@distill/engine/ritual';
import { personBlock } from './brief';
import { callJson, OPUS, type CallUsage, type ClaudeClient } from './call';
import { EXPLORE_JOB, PROMPT_VERSIONS, voice, WHO } from './prompts';
import { arr, obj, str } from './schema';

/**
 * Step 9: explore (Opus 5.5, low). They said what they want to try; Claude picks up to three
 * certified ideas that fit and says why. Ideas Claude thinks of that aren't in the bank are saved
 * for someone to check, never shown.
 */
export const PROMPT_VERSION = PROMPT_VERSIONS.explore;

const out = z
  .object({
    reply: z.string().max(600),
    options: z.array(z.object({ ideaId: z.string(), why: z.string().max(240) }).strict()).max(3),
    to_review: z.array(z.object({ name: z.string().max(120), where: z.string().max(120), why: z.string().max(240) }).strict()).max(3),
  })
  .strict();
const SCHEMA = obj({
  reply: str(),
  options: arr(obj({ ideaId: str(), why: str() })),
  to_review: arr(obj({ name: str(), where: str(), why: str() })),
});

export interface ExploreResult {
  readonly reply: string;
  readonly options: readonly { idea: Idea; why: string }[];
  readonly toReview: readonly { name: string; where: string; why: string }[];
  readonly from: 'claude' | 'fallback';
  readonly usage?: CallUsage;
}

export const EXPLORE_FALLBACK = "Love that. Let me look around for something that fits, and I'll come back with a few options.";

export async function explore(
  client: ClaudeClient | null,
  input: {
    person: PersonModel;
    want: string;
    region?: string;
    ideas: readonly Idea[];
    toneRules: Pick<ToneRules, 'bannedPhrases' | 'maxWordsExclusive' | 'gatedMaxWords'>;
    lineContext: Omit<LineContext, 'toneRules' | 'maxWords'>;
    today: string;
  },
): Promise<ExploreResult> {
  const fallback: ExploreResult = { reply: EXPLORE_FALLBACK, options: [], toReview: [], from: 'fallback' };
  if (!client) return fallback;
  const byId = new Map(input.ideas.map((i) => [i.id, i]));
  const ctx: LineContext = {
    ...input.lineContext,
    names: [...input.lineContext.names, ...input.ideas.flatMap((i) => [i.title, i.city, i.neighbourhood ?? ''])],
    toneRules: input.toneRules,
    maxWords: 50,
  };
  const content = [
    personBlock(input.person, { today: input.today }),
    `<message>What I've been wanting to try: ${input.want.slice(0, 600)}${input.region ? ` (around ${input.region.slice(0, 80)})` : ''}</message>`,
    '<ideas>',
    ...input.ideas.map(
      (i) => `- ${i.id}: ${i.title} (${i.kind}, ${i.city}${i.neighbourhood ? `, ${i.neighbourhood}` : ''}; ${i.social}; ${i.cost}; ${i.when}). ${i.line} Fits: ${i.fitsWhen}${i.partner ? ' [partner]' : ''}`,
    ),
    '</ideas>',
  ].join('\n');
  const result = await callJson(client, {
    step: 'explore',
    model: OPUS,
    effort: 'low',
    system: [WHO, voice(input.toneRules.bannedPhrases), EXPLORE_JOB],
    content,
    jsonSchema: SCHEMA,
    parse: out,
    check: (data) => [
      ...data.options.filter((o) => !byId.has(o.ideaId)).map((o) => `${o.ideaId} isn't in <ideas>`),
      ...checkLine(data.reply, ctx).map((i) => `reply: ${i.code} ${i.detail}`),
      ...data.options.flatMap((o) => checkLine(o.why, { ...ctx, maxWords: 25 }).map((i) => `why for ${o.ideaId}: ${i.code} ${i.detail}`)),
    ],
    timeoutMs: 20000,
    maxTokens: 3000,
  });
  if (!result.ok) return { ...fallback, ...(result.usage ? { usage: result.usage } : {}) };
  return {
    reply: result.data.reply.trim(),
    options: result.data.options.flatMap((o) => (byId.has(o.ideaId) ? [{ idea: byId.get(o.ideaId)!, why: o.why.trim() }] : [])),
    toReview: result.data.to_review,
    from: 'claude',
    usage: result.usage,
  };
}
