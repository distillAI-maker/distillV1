import { z } from 'zod';
import type { ToneRules } from '@distill/catalog';
import {
  applyOps,
  checkLine,
  dayOf,
  daysBetween,
  opSchema,
  replyErrors,
  validateOps,
  type Allowed,
  type LineContext,
  type Moment,
  type Op,
  type PersonModel,
  type RitualPart,
  type Scope,
} from '@distill/engine/ritual';
import { partLine, personBlock } from './brief';
import { callJson, OPUS, type CallUsage, type ClaudeClient } from './call';
import { resolvePartId } from './compose';
import { PROMPT_VERSIONS, RESHAPE_EXAMPLES, RESHAPE_JOB, voice, WHO } from './prompts';
import { arr, bool, dropNulls, en, int, nul, obj, str } from './schema';

/**
 * Step 7: reshape the days a change touches (Opus 5.5, low). Claude proposes a reply and edits;
 * code checks every edit against what may never change and checks that the reply only describes
 * what was done. One retry with the problems listed, then the fixed, tone-checked fallback.
 */
export const PROMPT_VERSION = PROMPT_VERSIONS.reshape;

const out = z
  .object({
    reply: z.string().max(600),
    ops: z.array(opSchema).max(20),
    ongoing: z.boolean(),
    ask: z.string().max(200).optional(),
  })
  .strict();
type Out = z.infer<typeof out>;

const newPart = obj({
  title: str(),
  slot: en(['morning', 'midday', 'evening', 'night']),
  at: nul(str('HH:MM')),
  days: nul(arr(en(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']))),
  perWeek: nul(int()),
  minutes: nul(int()),
  place: nul(str()),
  people: nul(arr(str())),
  area: en(['eat', 'move', 'mind', 'sleep', 'skin']),
  why: str(),
  source: {
    anyOf: [obj({ kind: en(['engine']), rule: str() }), obj({ kind: en(['words']), quote: str() })],
  },
});
const SCHEMA = obj({
  reply: str(),
  ops: arr({
    anyOf: [
      obj({ op: en(['move']), partId: str(), at: str('HH:MM') }),
      obj({ op: en(['shorten']), partId: str(), minutes: int() }),
      obj({ op: en(['skip']), partId: str() }),
      obj({ op: en(['swap']), partId: str(), with: newPart }),
      obj({ op: en(['add']), part: newPart }),
    ],
  }),
  ongoing: bool(),
  ask: nul(str()),
});

/** Said when Claude is off or its edits fail twice: nothing changes, and they can still adjust it. */
export const FALLBACK_REPLY = 'Got it. Your days stay as they are for now; tap any part if you want it lighter.';

export interface ReshapeResult {
  readonly reply: string;
  /** Edits per target date (day scope), or for the base week. */
  readonly opsByDate: Readonly<Record<string, readonly Op[]>>;
  readonly baseOps: readonly Op[];
  readonly ongoing: boolean;
  readonly ask: string | null;
  readonly from: 'claude' | 'rules' | 'fallback';
  readonly usage?: CallUsage;
  readonly problems?: readonly string[];
}

const DAY_NAME = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' } as const;

/**
 * When the day should be lighter and Claude is off or couldn't land a valid edit: the next morning
 * starts slow ("Sleep in"), so "out late tonight" or a short night still changes something real.
 * Only ever lighter, never touching anything theirs, protected or with people in it.
 */
export function lighterByRules(input: { trigger: { kind: string; load: string }; scope: Scope; today: string }): ReshapeResult | null {
  const { scope, trigger } = input;
  if (trigger.load !== 'lighter' || scope.kind !== 'day') return null;
  const morning = scope.targets.find((t) => t.moments.some((m) => m === 'morning' || m === 'saturday' || m === 'sunday'));
  if (!morning) return null;
  const op: Op = {
    op: 'add',
    part: {
      title: 'Sleep in',
      slot: 'morning',
      area: 'sleep',
      why: 'A slow start, so the rest of the day can wait until you are ready for it.',
      source: { kind: 'engine', rule: 'slow-start' },
    },
  };
  const gap = daysBetween(input.today, morning.date);
  const when = gap === 0 ? 'This morning' : gap === 1 ? 'Tomorrow' : DAY_NAME[dayOf(morning.date)];
  const reply =
    trigger.kind === 'night'
      ? `Short night, so ${when.toLowerCase() === 'this morning' ? 'this morning' : when} starts slow: sleep in, and the rest can wait.`
      : `${when} starts slow: sleep in, and the rest can wait until you're ready.`;
  return { reply, opsByDate: { [morning.date]: [op] }, baseOps: [], ongoing: false, ask: null, from: 'rules' };
}

export async function reshape(
  client: ClaudeClient | null,
  input: {
    person: PersonModel;
    message?: string;
    trigger: { kind: string; durability: 'once' | 'ongoing'; load: 'lighter' | 'same' | 'heavier'; moments: readonly Moment[] };
    scope: Scope;
    allowed: Allowed;
    toneRules: Pick<ToneRules, 'bannedPhrases' | 'maxWordsExclusive' | 'gatedMaxWords'>;
    lineContext: Omit<LineContext, 'toneRules' | 'maxWords'>;
    today: string;
  },
): Promise<ReshapeResult> {
  const fallback: ReshapeResult = { reply: FALLBACK_REPLY, opsByDate: {}, baseOps: [], ongoing: false, ask: null, from: 'fallback' };
  if (!client) return lighterByRules(input) ?? fallback;
  const { scope } = input;
  const locked = new Set(scope.locked);
  const prot = new Set(scope.protected);
  const ctx: LineContext = { ...input.lineContext, toneRules: input.toneRules, maxWords: 50, theirWords: input.allowed.words };
  const targetOf = new Map<string, string>();
  for (const t of scope.targets) for (const p of t.parts) targetOf.set(p.id, t.date);
  const targetParts = scope.targets.flatMap((t) => t.parts);
  // A title or a bare id where the id belongs is read as the part it names, before any check.
  const withIds = (value: unknown): unknown => {
    const data = dropNulls(value) as { ops?: unknown };
    if (data && Array.isArray(data.ops))
      for (const op of data.ops as { partId?: unknown }[])
        if (op && typeof op.partId === 'string') op.partId = resolvePartId(op.partId, targetParts);
    return data;
  };
  const content = [
    personBlock(input.person, { today: input.today }),
    input.message ? `<message>${input.message.slice(0, 2000)}</message>` : `<trigger>${input.trigger.kind}</trigger>`,
    `<change>durability: ${input.trigger.durability}; load: ${input.trigger.load}</change>`,
    '<targets>',
    ...scope.targets.flatMap((t) => [
      `${scope.kind === 'base' ? `The base week, from ${t.date}` : t.date} (${t.moments.join(', ')}):`,
      ...t.parts.map((p) => partLine(p, { locked: locked.has(p.id), protected: prot.has(p.id) })),
    ]),
    '</targets>',
  ].join('\n');

  // Splits the edits by the day they belong to, so each day is checked on its own.
  const split = (ops: readonly Op[]) => {
    const byDate: Record<string, Op[]> = {};
    const firstDate = scope.targets[0]?.date ?? input.today;
    for (const op of ops) {
      const date = 'partId' in op ? (targetOf.get(op.partId) ?? firstDate) : firstDate;
      (byDate[date] ??= []).push(op);
    }
    return byDate;
  };
  const check = (data: Out): string[] => {
    const problems: string[] = [];
    if (scope.kind === 'base') {
      const before = scope.targets[0]?.parts ?? [];
      problems.push(
        ...validateOps({ scope: 'base', before, ops: data.ops, actor: 'engine', guarded: { locked, protected: prot }, allowed: input.allowed }),
      );
    } else {
      for (const [date, ops] of Object.entries(split(data.ops))) {
        const target = scope.targets.find((t) => t.date === date);
        if (!target) {
          problems.push(`edits for ${date}, which this change didn't touch`);
          continue;
        }
        problems.push(
          ...validateOps({
            scope: 'day',
            before: target.parts as RitualPart[],
            ops,
            actor: 'engine',
            guarded: { locked, protected: prot },
            allowed: input.allowed,
            date,
            moments: target.moments,
            load: input.trigger.load,
          }),
        );
      }
    }
    // The reply may only name times in the new days (or their message) and days that changed.
    const times = new Set<string>();
    const minutes = new Set<string>();
    for (const t of scope.targets) {
      const after = applyOps(t.parts, scope.kind === 'base' ? data.ops : (split(data.ops)[t.date] ?? []), {
        scope: scope.kind,
        date: t.date,
        newId: () => 'x',
      }).parts;
      for (const p of after) {
        if (p.when.at) times.add(p.when.at);
        if (p.minutes) minutes.add(String(p.minutes));
      }
    }
    problems.push(
      ...replyErrors(data.reply, {
        times: [...times],
        dates: scope.targets.map((t) => t.date),
        ...(input.message ? { message: input.message } : {}),
        today: input.today,
      }),
    );
    // Times and lengths from the new days are theirs to hear; any other number is not.
    const said = { ...ctx, allowedNumbers: [...ctx.allowedNumbers, ...[...times].flatMap(clockForms), ...minutes] };
    problems.push(...checkLine(data.reply, said).map((i) => `reply: ${i.code} ${i.detail}`));
    if (data.ongoing !== (input.trigger.durability === 'ongoing')) problems.push('ongoing must match the change');
    return problems;
  };
  const result = await callJson(client, {
    step: 'reshape',
    model: OPUS,
    effort: 'low',
    system: [WHO, voice(input.toneRules.bannedPhrases), RESHAPE_JOB, RESHAPE_EXAMPLES],
    content,
    jsonSchema: SCHEMA,
    parse: z.preprocess(withIds, out) as unknown as z.ZodType<Out>,
    check,
    timeoutMs: 15000,
    maxTokens: 4000,
  });
  if (!result.ok)
    return { ...(lighterByRules(input) ?? fallback), ...(result.usage ? { usage: result.usage } : {}), problems: result.problems ?? [result.reason] };
  return {
    reply: result.data.reply.trim(),
    opsByDate: scope.kind === 'day' ? split(result.data.ops) : {},
    baseOps: scope.kind === 'base' ? result.data.ops : [],
    ongoing: result.data.ongoing,
    ask: result.data.ask ?? null,
    from: 'claude',
    usage: result.usage,
  };
}

/** The ways a reply may write a clock time: "09:30" as 9:30, and "13:00" as 13, 1:00 or 1. */
export function clockForms(at: string): string[] {
  const [h, m] = at.split(':').map(Number) as [number, number];
  const mm = String(m).padStart(2, '0');
  const twelve = ((h + 11) % 12) + 1;
  const forms = new Set([at, `${h}:${mm}`, `${twelve}:${mm}`]);
  if (m === 0) for (const x of [h, twelve]) forms.add(String(x));
  return [...forms];
}
