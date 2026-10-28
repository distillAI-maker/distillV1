import { z } from 'zod';
import type { CatalogItemView, ToneRules } from '@distill/catalog';
import { checkLine, type LineContext, type PersonModel } from '@distill/engine/ritual';
import { aboutBlock, evidenceBlock, personBlock, safetyNotes, type ItemStandingNote } from './brief';
import { callJson, OPUS, type CallUsage, type ClaudeClient } from './call';
import { EVIDENCE, PROMPT_VERSIONS, REPLY_ABOUT, REPLY_JOB, voice, WHO } from './prompts';
import { obj, str } from './schema';

/** A reply to a message that changes no day: a question, a feeling, a stack change, or chat. */
export const PROMPT_VERSION = PROMPT_VERSIONS.reply;

export const REPLY_FALLBACK = 'Got it, thank you for telling me.';
/** Fixed and human-written: never generated. */
export const CRISIS_REPLY =
  "I'm really glad you told me. You deserve support from a person right now: in the US you can call or text 988, the Suicide & Crisis Lifeline, any time. If you're in danger, call 911. I'm here too.";
export const CLINICAL_REPLY =
  "That one's for your clinician, so I'll leave it with you and them. Nothing in your Ritual changes because of it.";

const out = z.object({ reply: z.string().max(900) }).strict();

/** A follow-up about one thing on their list: the card they asked from, or the thing they named. */
export interface ReplyAbout {
  readonly view: CatalogItemView;
  readonly name: string;
  readonly standing?: ItemStandingNote;
  /** Conditions they told us about in their own words: only these safety notes are raised. */
  readonly conditions: ReadonlySet<string>;
  /** Offer the swap: Distill suggested letting it go, they did, or the evidence is of a cost. */
  readonly offerSwap: boolean;
  /** With Claude off, answer in the catalog's reviewed words (a card they tapped or followed up on). */
  readonly fixed: boolean;
}

/** "A piece of fruit" reads on after a colon as "a piece of fruit"; "AG1" and "LED" stay as they are. */
const lowerFirst = (t: string) => (/^[A-Z](?![A-Z0-9])/.test(t) ? t[0]!.toLowerCase() + t.slice(1) : t);

/**
 * The answer to a "why?" with Claude off, in the catalog's reviewed words: the reason, a safety
 * note that applies to them, and the swap when there is one to offer. Null when Distill hasn't
 * looked into it.
 */
export function whyAnswer(a: ReplyAbout): string | null {
  const v = a.view;
  if (v.tier === 'U' || !v.evidenceSummary) return null;
  const out = [v.evidenceSummary.trim()];
  const note = safetyNotes(v, a.conditions)[0];
  if (note) out.push(note.trim());
  if (a.offerSwap && v.fitsInstead) out.push(`One swap, if you'd like it: ${lowerFirst(v.fitsInstead.trim())}`);
  return out.join(' ');
}

export async function replyTo(
  client: ClaudeClient | null,
  input: {
    person: PersonModel;
    message: string;
    about?: CatalogItemView;
    /** A follow-up about one thing: a fuller answer, with what the research found and the swap. */
    followUp?: ReplyAbout;
    /** It touches medical care: warm, plainly theirs and their clinician's, no advice of Distill's own. */
    clinical?: boolean;
    toneRules: Pick<ToneRules, 'bannedPhrases' | 'maxWordsExclusive' | 'gatedMaxWords'>;
    lineContext: Omit<LineContext, 'toneRules' | 'maxWords'>;
    today: string;
  },
): Promise<{ reply: string; from: 'claude' | 'fallback'; usage?: CallUsage; problems?: readonly string[] }> {
  const f = input.followUp;
  const fallback = input.clinical ? CLINICAL_REPLY : (f?.fixed && whyAnswer(f)) || REPLY_FALLBACK;
  if (!client) return { reply: fallback, from: 'fallback' };
  const ctx: LineContext = { ...input.lineContext, toneRules: input.toneRules, maxWords: f ? 90 : 50 };
  const result = await callJson(client, {
    step: 'reply',
    model: OPUS,
    effort: 'low',
    system: [WHO, voice(input.toneRules.bannedPhrases), REPLY_JOB, EVIDENCE, REPLY_ABOUT],
    content: [
      personBlock(input.person, { today: input.today }),
      f ? aboutBlock(f.view, f) : input.about ? evidenceBlock(input.about) : '',
      input.clinical
        ? '<care>This message asks something only their clinician can answer. Be warm and specific to them, say plainly that this one is for their clinician, give no medical advice of your own, and say nothing in their Ritual changes because of it.</care>'
        : '',
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
  if (!result.ok) return { reply: fallback, from: 'fallback', ...(result.usage ? { usage: result.usage } : {}), problems: result.problems ?? [result.reason] };
  return { reply: result.data.reply.trim(), from: 'claude', usage: result.usage };
}
