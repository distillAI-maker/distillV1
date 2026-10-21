import { z } from 'zod';
import type { CatalogItemView, ToneRules } from '@distill/catalog';
import { checkLine, type LineContext, type PersonModel } from '@distill/engine/ritual';
import { evidenceBlock, personBlock } from './brief';
import { callJson, OPUS, type CallUsage, type ClaudeClient } from './call';
import { EVIDENCE, PROMPT_VERSIONS, REPLY_JOB, voice, WHO } from './prompts';
import { obj, str } from './schema';

/** A reply to a message that changes no day: a question, a feeling, a stack change, or chat. */
export const PROMPT_VERSION = PROMPT_VERSIONS.reply;

export const REPLY_FALLBACK = 'Got it, thank you for telling me.';
/** Fixed and human-written: never generated. */
export const CRISIS_REPLY =
  "I'm really glad you told me. You deserve support from a person right now: in the US you can call or text 988, the Suicide & Crisis Lifeline, any time. If you're in danger, call 911. I'm here too.";
export const CLINICAL_REPLY =
  "That one's for your clinician, so I'll leave it with you and them. Nothing in your Ritual changes because of it.";

const out = z.object({ reply: z.string().max(600) }).strict();

export async function replyTo(
  client: ClaudeClient | null,
  input: {
    person: PersonModel;
    message: string;
    about?: CatalogItemView;
    toneRules: Pick<ToneRules, 'bannedPhrases' | 'maxWordsExclusive' | 'gatedMaxWords'>;
    lineContext: Omit<LineContext, 'toneRules' | 'maxWords'>;
    today: string;
  },
): Promise<{ reply: string; from: 'claude' | 'fallback'; usage?: CallUsage }> {
  if (!client) return { reply: REPLY_FALLBACK, from: 'fallback' };
  const ctx: LineContext = { ...input.lineContext, toneRules: input.toneRules, maxWords: 50 };
  const result = await callJson(client, {
    step: 'reply',
    model: OPUS,
    effort: 'low',
    system: [WHO, voice(input.toneRules.bannedPhrases), REPLY_JOB, EVIDENCE],
    content: [
      personBlock(input.person, { today: input.today }),
      input.about ? evidenceBlock(input.about) : '',
      `<message>${input.message.slice(0, 2000)}</message>`,
    ]
      .filter(Boolean)
      .join('\n'),
    jsonSchema: obj({ reply: str() }),
    parse: out,
    check: (data) => checkLine(data.reply, ctx).map((i) => `reply: ${i.code} ${i.detail}`),
    timeoutMs: 12000,
    maxTokens: 1500,
  });
  if (!result.ok) return { reply: REPLY_FALLBACK, from: 'fallback', ...(result.usage ? { usage: result.usage } : {}) };
  return { reply: result.data.reply.trim(), from: 'claude', usage: result.usage };
}
