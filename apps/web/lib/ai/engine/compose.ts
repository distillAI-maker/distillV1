import { z } from 'zod';
import type { ToneRules } from '@distill/catalog';
import {
  checkLine,
  DAY_ONE_PER_MOMENT,
  daySchema,
  newPartSchema,
  partFromNew,
  sortParts,
  validateRitual,
  type Allowed,
  type LineContext,
  type PersonModel,
  type RitualPart,
} from '@distill/engine/ritual';
import { partLine, personBlock } from './brief';
import { callJson, OPUS, type CallUsage, type ClaudeClient } from './call';
import { COMPOSE_JOB, PROMPT_VERSIONS, voice, WHO } from './prompts';
import { arr, dropNulls, en, int, nul, obj, str } from './schema';

/**
 * Step 5: shape the first Ritual (Opus 5.5, medium). Rules placed every part already; Claude names
 * them in their words, writes each why, sets times their words give, and may add up to three parts
 * quoted from their own words. Code applies it, validates the whole Ritual, and keeps the rules
 * version if anything fails twice.
 */
export const PROMPT_VERSION = PROMPT_VERSIONS.compose;

const edit = z
  .object({
    id: z.string(),
    title: z.string().min(1).max(60).optional(),
    why: z.string().max(240).optional(),
    at: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).optional(),
    days: z.array(daySchema).max(7).optional(),
  })
  .strict();
const out = z
  .object({
    parts: z.array(edit),
    additions: z.array(newPartSchema).max(3),
    summary: z.string().max(240),
  })
  .strict();
type Out = z.infer<typeof out>;

const newPartJson = obj({
  title: str(),
  slot: en(['morning', 'midday', 'evening', 'night']),
  at: nul(str('HH:MM')),
  days: nul(arr(en(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']))),
  perWeek: nul(int()),
  minutes: nul(int()),
  place: nul(str()),
  people: nul(arr(str('a person id from <person>'))),
  area: en(['eat', 'move', 'mind', 'sleep', 'skin']),
  why: str(),
  source: obj({ kind: en(['words']), quote: str() }),
});
const SCHEMA = obj({
  parts: arr(obj({ id: str(), title: nul(str()), why: nul(str()), at: nul(str('HH:MM')), days: nul(arr(en(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']))) })),
  additions: arr(newPartJson),
  summary: str(),
});

export interface ComposeResult {
  readonly parts: RitualPart[];
  readonly summary: string;
  readonly from: 'claude' | 'rules';
  readonly usage?: CallUsage;
  readonly problems?: readonly string[];
}

function apply(rules: readonly RitualPart[], data: Out, newId: () => string): RitualPart[] {
  const byId = new Map(data.parts.map((p) => [p.id, p]));
  const shaped = rules.map((p) => {
    const e = byId.get(p.id);
    if (!e || p.lock) return p;
    return {
      ...p,
      ...(e.title ? { title: e.title } : {}),
      ...(e.why ? { why: e.why } : {}),
      when: { ...p.when, ...(e.at ? { at: e.at } : {}), ...(e.days?.length ? { days: e.days } : {}) },
    };
  });
  const added = data.additions.map((a) => partFromNew(a, newId(), ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']));
  return sortParts([...shaped, ...added]).map((p, i) => ({ ...p, order: i }));
}

export async function composeRitual(
  client: ClaudeClient | null,
  input: {
    person: PersonModel;
    rules: { parts: RitualPart[]; summary: string };
    allowed: Allowed;
    toneRules: Pick<ToneRules, 'bannedPhrases' | 'maxWordsExclusive' | 'gatedMaxWords'>;
    lineContext: Omit<LineContext, 'toneRules' | 'maxWords'>;
    firstCompose: boolean;
    today: string;
    newId: () => string;
  },
): Promise<ComposeResult> {
  const rules = { parts: input.rules.parts, summary: input.rules.summary, from: 'rules' as const };
  if (!client) return rules;
  const ctx: LineContext = { ...input.lineContext, toneRules: input.toneRules, maxWords: 30 };
  const locked = input.rules.parts.filter((p) => p.lock);
  const content = [
    personBlock(input.person, { today: input.today, lockedTitles: locked.map((p) => p.title) }),
    '<ritual>',
    ...input.rules.parts.map((p) => partLine(p)),
    '</ritual>',
  ].join('\n');
  const check = (data: Out): string[] => {
    const parts = apply(input.rules.parts, data, input.newId);
    const problems = validateRitual({
      parts,
      allowed: input.allowed,
      mustKeep: locked,
      perMoment: input.firstCompose ? DAY_ONE_PER_MOMENT : undefined,
    });
    for (const p of parts) if (!p.lock) for (const i of checkLine(p.why, ctx)) problems.push(`why of "${p.title}": ${i.code} ${i.detail}`);
    for (const i of checkLine(data.summary, ctx)) problems.push(`summary: ${i.code} ${i.detail}`);
    for (const id of data.parts.map((p) => p.id)) if (!input.rules.parts.some((p) => p.id === id)) problems.push(`no part with id ${id}`);
    return problems;
  };
  const result = await callJson(client, {
    step: 'compose',
    model: OPUS,
    effort: input.firstCompose ? 'medium' : 'low',
    system: [WHO, voice(input.toneRules.bannedPhrases), COMPOSE_JOB],
    content,
    jsonSchema: SCHEMA,
    parse: z.preprocess(dropNulls, out) as unknown as z.ZodType<Out>,
    check,
    timeoutMs: 30000,
    maxTokens: 6000,
  });
  if (!result.ok) return { ...rules, ...(result.usage ? { usage: result.usage } : {}), problems: result.problems ?? [result.reason] };
  return {
    parts: apply(input.rules.parts, result.data, input.newId),
    summary: result.data.summary,
    from: 'claude',
    usage: result.usage,
  };
}
