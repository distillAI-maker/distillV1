import { z } from 'zod';
import type { PersonModel } from '@distill/engine/ritual';
import { personBlock } from './brief';
import { CAPI, priced, type CallUsage, type ClaudeClient } from './call';
import { EXPLORE_FEED_JOB, PROMPT_VERSIONS, voice, WHO } from './prompts';

/**
 * Real, upcoming things near them that extend what they already do, found with web search (Sonnet
 * 5.5, low effort). Code, not the model, decides what shows: every event needs a page the search
 * actually returned and a date that hasn't passed. Anything else is dropped, and an empty list
 * just leaves the evergreen next steps on the page. Asked for at most once a week per person.
 */
export const PROMPT_VERSION = PROMPT_VERSIONS.exploreFeed;

export const foundEventSchema = z
  .object({
    id: z.string().min(1).max(120),
    thread: z.string().min(1).max(40),
    kind: z.enum(['race', 'class', 'workshop', 'group', 'talk', 'trip', 'place', 'event']),
    title: z.string().min(1).max(120),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    when: z.string().max(80).optional(),
    where: z.string().max(120),
    url: z.string().url(),
    source: z.string().max(120),
    why: z.string().max(240),
  })
  .strict();
export type FoundEvent = z.infer<typeof foundEventSchema>;

const answerSchema = z.object({
  events: z
    .array(
      z.object({
        thread: z.string(),
        kind: z.string(),
        title: z.string(),
        date: z.string().nullish(),
        when: z.string().nullish(),
        where: z.string().nullish(),
        url: z.string(),
        why: z.string().nullish(),
      }),
    )
    .max(20),
});

type Block = { type: string; text?: string; citations?: { url?: string }[] | null };
type Raw = {
  content?: Block[];
  stop_reason?: string | null;
  model?: string;
  usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null; server_tool_use?: { web_search_requests?: number } | null };
};

export interface FeedResult {
  readonly events: readonly FoundEvent[];
  readonly from: 'claude' | 'failed' | 'off';
  readonly searches: number;
  readonly dropped: readonly string[];
  readonly usage?: CallUsage;
}

const MAX_SEARCHES = 5;
const MAX_EVENTS = 8;
const HORIZON_DAYS = 200;
const KINDS = new Set(['race', 'class', 'workshop', 'group', 'talk', 'trip', 'place', 'event']);
const PER_SEARCH_USD = 0.01;

const hostOf = (url: string): string | null => {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.hostname.replace(/^www\./, '').toLowerCase() : null;
  } catch {
    return null;
  }
};

/** Every host the search really returned, wherever it sits in the response. Claude's own text doesn't count. */
export function searchedHosts(blocks: readonly Block[]): Set<string> {
  const hosts = new Set<string>();
  const add = (url: string | undefined) => {
    const host = url ? hostOf(url) : null;
    if (host) hosts.add(host);
  };
  for (const block of blocks) {
    if (block.type === 'text') {
      for (const c of block.citations ?? []) add(c.url);
      continue;
    }
    if (block.type === 'server_tool_use') continue;
    for (const m of JSON.stringify(block).matchAll(/https?:\/\/[^\s"'\\<>)]+/g)) add(m[0]);
  }
  return hosts;
}

function parseAnswer(text: string): z.infer<typeof answerSchema> | null {
  const start = text.indexOf('{"events"') >= 0 ? text.indexOf('{"events"') : text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const parsed = answerSchema.safeParse(JSON.parse(text.slice(start, end + 1)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

const dayAfter = (date: string, days: number) => new Date(Date.parse(`${date}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

export async function findEvents(
  client: ClaudeClient | null,
  input: {
    person: PersonModel;
    threads: readonly { id: string; name: string; from: readonly string[] }[];
    region: string;
    today: string;
    /** Titles they said no to or already said yes to. */
    skip: readonly string[];
    liked: readonly string[];
    banned: readonly string[];
    timeoutMs?: number;
  },
): Promise<FeedResult> {
  if (!client) return { events: [], from: 'off', searches: 0, dropped: [] };
  const started = Date.now();
  const deadline = started + (input.timeoutMs ?? 100_000);
  const threadIds = new Set(input.threads.map((t) => t.id));
  const content = [
    personBlock(input.person, { today: input.today }),
    `<today>${input.today}</today>`,
    `<region>${input.region.slice(0, 80)}</region>`,
    '<threads>',
    ...input.threads.slice(0, 6).map((t) => `- ${t.id}: ${t.name}${t.from.length ? ` (they do: ${t.from.slice(0, 4).join(', ')})` : ''}`),
    '</threads>',
    input.skip.length ? `<skip>${input.skip.slice(-40).join('; ')}</skip>` : '',
    input.liked.length ? `<liked>${input.liked.slice(-12).join('; ')}</liked>` : '',
  ]
    .filter(Boolean)
    .join('\n');
  const messages: { role: 'user' | 'assistant'; content: unknown }[] = [{ role: 'user', content }];
  const seen: Block[] = [];
  let last: Raw | null = null;
  let totals = { tokensIn: 0, tokensOut: 0, cacheRead: 0, cacheWrite: 0, costUsd: 0 };
  let searches = 0;
  let turns = 0;
  const usage = (): CallUsage => ({
    model: last?.model ?? CAPI,
    ...totals,
    costUsd: totals.costUsd + searches * PER_SEARCH_USD,
    latencyMs: Date.now() - started,
    stopReason: last?.stop_reason ?? null,
    attempts: turns,
  });
  // The server runs the search loop; a long one pauses, and we hand it back to carry on.
  for (; turns < 3; ) {
    const remaining = deadline - Date.now();
    if (remaining <= 1000) return { events: [], from: 'failed', searches, dropped: ['timed out'], usage: usage() };
    turns += 1;
    try {
      last = (await client.messages.create(
        {
          model: CAPI,
          max_tokens: 8000,
          system: [
            { type: 'text', text: WHO },
            { type: 'text', text: voice(input.banned) },
            { type: 'text', text: EXPLORE_FEED_JOB, cache_control: { type: 'ephemeral', ttl: '1h' } },
          ],
          messages,
          tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: MAX_SEARCHES }],
          output_config: { effort: 'low' },
        } as never,
        { timeout: remaining, maxRetries: 0 } as never,
      )) as Raw;
    } catch (error) {
      return { events: [], from: 'failed', searches, dropped: [error instanceof Error ? error.message.slice(0, 200) : 'api error'], usage: usage() };
    }
    const cost = priced(CAPI, last);
    totals = {
      tokensIn: totals.tokensIn + cost.tokensIn,
      tokensOut: totals.tokensOut + cost.tokensOut,
      cacheRead: totals.cacheRead + cost.cacheRead,
      cacheWrite: totals.cacheWrite + cost.cacheWrite,
      costUsd: totals.costUsd + cost.costUsd,
    };
    searches += last.usage?.server_tool_use?.web_search_requests ?? 0;
    seen.push(...(last.content ?? []));
    if (last.stop_reason !== 'pause_turn') break;
    messages.push({ role: 'assistant', content: last.content ?? [] });
  }
  if (last?.stop_reason === 'refusal' || last?.stop_reason === 'pause_turn')
    return { events: [], from: 'failed', searches, dropped: [String(last.stop_reason)], usage: usage() };
  const text = (last?.content ?? []).flatMap((b) => (b.type === 'text' && b.text ? [b.text] : [])).join('');
  const answer = parseAnswer(text);
  if (!answer) return { events: [], from: 'failed', searches, dropped: ['no answer we could read'], usage: usage() };

  const hosts = searchedHosts(seen);
  const skip = new Set(input.skip.map((s) => s.toLowerCase()));
  const banned = input.banned.map((b) => b.toLowerCase());
  const horizon = dayAfter(input.today, HORIZON_DAYS);
  const dropped: string[] = [];
  const events: FoundEvent[] = [];
  const perThread = new Map<string, number>();
  for (const e of answer.events) {
    const title = e.title.trim().slice(0, 120);
    const host = hostOf(e.url);
    const date = e.date?.trim() || undefined;
    const why = (e.why ?? '').trim().slice(0, 240);
    const refuse = (reason: string) => dropped.push(`${title.slice(0, 40)}: ${reason}`);
    if (!title || !threadIds.has(e.thread)) refuse('not one of their threads');
    else if (!host || !hosts.has(host)) refuse('no page behind it');
    else if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < input.today || date > horizon)) refuse('date out of range');
    else if (!date && !e.when?.trim()) refuse('no date or schedule');
    else if (skip.has(title.toLowerCase())) refuse('already answered');
    else if (banned.some((b) => why.toLowerCase().includes(b))) refuse('tone');
    else if ((perThread.get(e.thread) ?? 0) >= 3) refuse('enough for this thread');
    else if (events.some((x) => x.title.toLowerCase() === title.toLowerCase())) refuse('duplicate');
    else {
      perThread.set(e.thread, (perThread.get(e.thread) ?? 0) + 1);
      events.push({
        id: slug(`${title}-${date ?? 'open'}`) || slug(e.url),
        thread: e.thread,
        kind: (KINDS.has(e.kind) ? e.kind : 'event') as FoundEvent['kind'],
        title,
        ...(date ? { date } : {}),
        ...(e.when?.trim() ? { when: e.when.trim().slice(0, 80) } : {}),
        where: (e.where ?? '').trim().slice(0, 120),
        url: e.url,
        source: host,
        why,
      });
    }
    if (events.length >= MAX_EVENTS) break;
  }
  events.sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'));
  return { events, from: 'claude', searches, dropped, usage: usage() };
}
