import { z } from 'zod';
import type { ToneRules } from '@distill/catalog';
import {
  checkLine,
  DAY_ONE_PER_MOMENT,
  daySchema,
  fitsCap,
  momentCounts,
  newPartSchema,
  partFromNew,
  sortParts,
  validateRitual,
  type Allowed,
  type LineContext,
  type PersonModel,
  type RitualPart,
  type StackItemLike,
} from '@distill/engine/ritual';
import { partLine, partNotes, personBlock } from './brief';
import { callJson, CAPI, type CallUsage, type ClaudeClient } from './call';
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
    slot: z.enum(['morning', 'midday', 'evening', 'night']).optional(),
    days: z.array(daySchema).max(7).optional(),
    perWeek: z.number().int().min(1).max(7).optional(),
  })
  .strict();
const out = z
  .object({
    parts: z.array(edit),
    additions: z.array(newPartSchema).max(4),
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
  parts: arr(obj({ id: str(), title: nul(str()), why: nul(str()), at: nul(str('HH:MM')), slot: nul(en(['morning', 'midday', 'evening', 'night'])), days: nul(arr(en(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']))), perWeek: nul(int()) })),
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

/** Claude sometimes writes a part's title, or drops the "part:" prefix, where its id belongs. */
export function resolvePartId(id: string, parts: readonly Pick<RitualPart, 'id' | 'title'>[]): string {
  if (parts.some((p) => p.id === id)) return id;
  const bare = id.replace(/^["']|["']$/g, '').trim();
  const hit =
    parts.find((p) => p.id === `part:${bare}` || p.id.replace(/^part:/, '') === bare) ??
    parts.find((p) => p.title.toLowerCase() === bare.toLowerCase());
  return hit?.id ?? id;
}

/**
 * Claude's edits on the rules draft. With a cap (day one), a change of days or an addition that
 * would overfill a moment is trimmed to the days with room, or left out, rather than failing the
 * whole Ritual: the rest of Claude's work still lands.
 */
function apply(rules: readonly RitualPart[], data: Out, newId: () => string, cap?: number): RitualPart[] {
  const baseline = momentCounts(rules);
  const fits = (parts: readonly RitualPart[]) => cap === undefined || fitsCap(parts, cap, baseline);
  const byId = new Map(data.parts.map((p) => [resolvePartId(p.id, rules), p]));
  let current: RitualPart[] = [...rules];
  for (const p of rules) {
    const e = byId.get(p.id);
    if (!e || p.lock) continue;
    const words = { ...p, ...(e.title ? { title: e.title } : {}), ...(e.why ? { why: e.why } : {}) };
    const timed = { ...words, when: { ...p.when, ...(e.slot ? { slot: e.slot } : {}), ...(e.at ? { at: e.at } : {}) } };
    // Days they named replace "a few times a week".
    const at = timed.when.at ? { at: timed.when.at } : {};
    const withDays: RitualPart = e.days?.length
      ? { ...timed, when: { slot: timed.when.slot, days: e.days, ...at } }
      : e.perWeek && !p.when.days.length
        ? { ...timed, when: { slot: timed.when.slot, days: [], perWeek: e.perWeek, ...at } }
        : timed;
    const swap = (q: RitualPart) => current.map((x) => (x.id === p.id ? q : x));
    const onDays = (days: RitualPart['when']['days']): RitualPart => ({ ...withDays, when: { ...withDays.when, days } });
    const room = withDays.when.days.filter((d) => fits(swap(onDays([d]))));
    current = fits(swap(withDays)) ? swap(withDays) : room.length ? swap(onDays(room)) : swap(timed);
  }
  for (const a of data.additions) {
    const part = partFromNew(a, newId(), ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
    if (fits([...current, part])) {
      current = [...current, part];
      continue;
    }
    // Keep the days that still have room; a weekday thing can wait for the weekend to clear.
    const days = part.when.days.filter((d) => fits([...current, { ...part, when: { ...part.when, days: [d] } }]));
    if (days.length) current = [...current, { ...part, when: { ...part.when, days } }];
  }
  return sortParts(current).map((p, i) => ({ ...p, order: i }));
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
    /** Their list and answers: the Ritual is shaped from their words, so it has to see them. */
    stack?: readonly StackItemLike[];
    asks?: readonly { q: string; a: string }[];
    newId: () => string;
  },
): Promise<ComposeResult> {
  const rules = { parts: input.rules.parts, summary: input.rules.summary, from: 'rules' as const };
  if (!client) return rules;
  const ctx: LineContext = { ...input.lineContext, toneRules: input.toneRules, maxWords: 30, theirWords: input.allowed.words };
  const locked = input.rules.parts.filter((p) => p.lock);
  const content = [
    personBlock(input.person, { today: input.today, lockedTitles: locked.map((p) => p.title), ...(input.asks ? { asks: input.asks } : {}) }),
    '<ritual>',
    ...input.rules.parts.flatMap((p) => [partLine(p), ...partNotes(p, input.stack ?? [])]),
    '</ritual>',
  ].join('\n');
  const cap = input.firstCompose ? DAY_ONE_PER_MOMENT : undefined;
  const check = (data: Out): string[] => {
    const parts = apply(input.rules.parts, data, input.newId, cap);
    const problems = validateRitual({
      parts,
      allowed: input.allowed,
      mustKeep: locked,
      perMoment: cap,
      baseline: momentCounts(input.rules.parts),
    });
    for (const p of parts) if (!p.lock) for (const i of checkLine(p.why, ctx)) problems.push(`why of "${p.title}": ${i.code} ${i.detail}`);
    for (const i of checkLine(data.summary, ctx)) problems.push(`summary: ${i.code} ${i.detail}`);
    for (const id of data.parts.map((p) => resolvePartId(p.id, input.rules.parts)))
      if (!input.rules.parts.some((p) => p.id === id)) problems.push(`no part with id ${id}`);
    return problems;
  };
  const result = await callJson(client, {
    step: 'compose',
    model: CAPI,
    effort: input.firstCompose ? 'high' : 'medium',
    system: [WHO, voice(input.toneRules.bannedPhrases), COMPOSE_JOB],
    content,
    jsonSchema: SCHEMA,
    parse: z.preprocess(dropNulls, out) as unknown as z.ZodType<Out>,
    check,
    // The first Ritual is made once and is worth the wait; later recomposes stay quick.
    // Thinking shares the token budget: too little, and the answer is cut off mid-JSON.
    timeoutMs: input.firstCompose ? 120000 : 45000,
    maxTokens: input.firstCompose ? 20000 : 12000,
  });
  if (!result.ok) {
    // One bad line never sends the rest back to the draft: it loses that line, and keeps the Ritual.
    const fine = (line: string) => checkLine(line, ctx).length === 0;
    const kept: Out | null = result.partial
      ? {
          parts: result.partial.parts.map(({ why, ...p }) => ({ ...p, ...(why && fine(why) ? { why } : {}) })),
          additions: result.partial.additions.filter((a) => fine(a.why)),
          summary: fine(result.partial.summary) ? result.partial.summary : input.rules.summary,
        }
      : null;
    if (kept && !check(kept).length)
      return { parts: apply(input.rules.parts, kept, input.newId, cap), summary: kept.summary, from: 'claude', ...(result.usage ? { usage: result.usage } : {}), problems: result.problems ?? [] };
    return { ...rules, ...(result.usage ? { usage: result.usage } : {}), problems: result.problems ?? [result.reason] };
  }
  return {
    parts: apply(input.rules.parts, result.data, input.newId, cap),
    summary: result.data.summary,
    from: 'claude',
    usage: result.usage,
  };
}
