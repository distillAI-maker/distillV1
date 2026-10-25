import { z } from 'zod';
import type { CatalogView } from '@distill/catalog';
import type { ToneRules } from '@distill/catalog';
import { checkLine, type DecisionDraft, type LineContext, type PersonModel } from '@distill/engine/ritual';
import { evidenceBlock, personBlock } from './brief';
import { callJson, OPUS, type CallUsage, type ClaudeClient } from './call';
import { EVIDENCE, PROMPT_VERSIONS, voice, WHO, WORD_DECISIONS_JOB } from './prompts';
import { arr, obj, str } from './schema';

/** Step 4: say each decision in the companion voice (Opus 5.5, low). */
export const PROMPT_VERSION = PROMPT_VERSIONS.wordDecisions;

const money = (n: number) => (n > 0 ? ` and keep the $${Math.round(n)} a month` : '');

/**
 * The line when Claude is off or a line fails its checks: plain, kind, and built only from facts.
 * A name holding a word Distill never says ("Detox tea") stays their label on the card, and the
 * line calls it "this one".
 */
export function fallbackLine(d: DecisionDraft, banned: readonly string[] = []): string {
  const unsayable = banned.some((b) => new RegExp(`(?<![\\p{L}])${b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'iu').test(d.name));
  const name = unsayable ? 'This one' : d.name;
  const lower = unsayable ? 'this one' : d.name;
  const c = d.context;
  switch (`${d.kind}:${d.reason}`) {
    case 'clear:BORROWED_WEAK':
      return `${name} came from someone else's routine, and nothing you've told us ties it to your days. Want to let it go${money(d.money)}?`;
    case 'clear:OVERLAP':
      return `${c.keeperName ?? 'Something you keep'} already does what ${lower} is for. Want to let ${lower} go${money(d.money)}?`;
    case 'clear:UNUSED':
      return `${name} hasn't had much use lately. Want to let it go${money(d.money)}?`;
    case 'clear:DOSE_BELOW_MIN':
      return `${name} is below the amount that's known to do anything. Want to let it go${money(d.money)}?`;
    case 'clear:FORM_NOT_ABSORBED':
      return unsayable
        ? `This one isn't in the form that's known to work. Want to let it go${money(d.money)}?`
        : `The kind of ${name} you have isn't the form that's known to work. Want to let it go${money(d.money)}?`;
    case 'clear:UNLOVED_HABIT':
      // Never presumes they don't enjoy it: the swap keeps the part they like.
      return c.fitsInstead
        ? `A swap for ${lower}: ${c.fitsInstead.replace(/^([A-Z])(?![A-Z0-9])/, (x) => x.toLowerCase())} You keep the part you like, with less of what it costs you. Want to try it?`
        : `${name} costs you a little more than it shows. Want to find a swap you'd enjoy as much?`;
    case 'clear:NOT_TRAINING':
      return `${name} is built for people who lift. If that isn't you right now, want to let it go${money(d.money)}?`;
    case 'clear:TOO_MANY_STEPS':
      return c.fitsInstead ? `${name} does the same job twice. ${c.fitsInstead} Want the simpler version?` : `${name} doubles up on a step you already have. Want one simpler routine?`;
    case 'keep:THEIRS':
      return `${name} is yours, and it stays exactly as it is.`;
    case 'keep:LOVED':
      return `${name} is part of what you love about your days. It stays.`;
    case 'keep:EVIDENCE_REGULAR':
      return `${name} is one of the well-founded things you do, even on days you can't feel it. Keep it.`;
    case 'keep:TRAINS':
      return `${name} is doing real work for your training, even when you can't feel it. Keep it.`;
    case 'curate:ANCHOR':
      return `${name} could be the anchor of your week. Want to build the rest around it?`;
    case 'curate:WORTH_A_LOOK':
      return `${name}: ${d.evidenceTier === 'N' ? 'no independent evidence' : 'little real evidence'}. Worth a look?`;
    case 'curate:ADJUST_DOSE':
      return `${name} is worth keeping, at the amount that's known to work. Want to see what that looks like?`;
    case 'curate:ADJUST_FORM':
      return `${name} is worth keeping, in the form that's known to work. Want to see which one?`;
    case 'refer:SEE_A_DERMATOLOGIST':
      return `With your skin the way it is, a dermatologist is the one to ask about ${lower}. Keep things simple until then.`;
    case 'refer:SEE_A_CLINICIAN':
      return `${name} is one for your clinician, and it stays between you and them.`;
    default:
      return `${name} stays part of your days.`;
  }
}

const out = z.object({ lines: z.array(z.object({ id: z.string(), line: z.string() }).strict()) }).strict();
const SCHEMA = obj({ lines: arr(obj({ id: str(), line: str() })) });

export interface WordedDecision extends DecisionDraft {
  readonly line: string;
  readonly lineFrom: 'claude' | 'fallback';
}

export async function wordDecisions(
  client: ClaudeClient | null,
  input: {
    person: PersonModel;
    decisions: readonly DecisionDraft[];
    catalog: CatalogView;
    toneRules: Pick<ToneRules, 'bannedPhrases' | 'maxWordsExclusive' | 'gatedMaxWords'>;
    lineContext: Omit<LineContext, 'toneRules' | 'maxWords'>;
    today: string;
  },
): Promise<{ decisions: WordedDecision[]; usage?: CallUsage; dropped: number }> {
  const ctx: LineContext = { ...input.lineContext, toneRules: input.toneRules, maxWords: 40 };
  const fallback = (d: DecisionDraft): WordedDecision => ({
    ...d,
    line: fallbackLine(d, input.toneRules.bannedPhrases),
    lineFrom: 'fallback',
  });
  if (!input.decisions.length) return { decisions: [], dropped: 0 };
  if (!client) return { decisions: input.decisions.map(fallback), dropped: 0 };
  const content = [
    personBlock(input.person, { today: input.today }),
    '<decisions>',
    ...input.decisions.map((d) => {
      const v = input.catalog.item(d.itemKey);
      return [
        `<decision id="${d.key}">`,
        `kind: ${d.kind}; reason: ${d.reason}`,
        `<item>${d.name}${v ? `, ${v.kind}` : ''}${d.money ? `, they pay $${Math.round(d.money)} a month` : ''}${d.context.keeperName ? `; another thing they keep that does the same job: ${d.context.keeperName}` : ''}${d.context.fitsInstead ? `; instead: ${d.context.fitsInstead}` : ''}</item>`,
        evidenceBlock(v),
        '</decision>',
      ].join('\n');
    }),
    '</decisions>',
  ].join('\n');
  const wanted = new Set(input.decisions.map((d) => d.key));
  const result = await callJson(client, {
    step: 'word-decisions',
    model: OPUS,
    effort: 'low',
    system: [WHO, voice(input.toneRules.bannedPhrases), WORD_DECISIONS_JOB, EVIDENCE],
    content,
    jsonSchema: SCHEMA,
    parse: out,
    check: (data) =>
      data.lines.flatMap((l) =>
        wanted.has(l.id) ? checkLine(l.line, ctx).map((i) => `decision ${l.id}: ${i.code} ${i.detail}`) : [],
      ),
    timeoutMs: 20000,
    maxTokens: 4000,
  });
  let dropped = 0;
  const lines = new Map<string, string>();
  if (result.ok) for (const l of result.data.lines) if (wanted.has(l.id)) lines.set(l.id, l.line.trim());
  const decisions = input.decisions.map((d): WordedDecision => {
    const line = lines.get(d.key);
    if (line && checkLine(line, ctx).length === 0) return { ...d, line, lineFrom: 'claude' };
    if (line) dropped++;
    return fallback(d);
  });
  return { decisions, ...(result.usage ? { usage: result.usage } : {}), dropped };
}
