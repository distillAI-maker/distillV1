import Anthropic from '@anthropic-ai/sdk';
import type { z } from 'zod';

/**
 * One way to ask Claude for structured output, used by every engine step. Server only.
 *
 * - Opus 5.5 for everything a person reads, with the server-side refusal fallback on; Haiku 5.5 for
 *   reading messages, where speed matters and nothing it says is shown. Haiku has no fallback.
 * - The system prompt is static (no dates, names or ids) and cached for an hour; the person's
 *   material goes in the user turn, inside tags the system prompt calls theirs, not instructions.
 * - Structured output via output_config.format, then a zod parse. A failed parse or a failed check
 *   is retried once with the problems listed; after that the caller's fallback runs.
 * - Every call reports tokens, cost and latency so the event log can carry them.
 */

export const OPUS = 'claude-opus-5-5';
export const HAIKU = 'claude-haiku-5-5';
export type EngineModel = typeof OPUS | typeof HAIKU;

/** USD per million tokens. Cache writes at one hour cost twice the input rate. */
const PRICE: Record<EngineModel, { input: number; output: number; cacheRead: number; cacheWrite1h: number }> = {
  [OPUS]: { input: 4, output: 20, cacheRead: 0.2, cacheWrite1h: 8 },
  [HAIKU]: { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite1h: 0.2 },
};

export interface CallUsage {
  readonly model: string;
  readonly tokensIn: number;
  readonly tokensOut: number;
  readonly cacheRead: number;
  readonly cacheWrite: number;
  readonly costUsd: number;
  readonly latencyMs: number;
  readonly stopReason: string | null;
  readonly attempts: number;
}

export type CallResult<T> =
  | { readonly ok: true; readonly data: T; readonly usage: CallUsage }
  | {
      readonly ok: false;
      readonly reason: 'no-key' | 'timeout' | 'refusal' | 'invalid' | 'api-error';
      readonly usage?: CallUsage;
      readonly problems?: readonly string[];
      /** The last answer that parsed but still had problems: a caller may keep the parts that pass. */
      readonly partial?: T;
    };

/** The parts of the SDK client the engine uses, so tests can stand in for it. */
export interface ClaudeClient {
  readonly messages: { create: (body: never, options?: never) => Promise<unknown> };
  readonly beta: { readonly messages: { create: (body: never, options?: never) => Promise<unknown> } };
}

export interface CallInput<T> {
  readonly step: string;
  readonly model: EngineModel;
  readonly effort: 'low' | 'medium' | 'high';
  /** Static blocks only. The last one carries the cache breakpoint. */
  readonly system: readonly string[];
  /** The person's material, in tags. */
  readonly content: string;
  readonly jsonSchema: Record<string, unknown>;
  readonly parse: z.ZodType<T>;
  /** Checks code runs on a parsed answer; problems trigger the one retry. */
  readonly check?: (data: T) => readonly string[];
  readonly timeoutMs: number;
  readonly maxTokens?: number;
}

type Raw = {
  content?: { type: string; text?: string }[];
  stop_reason?: string | null;
  model?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number | null;
    cache_creation_input_tokens?: number | null;
  };
};

function priced(model: EngineModel, raw: Raw) {
  const u = raw.usage ?? {};
  const p = PRICE[model];
  const tokensIn = u.input_tokens ?? 0;
  const tokensOut = u.output_tokens ?? 0;
  const cacheRead = u.cache_read_input_tokens ?? 0;
  const cacheWrite = u.cache_creation_input_tokens ?? 0;
  const costUsd =
    (tokensIn * p.input + tokensOut * p.output + cacheRead * p.cacheRead + cacheWrite * p.cacheWrite1h) / 1_000_000;
  return { tokensIn, tokensOut, cacheRead, cacheWrite, costUsd };
}

function body(input: CallInput<unknown>, content: string) {
  const system = input.system.map((text, i) => ({
    type: 'text' as const,
    text,
    ...(i === input.system.length - 1 ? { cache_control: { type: 'ephemeral' as const, ttl: '1h' as const } } : {}),
  }));
  const common = {
    model: input.model,
    max_tokens: input.maxTokens ?? 8000,
    system,
    messages: [{ role: 'user' as const, content }],
  };
  if (input.model === HAIKU)
    return {
      ...common,
      // Reading a message is quick work: low effort, no thinking, nothing a person reads.
      thinking: { type: 'disabled' as const },
      output_config: { effort: input.effort, format: { type: 'json_schema' as const, schema: input.jsonSchema } },
    };
  return {
    ...common,
    output_config: { effort: input.effort, format: { type: 'json_schema' as const, schema: input.jsonSchema } },
    // If someone's words trip a safety classifier, the API retries on a fallback model in the same call.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default' as const,
  };
}

const ATTEMPTS = 3;

export async function callJson<T>(client: ClaudeClient | null, input: CallInput<T>): Promise<CallResult<T>> {
  if (!client) return { ok: false, reason: 'no-key' };
  const started = Date.now();
  let totals = { tokensIn: 0, tokensOut: 0, cacheRead: 0, cacheWrite: 0, costUsd: 0 };
  let content = input.content;
  let problems: string[] = [];
  let stopReason: string | null = null;
  let model: string = input.model;
  let partial: T | undefined;
  // Three tries: the fixed line is a stand-in, so Claude gets every fair chance to land its own.
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const remaining = input.timeoutMs - (Date.now() - started);
    if (remaining <= 250) return { ok: false, reason: 'timeout', usage: usageOf(), problems };
    let raw: Raw;
    try {
      const request = body(input as CallInput<unknown>, content);
      const options = { timeout: remaining, maxRetries: 0 };
      raw = (await (input.model === HAIKU
        ? client.messages.create(request as never, options as never)
        : client.beta.messages.create(request as never, options as never))) as Raw;
    } catch (error) {
      if (error instanceof Anthropic.APIConnectionTimeoutError) return { ok: false, reason: 'timeout', usage: usageOf(), problems };
      return { ok: false, reason: 'api-error', usage: usageOf(), problems: [error instanceof Error ? error.message.slice(0, 200) : 'request failed'] };
    }
    const cost = priced(input.model, raw);
    totals = {
      tokensIn: totals.tokensIn + cost.tokensIn,
      tokensOut: totals.tokensOut + cost.tokensOut,
      cacheRead: totals.cacheRead + cost.cacheRead,
      cacheWrite: totals.cacheWrite + cost.cacheWrite,
      costUsd: totals.costUsd + cost.costUsd,
    };
    stopReason = raw.stop_reason ?? null;
    model = raw.model ?? model;
    if (stopReason === 'refusal') return { ok: false, reason: 'refusal', usage: usageOf(attempt) };
    const text = (raw.content ?? []).flatMap((b) => (b.type === 'text' && b.text ? [b.text] : [])).join('');
    let parsed: z.ZodSafeParseResult<T> | null;
    try {
      parsed = input.parse.safeParse(JSON.parse(text));
    } catch {
      parsed = null;
    }
    if (!parsed?.success) {
      problems = ['The reply was not valid JSON for the schema.'];
    } else {
      problems = [...(input.check?.(parsed.data) ?? [])];
      if (!problems.length) return { ok: true, data: parsed.data, usage: usageOf(attempt) };
      partial = parsed.data;
    }
    content = `${input.content}\n\n<problems>\nYour previous answer could not be used. Fix exactly these and answer again:\n${problems.map((p) => `- ${p}`).join('\n')}\n</problems>`;
  }
  return { ok: false, reason: 'invalid', usage: usageOf(ATTEMPTS), problems, ...(partial !== undefined ? { partial } : {}) };

  function usageOf(attempts = 1): CallUsage {
    return { model, ...totals, latencyMs: Date.now() - started, stopReason, attempts };
  }
}

/** The SDK client, or null when there's no key (everything falls back to rules and fixed lines). */
export function claudeClient(): ClaudeClient | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  return new Anthropic() as unknown as ClaudeClient;
}
