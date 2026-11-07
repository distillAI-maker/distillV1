import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { CatalogItemView, CatalogView, ToneRules } from '@distill/catalog';
import {
  addDays,
  allowedNumbersFrom,
  applyOps,
  applyPersonOps,
  baseOn,
  flexibleParts,
  ritualPartSchema,
  forgetFact,
  knowsOf,
  nowFromWords,
  type KnownFact,
  composeByRules,
  daysBetween,
  decide,
  exploreGate,
  ideasFor,
  localDate,
  localMinute,
  MAX_PER_MOMENT,
  momentOfPart,
  nightTrigger,
  personFromProgress,
  pickToday,
  refreshFromProgress,
  resolveWhen,
  ritualOn,
  scopeTrigger,
  seasonOn,
  slipTrigger,
  sortParts,
  stamp,
  validateOps,
  valuableQuestions,
  NOT_SURE,
  withNights,
  type Allowed,
  type Decision,
  type EngineEvent,
  type EngineStamp,
  type ExploreBank,
  type Moment,
  type NewPart,
  type Op,
  type PersonModel,
  type PriorDecision,
  type QuestionDraft,
  type RitualPart,
  type RitualVersion,
  type TodayHistory,
  type TodayPick,
} from '@distill/engine/ritual';
import { theirWords, type ItemStandingNote } from '../../lib/ai/engine/brief';
import type { CallUsage, ClaudeClient } from '../../lib/ai/engine/call';
import { findEvents, foundEventSchema, PROMPT_VERSION as EXPLORE_FEED_VERSION, type FoundEvent } from '../../lib/ai/engine/explore-feed';
import { THREADS, threadsFor } from '../../lib/explore/threads';
import { copy } from '../../lib/copy';
import { revealNotes, wholeRitual } from '../../lib/onboarding/reveal';
import { firstRitualList } from '../../lib/progress/types';
import { isStockWhy } from '../../lib/ritual-lines';
import { classifyMessage, readByWords, PROMPT_VERSION as CLASSIFY_VERSION } from '../../lib/ai/engine/classify';
import { composeRitual, PROMPT_VERSION as COMPOSE_VERSION } from '../../lib/ai/engine/compose';
import { explore as exploreStep, PROMPT_VERSION as EXPLORE_VERSION } from '../../lib/ai/engine/explore';
import { CRISIS_REPLY, replyTo, type ReplyAbout, PROMPT_VERSION as REPLY_VERSION } from '../../lib/ai/engine/reply';
import { reshape, PROMPT_VERSION as RESHAPE_VERSION, isBedPart } from '../../lib/ai/engine/reshape';
import { updatePerson, PROMPT_VERSION as UPDATE_VERSION } from '../../lib/ai/engine/update-person';
import { fallbackLine, wordDecisions, PROMPT_VERSION as WORD_VERSION } from '../../lib/ai/engine/word-decisions';
import { morePlaces } from '../../lib/catalog/common';
import { pickQuestion } from '../../lib/daily';
import type { Progress } from '../../lib/progress/types';
import type { EngineEventRow, EngineStore, StoredMessage } from './engine-store';
import { HttpError } from './service';

/**
 * runEngine: one entry point for everything that happens to a person (build plan, section 5).
 * Every event updates the person model, then reruns only the steps whose inputs changed, and every
 * output is logged with the stamp of what produced it. Rules decide what is cleared and kept; Claude
 * shapes and says; code checks everything Claude proposes. With no key, or over the day's cap,
 * every step falls back to rules and fixed lines and nothing breaks.
 */

export const CAPS = { callsPerDay: 40, reshapesPerDay: 6 } as const;
const DAY_MS = 86_400_000;
const DEFAULT_ZONE = 'America/Los_Angeles';
/** Changes they see and can undo: reshapes and their own edits, not the engine's upkeep. */
const UNDOABLE: readonly RitualVersion['cause']['trigger'][] = ['message', 'plan', 'night', 'slip', 'edit'];
/** At most this many kept things join the week in one run; the rest join on the next. */
const ADDS_PER_RUN = 3;

type Tx = Parameters<Parameters<EngineStore['withLock']>[1]>[0];
type Decided = ReturnType<typeof decide>;
type Change = RitualVersion['changes'][number];
type Night = { readonly date: string; readonly sleepMin?: number };

export interface EngineDeps {
  readonly store: EngineStore;
  /** Their saved progress (the journey). Only the app writes it, so it is read before the lock. */
  readonly loadProgress: (userId: string) => Promise<Progress | null>;
  /** Recent nights from their wearable, or the demo's synthetic nights. */
  readonly loadNights: (userId: string, progress: Progress, through: string) => Promise<readonly Night[]>;
  readonly client: ClaudeClient | null;
  readonly catalog: CatalogView;
  readonly toneRules: Pick<ToneRules, 'bannedPhrases' | 'maxWordsExclusive' | 'gatedMaxWords'>;
  readonly bank: ExploreBank;
  readonly now?: () => Date;
  readonly gitSha?: string;
}

export interface DayOut {
  readonly date: string;
  readonly parts: readonly (RitualPart & { readonly check?: 'done' | 'skipped'; readonly moment: Moment })[];
  /** The day was adjusted from the base week. */
  readonly changed: boolean;
}

export interface ExploreState {
  readonly region: string | null;
  /** When this batch was found. */
  readonly at: string | null;
  /** False when it's time to look again. */
  readonly fresh: boolean;
  /** Whether Distill can search right now (Claude on, under the day's cap). */
  readonly available: boolean;
  readonly events: readonly FoundEvent[];
  readonly going: readonly (FoundEvent & { readonly past: boolean })[];
}

export interface EngineState {
  readonly person: {
    readonly name: string;
    readonly season: string;
    readonly nightsShapeMornings: boolean;
    readonly wearable: string | null;
    /** Whether what they wrote in onboarding has been read yet. False means the app should ask for it. */
    readonly readDone?: boolean;
  };
  readonly ritual: {
    readonly status: 'none' | 'proposed' | 'accepted';
    readonly summary: string;
    readonly proposed: RitualVersion | null;
    readonly today: DayOut;
    readonly week: readonly DayOut[];
    /** Parts that happen a few times a week on no fixed day: not on any one day, but still theirs. */
    readonly anyDay: readonly RitualPart[];
    readonly lastChange: {
      readonly versionId: string;
      readonly reply?: string;
      readonly scope: 'base' | 'day';
      readonly date: string;
      readonly undoable: boolean;
    } | null;
  };
  readonly decisions: readonly Decision[];
  readonly today: {
    readonly kind: TodayPick['pick'] extends infer P ? (P extends { kind: infer K } ? K : never) | null : never;
    readonly decision?: Decision;
    readonly question?: QuestionDraft;
    readonly more?: string;
    readonly learn?: string;
    /** After a yes to letting something go: the catalog's swap, theirs to add or not. */
    readonly swap?: SwapOffer;
  };
  readonly thread: readonly StoredMessage[];
  /** The long view of what Distill has learned about them, for Your things. */
  readonly knows: readonly KnownFact[];
  /** Real things near them that extend what they already do, and what they said yes to. */
  readonly explore: ExploreState;
  /** Where each thing on their list stands, for the app's labels. */
  readonly items: Readonly<Record<string, ItemStanding>>;
  /** Dollars a month: back from clears they said yes to, and waiting on clears not yet answered. */
  readonly money: { readonly back: number; readonly waiting: number };
}

/** Outside the edit (a clinician's), theirs, worth keeping, proposed to let go, to adjust, or still open. */
export type ItemStanding = 'clinician' | 'theirs' | 'keep' | 'clear' | 'adjust' | 'open';

/** Something to do in place of what they let go of, offered once: never something to buy. */
export interface SwapOffer {
  readonly itemKey: string;
  readonly stackItemId: string;
  readonly title: string;
  readonly slot: 'morning' | 'midday' | 'evening' | 'night';
  readonly perWeek: number | null;
}

export interface EngineResult {
  readonly state: EngineState;
  readonly reply?: string;
  readonly versionId?: string;
  /** A stack change named in a message ("stopped the AG1"). The app confirms it before changing the list. */
  readonly stackChange?: { action: 'started' | 'stopped'; name: string; stackItemId?: string };
  /** Feelings about things on their list that need their yes before Distill records them. */
  readonly ask?: readonly { stackItemId: string; attachment: string; quote: string }[];
  readonly explore?: { options: readonly { ideaId: string; title: string; why: string; url: string; partner: boolean }[] };
  /** A follow-up about something they let go of (or Distill suggested letting go of) that has a swap. */
  readonly swap?: SwapOffer;
}

interface Ctx {
  readonly userId: string;
  readonly progress: Progress;
  person: PersonModel;
  readonly today: string;
  readonly minute: number;
  readonly instant: string;
  versions: RitualVersion[];
  decisions: Decision[];
  readonly client: ClaudeClient | null;
  readonly reshapesLeft: number;
  /** Claude's calls this run, written after the transaction so a failed run still counts. */
  readonly calls: EngineEventRow[];
}

export class Engine {
  constructor(private readonly deps: EngineDeps) {}

  private now() {
    return this.deps.now?.() ?? new Date();
  }

  /** A reply's time: now, and never before the message it answers. */
  private after(ctx: Ctx) {
    return new Date(Math.max(this.now().getTime(), Date.parse(ctx.instant) + 1)).toISOString();
  }

  private stampFor(inputs: unknown, promptVersion?: string, model?: string): EngineStamp {
    return stamp({
      catalogVersion: this.deps.catalog.version,
      inputs,
      ...(promptVersion ? { promptVersion } : {}),
      ...(model ? { model } : {}),
      ...(this.deps.gitSha ? { gitSha: this.deps.gitSha } : {}),
    });
  }

  private logCall(ctx: Ctx, step: string, promptVersion: string, usage: CallUsage | undefined, extra: Record<string, unknown> = {}) {
    if (!usage) return;
    ctx.calls.push({
      userId: ctx.userId,
      kind: 'llm.call',
      payload: { step, attempts: usage.attempts, stop: usage.stopReason, promptVersion, ...extra },
      model: usage.model,
      tokensIn: usage.tokensIn,
      tokensOut: usage.tokensOut,
      cacheRead: usage.cacheRead,
      costUsd: Number(usage.costUsd.toFixed(5)),
      latencyMs: usage.latencyMs,
    });
  }

  /**
   * Runs `work` under the person's lock with everything it needs loaded. Every read inside goes
   * through the transaction, so two quick messages see each other's changes in order.
   */
  private async locked<T>(userId: string, timeZone: string | undefined, work: (ctx: Ctx, tx: Tx) => Promise<T>): Promise<T> {
    const outside = await this.outside(userId, timeZone);
    const calls: EngineEventRow[] = [];
    try {
      return await this.deps.store.withLock(userId, async (tx) => work(await this.context(userId, timeZone, outside, calls, tx), tx));
    } finally {
      for (const call of calls) await this.deps.store.log(call).catch(() => undefined);
    }
  }

  private async outside(userId: string, timeZone: string | undefined) {
    const progress = await this.deps.loadProgress(userId);
    if (!progress) throw new HttpError(409, 'no_progress');
    const through = localDate(this.now().toISOString(), validZone(timeZone) ?? DEFAULT_ZONE);
    return { progress, through, nights: await this.deps.loadNights(userId, progress, through) };
  }

  private async context(
    userId: string,
    timeZone: string | undefined,
    outside: { progress: Progress; through: string; nights: readonly Night[] },
    calls: EngineEventRow[],
    db: Tx,
  ): Promise<Ctx> {
    const store = this.deps.store;
    const instant = this.now().toISOString();
    const stored = await store.person(userId, db);
    const tz = validZone(timeZone) ?? stored?.timeZone ?? DEFAULT_ZONE;
    const today = localDate(instant, tz);
    const person = stored
      ? refreshFromProgress({ ...stored, timeZone: tz }, outside.progress, today)
      : personFromProgress(outside.progress, { personId: userId, timeZone: tz, today });
    const since = new Date(Date.parse(instant) - DAY_MS).toISOString();
    const used = await store.callsSince({ userId }, since, 'llm.call', db);
    const reshapes = (await store.events(userId, ['ritual.reshaped'], since, db)).length;
    return {
      userId,
      progress: outside.progress,
      person: withNights(person, outside.nights),
      today,
      minute: localMinute(instant, tz),
      instant,
      versions: await store.versions(userId, db),
      decisions: await store.decisions(userId, db),
      client: used < CAPS.callsPerDay ? this.deps.client : null,
      reshapesLeft: CAPS.reshapesPerDay - reshapes,
      calls,
    };
  }

  private history(ctx: Ctx): PriorDecision[] {
    return ctx.decisions.map((d) => ({
      stackItemId: d.stackItemId,
      kind: d.kind,
      reason: d.reason,
      status: d.status,
      ...(d.answeredAt ? { answeredAt: d.answeredAt } : {}),
    }));
  }

  private decideNow(ctx: Ctx) {
    return decide({ person: ctx.person, stack: ctx.progress.items, catalog: this.deps.catalog, history: this.history(ctx), today: ctx.today });
  }

  private questions(ctx: Ctx) {
    return valuableQuestions({ person: ctx.person, stack: ctx.progress.items, catalog: this.deps.catalog, history: this.history(ctx), today: ctx.today });
  }

  private allowed(ctx: Ctx, extraWords: readonly string[] = []): Allowed {
    return {
      words: theirWords(ctx.person, ctx.progress.items, [...ctx.progress.asks.map((a) => a.a), ...extraWords]),
      stackItemIds: new Set(ctx.progress.items.filter((i) => i.status !== 'cut').map((i) => i.id)),
      ideaIds: new Set(this.deps.bank.ideas.filter((i) => i.certified).map((i) => i.id)),
      peopleIds: new Set(ctx.person.people.map((p) => p.id)),
      productNames: productNames(this.deps.catalog, ctx.progress),
    };
  }

  /** What a line may name: their own numbers and prices, and the people, places and things in their words. */
  private lineContext(ctx: Ctx, extra: readonly string[] = []) {
    const words = theirWords(ctx.person, ctx.progress.items, [...ctx.progress.asks.map((a) => a.a), ...extra]);
    return {
      allowedNumbers: allowedNumbersFrom(words, ...ctx.progress.items.map((i) => String(Math.round(i.monthlyCost)))),
      names: [
        ctx.person.name,
        ...ctx.person.people.map((p) => p.name),
        ...ctx.person.places.map((p) => p.name),
        ...ctx.progress.items.flatMap((i) => [i.label ?? '', i.customName ?? '', this.deps.catalog.item(i.itemKey)?.shortName ?? '']),
      ].filter(Boolean),
    };
  }

  private async setStatus(ctx: Ctx, id: string, status: RitualVersion['status'], tx: Tx) {
    await this.deps.store.setVersionStatus(ctx.userId, id, status, tx);
    ctx.versions = ctx.versions.map((v) => (v.id === id ? { ...v, status } : v));
  }

  private async saveVersion(ctx: Ctx, v: Omit<RitualVersion, 'id' | 'personId' | 'version' | 'createdAt'>, tx: Tx) {
    const version: RitualVersion = {
      ...v,
      id: randomUUID(),
      personId: ctx.userId,
      version: await this.deps.store.nextVersion(ctx.userId, tx),
      createdAt: this.now().toISOString(),
    };
    await this.deps.store.insertVersion(version, tx);
    ctx.versions = [...ctx.versions, version];
    return version;
  }

  /** Decide, word only what's new, and bring the stored proposals in line. */
  private async syncDecisions(ctx: Ctx, tx: Tx): Promise<Decided> {
    const decided = this.decideNow(ctx);
    const keyOf = (d: { stackItemId: string | null; kind: string }) => `${d.stackItemId ?? ''}:${d.kind}`;
    const open = new Map(ctx.decisions.filter((d) => d.status === 'proposed').map((d) => [keyOf(d), d]));
    // "No reason to change it" is nothing to say: no card, no line, no row. The rules still keep it.
    const said = decided.decisions.filter((d) => d.reason !== 'NOTHING_TO_CLEAR');
    const fresh = said.filter((d) => open.get(keyOf(d))?.reason !== d.reason);
    const worded = await wordDecisions(ctx.client, {
      person: ctx.person,
      decisions: fresh,
      catalog: this.deps.catalog,
      toneRules: this.deps.toneRules,
      lineContext: this.lineContext(ctx),
      today: ctx.today,
      stack: ctx.progress.items,
      asks: ctx.progress.asks,
    });
    this.logCall(ctx, 'word-decisions', WORD_VERSION, worded.usage, { dropped: worded.dropped });
    const lines = new Map(worded.decisions.map((d) => [d.key, d.line]));
    const all = said.map((d) => ({ ...d, line: lines.get(d.key) ?? open.get(keyOf(d))?.line ?? fallbackLine(d, this.deps.toneRules.bannedPhrases) }));
    const synced = await this.deps.store.syncDecisions(ctx.userId, all, this.stampFor(decided.decisions, WORD_VERSION), tx);
    if (synced.added.length || synced.withdrawn.length)
      await this.deps.store.log(
        { userId: ctx.userId, kind: 'decisions.synced', payload: { added: synced.added.map((d) => d.id), withdrawn: synced.withdrawn, trace: decided.trace } },
        tx,
      );
    ctx.decisions = await this.deps.store.decisions(ctx.userId, tx);
    return decided;
  }

  /**
   * The upkeep that keeps a week in step with their list: parts for things they let go leave, things
   * they marked theirs are locked, and newly kept things get a place, where the moment has room.
   */
  private upkeep(ctx: Ctx, decided: Decided, parts: readonly RitualPart[]) {
    const live = new Set(ctx.progress.items.filter((i) => i.status !== 'cut').map((i) => i.id));
    const ops: Op[] = [];
    const changes: Change[] = [];
    const ids: string[] = [];
    const active = parts.filter((p) => p.status === 'active');
    for (const p of active) {
      if (p.source.kind !== 'stack') continue;
      if (!live.has(p.source.stackItemId)) {
        ops.push({ op: 'remove', partId: p.id });
        changes.push({ op: 'remove', partId: p.id, reason: 'let go' });
      } else if (decided.theirsIds.includes(p.source.stackItemId) && p.lock !== 'theirs' && p.lock !== 'clinician') {
        ops.push({ op: 'lock', partId: p.id, lock: 'theirs' });
        changes.push({ op: 'lock', partId: p.id, reason: 'theirs' });
      }
    }
    // Ids already used, removed parts included, so something they took out never comes back.
    const seen = new Set(parts.map((p) => p.id));
    const placed = [...active];
    const skeleton = composeByRules({ person: ctx.person, stack: ctx.progress.items, decided, catalog: this.deps.catalog, firstCompose: false }).parts;
    for (const p of skeleton) {
      if (ids.length >= ADDS_PER_RUN || seen.has(p.id) || p.source.kind !== 'stack') continue;
      const crowded = placed.filter((q) => q.status === 'active' && q.when.slot === p.when.slot && sharesDay(q, p)).length >= MAX_PER_MOMENT;
      if (crowded) continue;
      ops.push({ op: 'add', part: newPartOf(p) });
      if (p.lock) ops.push({ op: 'lock', partId: p.id, lock: p.lock });
      changes.push({ op: 'add', partId: p.id, reason: 'kept' });
      ids.push(p.id);
      placed.push(p);
    }
    return { ops, changes, ids };
  }

  /**
   * After the base week changes from today, accepted weeks that start later (a plan from Monday)
   * get the same edits, so neither change hides the other.
   */
  private async rebaseFuture(ctx: Ctx, ops: readonly Op[], ids: readonly string[], tx: Tx) {
    const future = ctx.versions.filter((v) => v.status === 'accepted' && v.scope.kind === 'base' && v.scope.effectiveFrom > ctx.today);
    for (const f of future) {
      const parts = applyOps(f.parts, ops, { scope: 'base', newId: idQueue(ids) }).parts;
      await this.saveVersion(
        ctx,
        { parentId: f.id, scope: f.scope, parts, ops: [...ops], changes: [], cause: { eventId: null, trigger: 'refresh' }, status: 'accepted', engine: f.engine },
        tx,
      );
      await this.setStatus(ctx, f.id, 'superseded', tx);
    }
  }

  /** Keeps the week in step with their list. A Ritual they haven't said yes to yet is updated in place. */
  private async syncBase(ctx: Ctx, decided: Decided, trigger: 'decision' | 'refresh', tx: Tx) {
    const accepted = baseOn(ctx.versions, ctx.today);
    const target = accepted ?? newestProposedBase(ctx.versions);
    if (!target) return null;
    const { ops, changes, ids } = this.upkeep(ctx, decided, target.parts);
    if (!ops.length) return null;
    const parts = applyOps(target.parts, ops, { scope: 'base', newId: idQueue(ids) }).parts;
    const engine = this.stampFor({ ops });
    if (!accepted) {
      const v = await this.saveVersion(
        ctx,
        {
          parentId: target.parentId,
          scope: target.scope,
          parts,
          ops: [...target.ops, ...ops],
          changes: [...target.changes, ...changes],
          cause: target.cause,
          status: 'proposed',
          ...(target.reply ? { reply: target.reply } : {}),
          engine,
        },
        tx,
      );
      await this.setStatus(ctx, target.id, 'superseded', tx);
      return v;
    }
    const v = await this.saveVersion(
      ctx,
      { parentId: target.id, scope: { kind: 'base', effectiveFrom: ctx.today }, parts, ops, changes, cause: { eventId: null, trigger }, status: 'accepted', engine },
      tx,
    );
    await this.rebaseFuture(ctx, ops, ids, tx);
    return v;
  }

  /** The first Ritual: rules place everything, Claude shapes it, and it waits for their yes. */
  private async composeFirst(ctx: Ctx, decided: Decided, tx: Tx) {
    const rules = composeByRules({ person: ctx.person, stack: ctx.progress.items, decided, catalog: this.deps.catalog, firstCompose: true });
    const kept = this.keptRitual(ctx);
    // Everything that's locked (theirs, from a clinician) has to be in it, exactly as the rules say.
    const whole = kept && rules.parts.filter((p) => p.lock && p.source.kind === 'stack').every((p) => kept.some((k) => k.source.kind === 'stack' && p.source.kind === 'stack' && k.source.stackItemId === p.source.stackItemId));
    if (kept && whole) {
      const v = await this.saveVersion(
        ctx,
        {
          parentId: null,
          scope: { kind: 'base', effectiveFrom: ctx.today },
          parts: kept,
          ops: [],
          changes: [],
          cause: { eventId: null, trigger: 'onboarding' },
          status: 'proposed',
          engine: this.stampFor({ parts: kept }),
        },
        tx,
      );
      await this.deps.store.log({ userId: ctx.userId, kind: 'ritual.composed', payload: { versionId: v.id, from: 'kept', parts: v.parts.length } }, tx);
      return v;
    }
    const shaped = await composeRitual(ctx.client, {
      person: ctx.person,
      rules,
      allowed: this.allowed(ctx),
      toneRules: this.deps.toneRules,
      lineContext: this.lineContext(ctx),
      firstCompose: true,
      today: ctx.today,
      stack: ctx.progress.items,
      asks: ctx.progress.asks,
      newId: () => `part:${randomUUID()}`,
    });
    this.logCall(ctx, 'compose', COMPOSE_VERSION, shaped.usage, { from: shaped.from, problems: shaped.problems?.slice(0, 5) ?? [] });
    const v = await this.saveVersion(
      ctx,
      {
        parentId: null,
        scope: { kind: 'base', effectiveFrom: ctx.today },
        // When Claude isn't the one who shaped it, the rules say it as fully as they can: never a bare list.
        parts:
          shaped.from === 'claude'
            ? shaped.parts
            : wholeRitual(shaped.parts, ctx.progress, decided.decisions, {
                evidenceFor: (key) => (key ? this.deps.catalog.item(key)?.evidenceFor : undefined),
                banned: this.deps.toneRules.bannedPhrases,
              }).parts,
        ops: [],
        changes: [],
        cause: { eventId: null, trigger: 'onboarding' },
        status: 'proposed',
        ...(shaped.summary ? { reply: shaped.summary.slice(0, 600) } : {}),
        engine: this.stampFor({ parts: rules.parts }, shaped.from === 'claude' ? COMPOSE_VERSION : undefined, shaped.usage?.model),
      },
      tx,
    );
    await this.deps.store.log({ userId: ctx.userId, kind: 'ritual.composed', payload: { versionId: v.id, from: shaped.from, parts: v.parts.length } }, tx);
    return v;
  }

  /** The Ritual they said "Make it mine" to, when it's still for the list they have. */
  private keptRitual(ctx: Ctx): RitualPart[] | null {
    const kept = ctx.progress.firstRitual;
    if (!kept || kept.list !== firstRitualList(ctx.progress)) return null;
    const parsed = z.array(ritualPartSchema).safeParse(kept.parts);
    if (!parsed.success || !parsed.data.length) return null;
    const live = new Set(ctx.progress.items.filter((i) => i.status !== 'cut').map((i) => i.id));
    return parsed.data.every((p) => p.source.kind !== 'stack' || live.has(p.source.stackItemId)) ? parsed.data : null;
  }

  /**
   * What their onboarding words teach, read once, just after their first Ritual is in place. Claude
   * runs outside the lock: it can take half a minute and nothing else should wait on it.
   */
  async readLater(userId: string, opts: { timeZone?: string } = {}): Promise<EngineResult> {
    const plan = await this.locked(userId, opts.timeZone, async (ctx, tx) => {
      const done = await this.deps.store.events(userId, ['person.read'], '2000-01-01T00:00:00Z', tx);
      if (done.length || !ctx.client) return { state: await this.stateFrom(ctx, tx), read: null };
      const words = theirWords(ctx.person, ctx.progress.items, ctx.progress.asks.map((a) => a.a));
      if (!words.trim()) {
        await this.deps.store.log({ userId, kind: 'person.read', payload: { length: 0 } }, tx);
        return { state: await this.stateFrom(ctx, tx), read: null };
      }
      return { state: null, read: { client: ctx.client, person: ctx.person, stack: ctx.progress.items, words, today: ctx.today, at: ctx.instant } };
    });
    if (!plan.read) return { state: plan.state! };
    const { client, person, stack, words, today, at } = plan.read;
    const learned = await updatePerson(client, {
      person,
      stack,
      catalog: this.deps.catalog,
      banned: this.deps.toneRules.bannedPhrases,
      kind: 'onboarding',
      text: words,
      today,
      at,
    });
    return this.locked(userId, opts.timeZone, async (ctx, tx) => {
      this.logCall(ctx, 'update-person', UPDATE_VERSION, learned.usage, { applied: learned.applied.length, dropped: learned.dropped.length, later: true });
      const again = await this.deps.store.events(userId, ['person.read'], '2000-01-01T00:00:00Z', tx);
      if (!again.length) {
        const patch = applyPersonOps(ctx.person, learned.applied, words, { today: ctx.today, at: ctx.instant, from: 'onboarding' });
        if (patch.applied.length) {
          ctx.person = patch.person;
          await this.deps.store.savePerson(userId, ctx.person, 'engine', tx);
          await this.deps.store.log({ userId, kind: 'person.updated', payload: { ops: patch.applied, from: 'onboarding' } }, tx);
          await this.syncDecisions(ctx, tx);
        }
        await this.deps.store.log({ userId, kind: 'person.read', payload: { length: words.length, later: true } }, tx);
      }
      return { state: await this.stateFrom(ctx, tx) };
    });
  }

  /** Learns from their words: a note, an answer or a message. Feelings about their things need their yes. */
  /**
   * Their first Ritual: Claude reads everything they've told us (ideal day, answers, every note)
   * before the rules decide anything, so "Kate hates it. I hate it.", "makes me jittery" and "only
   * on travel nights" shape what Distill does. Once per person.
   */
  private async readEverything(ctx: Ctx, tx: Tx) {
    if (!ctx.client) return;
    const done = await this.deps.store.events(ctx.userId, ['person.read'], '2000-01-01T00:00:00Z', tx);
    if (done.length) return;
    const words = theirWords(ctx.person, ctx.progress.items, ctx.progress.asks.map((a) => a.a));
    if (words.trim()) await this.learn(ctx, tx, 'onboarding', words);
    await this.deps.store.log({ userId: ctx.userId, kind: 'person.read', payload: { length: words.length } }, tx);
  }

  private async learn(ctx: Ctx, tx: Tx, kind: 'note' | 'answer' | 'message' | 'onboarding', text: string, extra: { question?: string; stackItemId?: string } = {}) {
    const learned = await updatePerson(ctx.client, {
      person: ctx.person,
      stack: ctx.progress.items,
      catalog: this.deps.catalog,
      banned: this.deps.toneRules.bannedPhrases,
      kind,
      text,
      ...(extra.question ? { question: extra.question } : {}),
      ...(extra.stackItemId ? { stackItemId: extra.stackItemId } : {}),
      today: ctx.today,
      at: ctx.instant,
    });
    this.logCall(ctx, 'update-person', UPDATE_VERSION, learned.usage, { applied: learned.applied.length, dropped: learned.dropped.length });
    if (learned.applied.length) {
      ctx.person = learned.person;
      await this.deps.store.log({ userId: ctx.userId, kind: 'person.updated', payload: { ops: learned.applied, from: kind } }, tx);
    }
    // What's going on with their body is never lost: if Claude is off or missed it, the plain words still count.
    let readByCode = 0;
    if (kind !== 'onboarding' && !learned.applied.some((op) => op.op === 'now')) {
      const floor = applyPersonOps(ctx.person, nowFromWords(text, ctx.today), text, { today: ctx.today, at: ctx.instant, from: kind });
      if (floor.applied.length) {
        ctx.person = floor.person;
        readByCode = floor.applied.length;
        await this.deps.store.log({ userId: ctx.userId, kind: 'person.updated', payload: { ops: floor.applied, from: kind, by: 'words' } }, tx);
      }
    }
    return { applied: learned.applied.length + readByCode, ask: learned.ask };
  }

  async run(userId: string, event: EngineEvent, opts: { timeZone?: string } = {}): Promise<EngineResult> {
    return this.locked(userId, opts.timeZone, async (ctx, tx) => {
      const store = this.deps.store;
      const eventId = await store.log({ userId, kind: `event.${event.kind}`, payload: redact(event) }, tx);
      let reply: string | undefined;
      let versionId: string | undefined;
      let stackChange: EngineResult['stackChange'];
      let ask: EngineResult['ask'];
      let swap: SwapOffer | undefined;
      const say = async (text: string, version?: string) => {
        reply = text;
        if (version) versionId = version;
        await store.addMessage(userId, { role: 'companion', text, at: this.after(ctx), ...(version ? { ritualVersionId: version } : {}) }, tx);
      };

      switch (event.kind) {
        case 'onboarding':
        case 'stack-change':
        case 'refresh': {
          const anyBase = ctx.versions.some((v) => v.scope.kind === 'base' && (v.status === 'accepted' || v.status === 'proposed'));
          // The Ritual they already said yes to needs no second think: what their words teach is read just after.
          if (!anyBase && !this.keptRitual(ctx)) await this.readEverything(ctx, tx);
          const decided = await this.syncDecisions(ctx, tx);
          const v = anyBase ? await this.syncBase(ctx, decided, event.kind === 'refresh' ? 'refresh' : 'decision', tx) : await this.composeFirst(ctx, decided, tx);
          if (v) versionId = v.id;
          break;
        }
        case 'note':
        case 'answer': {
          const learned =
            event.kind === 'note'
              ? await this.learn(ctx, tx, 'note', event.text, { stackItemId: event.stackItemId })
              : await this.learn(ctx, tx, 'answer', event.a, { question: event.q, ...(event.stackItemId ? { stackItemId: event.stackItemId } : {}) });
          if (learned.ask.length) ask = learned.ask;
          const decided = await this.syncDecisions(ctx, tx);
          versionId = (await this.syncBase(ctx, decided, 'decision', tx))?.id;
          break;
        }
        case 'question-answer':
        case 'confirm': {
          const id = event.stackItemId;
          if (event.kind === 'question-answer')
            await store.log({ userId, kind: 'question.answered', payload: { questionId: event.questionId, label: event.label, ...(event.attachment ? { attachment: event.attachment } : {}) } }, tx);
          if (event.attachment && id) {
            if (!ctx.progress.items.some((i) => i.id === id)) throw new HttpError(404, 'no_such_item');
            const current = ctx.person.values[id];
            // "Theirs" is final: a later tap never turns it back into something to decide about.
            if (current?.attachment !== 'theirs') {
              ctx.person = {
                ...ctx.person,
                version: ctx.person.version + 1,
                values: { ...ctx.person.values, [id]: { attachment: event.attachment, reasons: current?.reasons ?? [], from: 'tap' } },
              };
              await store.log({ userId, kind: 'attachment.confirmed', payload: { stackItemId: id, attachment: event.attachment } }, tx);
            }
          }
          const decided = await this.syncDecisions(ctx, tx);
          versionId = (await this.syncBase(ctx, decided, 'decision', tx))?.id;
          break;
        }
        case 'decision-answer': {
          const answered = await store.answerDecision(userId, event.decisionId, event.answer, tx);
          if (!answered) throw new HttpError(404, 'no_open_decision');
          await store.log({ userId, kind: 'decision.answered', payload: { decisionId: answered.id, kind: answered.kind, reason: answered.reason, answer: event.answer } }, tx);
          // A yes to "worth a look?" says it came from the noise: decide then offers the clear.
          if (event.answer === 'yes' && answered.reason === 'WORTH_A_LOOK' && answered.stackItemId) {
            const current = ctx.person.values[answered.stackItemId];
            if (current?.attachment !== 'theirs' && current?.attachment !== 'loved')
              ctx.person = {
                ...ctx.person,
                version: ctx.person.version + 1,
                values: { ...ctx.person.values, [answered.stackItemId]: { attachment: 'borrowed', reasons: current?.reasons ?? [], from: 'tap' } },
              };
          }
          if (event.answer === 'theirs' && answered.stackItemId) {
            const current = ctx.person.values[answered.stackItemId];
            ctx.person = {
              ...ctx.person,
              version: ctx.person.version + 1,
              values: { ...ctx.person.values, [answered.stackItemId]: { attachment: 'theirs', reasons: current?.reasons ?? [], from: 'tap' } },
            };
          }
          ctx.decisions = await store.decisions(userId, tx);
          const decided = await this.syncDecisions(ctx, tx);
          versionId = (await this.syncBase(ctx, decided, 'decision', tx))?.id;
          break;
        }
        case 'message': {
          await store.addMessage(userId, { role: 'person', text: event.text, at: ctx.instant }, tx);
          const titles = ritualOn(ctx.versions, ctx.today).parts.map((p) => p.title);
          const read = await classifyMessage(ctx.client, { text: event.text, person: ctx.person, instant: ctx.instant, today: ctx.today, minute: ctx.minute, ritualTitles: titles });
          this.logCall(ctx, 'classify', CLASSIFY_VERSION, read.usage);
          // With Haiku off or failed, the plainest messages are still read, so they still change something.
          const c = read.ok ? read.data : readByWords(event.text);
          if (c?.safety === 'crisis') {
            // Never reshapes, never learns: a person who may be in danger gets a person.
            await store.log({ userId, kind: 'safety.crisis', payload: { eventId, needsHuman: true } }, tx);
            await say(CRISIS_REPLY);
            break;
          }
          if (c?.safety === 'clinical') {
            if (c.condition) await this.learn(ctx, tx, 'message', event.text);
            // Claude says it warmly, in their terms; the fixed line is only the stand-in.
            const r = await replyTo(ctx.client, {
              person: ctx.person,
              message: event.text,
              clinical: true,
              toneRules: this.deps.toneRules,
              lineContext: this.lineContext(ctx, [event.text]),
              today: ctx.today,
            });
            this.logCall(ctx, 'reply', REPLY_VERSION, r.usage, { from: r.from, clinical: true, problems: r.problems?.slice(0, 5) ?? [] });
            await say(r.reply);
            break;
          }
          // Said about one thing ("Or tell me in your words"): what they say is about that thing.
          // What their words teach and what changes in their days are asked for together, so telling
          // Distill something takes as long as the slower of the two, not both.
          const learning = this.learn(ctx, tx, 'message', event.text, event.about ? { stackItemId: event.about } : {});
          const reshaping =
            c?.trigger && ctx.reshapesLeft > 0
              ? this.reshapeFrom(
                  ctx,
                  {
                    kind: c.trigger.kind === 'plan' ? 'plan' : 'message',
                    when: c.trigger.when,
                    modelDates: c.trigger.dates,
                    moments: c.trigger.moments,
                    durability: c.trigger.durability,
                    load: c.trigger.load,
                    message: event.text,
                    eventId,
                  },
                  tx,
                )
              : null;
          const [learned, reshaped] = await Promise.all([learning, reshaping]);
          if (learned.ask.length) ask = learned.ask;
          if (learned.applied) await this.syncDecisions(ctx, tx);
          if (reshaped) {
            await say(reshaped.reply, reshaped.versionId);
            break;
          }
          if (c?.intent === 'stack-change' && c.stack) {
            const match = matchItem(ctx.progress, this.deps.catalog, c.stack.name);
            stackChange = { action: c.stack.action, name: c.stack.name, ...(match ? { stackItemId: match } : {}) };
          }
          const asking = c ? c.intent === 'question' || (c.intent === 'chat' && QUESTIONISH.test(event.text)) : QUESTIONISH.test(event.text);
          const found = await this.aboutFor(ctx, event, asking, tx);
          // The catalog's reviewed answer only for a question ("Why let AG1 go?"); something they told us
          // about it ("I eat maybe half of them") is thanked, and Claude, when on, reads it.
          const followUp = found ? await this.followUpFor(ctx, found.item, found.via !== 'named' && QUESTIONISH.test(event.text), tx) : undefined;
          if (found && followUp) {
            await store.log({ userId, kind: 'message.about', payload: { stackItemId: found.item.id, via: found.via } }, tx);
            swap = followUp.swap;
          }
          const r = await replyTo(ctx.client, {
            person: ctx.person,
            message: event.text,
            ...(followUp ? { followUp: followUp.about } : {}),
            toneRules: this.deps.toneRules,
            lineContext: this.lineContext(ctx, [event.text]),
            today: ctx.today,
          });
          this.logCall(ctx, 'reply', REPLY_VERSION, r.usage, { from: r.from, problems: r.problems?.slice(0, 5) ?? [] });
          await say(r.reply);
          break;
        }
        case 'night': {
          const nights = [...ctx.person.signals.lastNights.filter((n) => n.date !== event.date), { date: event.date, sleepMin: event.sleepMin }];
          ctx.person = withNights(ctx.person, nights);
          const check = nightTrigger(ctx.person, { today: ctx.today, ...(await this.lastNightReshape(ctx, tx)) });
          await store.log({ userId, kind: 'night.checked', payload: { date: event.date, fire: check.fire, why: check.why } }, tx);
          if (check.fire && ctx.reshapesLeft > 0) {
            const r = await this.reshapeFrom(ctx, { kind: 'night', moments: ['morning'], durability: 'once', load: 'lighter', eventId }, tx);
            if (r.versionId) await say(r.reply, r.versionId);
          }
          break;
        }
        case 'edit': {
          versionId = (await this.personEdit(ctx, event, tx)).id;
          break;
        }
        case 'part': {
          if (event.date > ctx.today || daysBetween(event.date, ctx.today) > 7) throw new HttpError(400, 'date_out_of_range');
          if (!ritualOn(ctx.versions, event.date).parts.some((p) => p.id === event.partId)) throw new HttpError(404, 'no_such_part');
          await store.log({ userId, kind: event.done ? 'part.done' : 'part.skipped', payload: { partId: event.partId, date: event.date } }, tx);
          if (!event.done && ctx.reshapesLeft > 0) {
            const slips = await this.slipCheck(ctx, tx);
            if (slips.length) {
              const r = await this.reshapeFrom(ctx, { kind: 'slip', moments: slips.map((s) => s.moment), durability: 'ongoing', load: 'lighter', eventId }, tx);
              if (r.versionId) await say(r.reply, r.versionId);
            }
          }
          break;
        }
      }
      await store.savePerson(userId, ctx.person, 'engine', tx);
      return {
        state: await this.stateFrom(ctx, tx),
        ...(reply ? { reply } : {}),
        ...(versionId ? { versionId } : {}),
        ...(stackChange ? { stackChange } : {}),
        ...(ask ? { ask } : {}),
        ...(swap ? { swap } : {}),
      };
    });
  }

  /**
   * The thing a message is about: the card they tapped Why? on; the thing they named, when they're
   * asking; or, for a short follow-up ("why?", "how do I fit this in?"), what they last asked about
   * or today's card, whichever came later.
   */
  private async aboutFor(
    ctx: Ctx,
    event: Extract<EngineEvent, { kind: 'message' }>,
    asking: boolean,
    tx: Tx,
  ): Promise<{ item: Progress['items'][number]; via: 'card' | 'named' | 'follow-up' } | undefined> {
    const items = ctx.progress.items;
    if (event.about) {
      const hit = items.find((i) => i.id === event.about);
      if (hit) return { item: hit, via: 'card' };
    }
    if (!asking) return undefined;
    const named = matchItem(ctx.progress, this.deps.catalog, event.text);
    const hit = items.find((i) => i.id === named);
    if (hit) return { item: hit, via: 'named' };
    if (!isFollowUp(event.text)) return undefined;
    const since = new Date(Date.parse(ctx.instant) - FOLLOW_UP_MS).toISOString();
    const recent = await this.deps.store.events(ctx.userId, ['message.about', 'today.shown'], since, tx);
    for (const e of [...recent].sort((a, b) => a.at.localeCompare(b.at)).reverse()) {
      const id = e.kind === 'message.about' ? String(e.payload.stackItemId) : e.payload.date === ctx.today ? this.cardItem(ctx, e.payload.pick) : undefined;
      const back = id ? items.find((i) => i.id === id) : undefined;
      if (back) return { item: back, via: 'follow-up' };
    }
    return undefined;
  }

  /** The item behind a card that was shown: a decision's, or a question's (`q:${id}:${variable}`). */
  private cardItem(ctx: Ctx, pick: unknown): string | undefined {
    const p = pick as { kind?: string; ref?: string } | null;
    if (!p?.ref) return undefined;
    if (p.kind === 'question') return p.ref.startsWith('q:') ? p.ref.slice(2, p.ref.lastIndexOf(':')) : undefined;
    return ctx.decisions.find((d) => d.id === p.ref)?.stackItemId ?? undefined;
  }

  /**
   * Everything a fuller answer needs about one thing on their list, and the swap to offer with it.
   * `fixed`: with Claude off, answer in the catalog's reviewed words. Only for a card they tapped or
   * followed up on; a free-text question about something waits for Claude, which can fit the answer
   * to them.
   */
  private async followUpFor(ctx: Ctx, item: Progress['items'][number], fixed: boolean, tx: Tx): Promise<{ about: ReplyAbout; swap?: SwapOffer } | undefined> {
    const view = this.deps.catalog.item(item.itemKey);
    if (!view) return undefined;
    const standing: ItemStandingNote =
      item.status === 'cut'
        ? 'let-go'
        : (standingsOf([item], this.decideNow(ctx), ctx.decisions.filter((d) => d.status === 'proposed'), ctx.decisions)[item.id] ?? 'open');
    const offerSwap = standing === 'clear' || standing === 'let-go';
    const swap = offerSwap ? await this.swapFor(ctx, item.id, tx) : undefined;
    return {
      about: {
        view,
        name: item.label || item.customName || view.shortName || view.name,
        standing,
        conditions: new Set(ctx.person.constraints.conditions.map((c) => c.condition)),
        offerSwap,
        fixed,
      },
      ...(swap ? { swap } : {}),
    };
  }

  /** The catalog's swap for this item, unless it's already in their Ritual or they said no to it. */
  private async swapFor(ctx: Ctx, stackItemId: string, tx: Tx): Promise<SwapOffer | undefined> {
    const item = ctx.progress.items.find((i) => i.id === stackItemId);
    const view = this.deps.catalog.item(item?.itemKey);
    if (!item || !view?.swap) return undefined;
    const base = baseOn(ctx.versions, ctx.today);
    if (!base || base.parts.some((p) => p.id === swapPartId(view.key) && p.status === 'active')) return undefined;
    const declined = await this.deps.store.events(ctx.userId, ['swap.declined'], '2000-01-01T00:00:00Z', tx);
    if (declined.some((e) => e.payload.itemKey === view.key)) return undefined;
    return { itemKey: view.key, stackItemId, title: view.swap.title, slot: view.swap.slot, perWeek: view.swap.perWeek };
  }

  private async lastNightReshape(ctx: Ctx, tx: Tx) {
    const since = new Date(Date.parse(ctx.instant) - 4 * DAY_MS).toISOString();
    const recent = await this.deps.store.events(ctx.userId, ['ritual.reshaped'], since, tx);
    const night = recent.filter((e) => e.payload.trigger === 'night').at(-1);
    return night ? { lastNightReshape: String(night.payload.date ?? night.at.slice(0, 10)) } : {};
  }

  private async slipCheck(ctx: Ctx, tx: Tx) {
    const since = new Date(Date.parse(ctx.instant) - 9 * DAY_MS).toISOString();
    const events = await this.deps.store.events(ctx.userId, ['part.done', 'part.skipped', 'ritual.reshaped'], since, tx);
    const checks = events
      .filter((e) => e.kind !== 'ritual.reshaped')
      .map((e) => ({ partId: String(e.payload.partId), date: String(e.payload.date), done: e.kind === 'part.done' }));
    const lastSlip: Partial<Record<Moment, string>> = {};
    for (const e of events)
      if (e.kind === 'ritual.reshaped' && e.payload.trigger === 'slip')
        for (const m of (e.payload.moments as Moment[] | undefined) ?? []) lastSlip[m] = e.at.slice(0, 10);
    return slipTrigger((date) => ritualOn(ctx.versions, date).parts, checks, { today: ctx.today, lastSlip });
  }

  /** A change from their words or their data: scoped by rules, proposed by Claude, checked by code, saved. */
  private async reshapeFrom(
    ctx: Ctx,
    t: {
      kind: 'message' | 'plan' | 'night' | 'slip';
      when?: Parameters<typeof resolveWhen>[0];
      modelDates?: readonly string[];
      moments: readonly Moment[];
      durability: 'once' | 'ongoing';
      load: 'lighter' | 'same' | 'heavier';
      message?: string;
      eventId: string;
    },
    tx: Tx,
  ): Promise<{ reply: string; versionId?: string }> {
    if (!baseOn(ctx.versions, ctx.today)) return { reply: FIXED_LINES.noRitualYet };
    const fromData = t.kind === 'night' || t.kind === 'slip';
    const resolved = fromData
      ? { dates: [ctx.today], startsOn: ctx.today, source: 'code' as const, disagreed: false }
      : resolveWhen(t.when ?? null, t.modelDates ?? [], { today: ctx.today, minute: ctx.minute });
    if (resolved?.disagreed)
      await this.deps.store.log({ userId: ctx.userId, kind: 'dates.disagreed', payload: { when: t.when ?? null, model: t.modelDates ?? [], code: resolved.dates } }, tx);
    const decided = this.decideNow(ctx);
    const scope = scopeTrigger({
      kind: t.kind,
      dates: resolved?.dates ?? [ctx.today],
      moments: t.moments,
      durability: t.durability,
      load: t.load,
      today: ctx.today,
      versions: ctx.versions,
      theirsItemIds: decided.theirsIds,
      clinicianItemIds: decided.clinicianIds,
      protectedItemIds: decided.protectedIds,
    });
    const anyParts = scope.targets.some((x) => x.parts.length);
    if (!anyParts && t.load !== 'lighter') return { reply: FIXED_LINES.nothingToMove };
    // An empty day can still get lighter: the rules add the slow start, with no model to pay for.
    const r = await reshape(anyParts ? ctx.client : null, {
      person: ctx.person,
      ...(t.message ? { message: t.message } : {}),
      trigger: { kind: t.kind, durability: t.durability, load: t.load, moments: t.moments },
      scope,
      allowed: this.allowed(ctx, t.message ? [t.message] : []),
      toneRules: this.deps.toneRules,
      lineContext: this.lineContext(ctx, t.message ? [t.message] : []),
      today: ctx.today,
      asks: ctx.progress.asks,
      minute: ctx.minute,
    });
    this.logCall(ctx, 'reshape', RESHAPE_VERSION, r.usage, { from: r.from, problems: r.problems?.slice(0, 5) ?? [] });
    if (r.from === 'fallback') return { reply: r.reply };
    // Out late tonight: tonight's "In bed by 11" steps aside too, not only tomorrow's morning.
    const dates = resolved?.dates ?? [ctx.today];
    const outTonight = t.kind !== 'night' && t.load === 'lighter' && dates.length === 1 && dates[0] === ctx.today && t.moments.length > 0 && t.moments.every((m) => m === 'night') && !r.opsByDate[ctx.today];
    const bedTonight = outTonight && scope.kind === 'day' ? ritualOn(ctx.versions, ctx.today).parts.find((p) => isBedPart(p) && !p.lock) : undefined;
    const opsByDate: Readonly<Record<string, readonly Op[]>> = bedTonight ? { [ctx.today]: [{ op: 'skip', partId: bedTonight.id }], ...r.opsByDate } : r.opsByDate;
    const engine = this.stampFor({ scope, message: t.message ?? null }, RESHAPE_VERSION, r.usage?.model);
    const changesOf = (ops: readonly Op[]): Change[] => ops.map((o) => ({ op: o.op, partId: 'partId' in o ? o.partId : 'new', reason: t.kind }));
    const trigger: RitualVersion['cause']['trigger'] = t.kind;
    let saved: RitualVersion | undefined;
    if (scope.kind === 'base') {
      if (!r.baseOps.length) return { reply: r.reply };
      const from = scope.effectiveFrom ?? ctx.today;
      const base = baseOn(ctx.versions, from)!;
      const parts = applyOps(base.parts, r.baseOps, { scope: 'base', newId: () => `part:${randomUUID()}` }).parts;
      // An ongoing change waits for their yes, and replaces any earlier change still waiting.
      for (const old of ctx.versions.filter((v) => v.status === 'proposed' && v.scope.kind === 'base' && v.parentId))
        await this.setStatus(ctx, old.id, 'superseded', tx);
      saved = await this.saveVersion(
        ctx,
        { parentId: base.id, scope: { kind: 'base', effectiveFrom: from }, parts, ops: [...r.baseOps], changes: changesOf(r.baseOps), cause: { eventId: t.eventId, trigger }, status: 'proposed', reply: r.reply.slice(0, 600), engine },
        tx,
      );
    } else {
      for (const [date, ops] of Object.entries(opsByDate)) {
        if (!ops.length) continue;
        const previous = ritualOn(ctx.versions, date).day;
        saved = await this.saveVersion(
          ctx,
          { parentId: previous?.id ?? null, scope: { kind: 'day', date }, parts: [], ops: [...(previous?.ops ?? []), ...ops], changes: changesOf(ops), cause: { eventId: t.eventId, trigger }, status: 'accepted', reply: r.reply.slice(0, 600), engine },
          tx,
        );
      }
    }
    await this.deps.store.log(
      {
        userId: ctx.userId,
        kind: 'ritual.reshaped',
        payload: { versionId: saved?.id ?? null, trigger: t.kind, moments: t.moments, date: resolved?.startsOn ?? ctx.today, scope: scope.kind, ops: scope.kind === 'base' ? r.baseOps : r.opsByDate, promptVersion: RESHAPE_VERSION },
      },
      tx,
    );
    return { reply: r.reply, ...(saved ? { versionId: saved.id } : {}) };
  }

  /** Their own edits apply at once with no model: their edit wins, within what is theirs to change. */
  private async personEdit(ctx: Ctx, event: Extract<EngineEvent, { kind: 'edit' }>, tx: Tx) {
    const date = event.date ?? ctx.today;
    if (date < ctx.today) throw new HttpError(400, 'past_days_stay');
    const base = baseOn(ctx.versions, date);
    if (!base) throw new HttpError(409, 'no_ritual');
    const allowed = this.allowed(ctx);
    const guarded = { locked: new Set<string>(), protected: new Set<string>() };
    const newIds = event.ops.filter((o) => o.op === 'add' || o.op === 'swap').map(() => `part:${randomUUID()}`);
    const changes = event.ops.map((o) => ({ op: o.op, partId: 'partId' in o ? o.partId : 'new', reason: 'their edit' }));
    if (event.scope === 'base') {
      const errors = validateOps({ scope: 'base', before: base.parts.filter((p) => p.status === 'active'), ops: event.ops, actor: 'person', guarded, allowed });
      if (errors.length) throw new HttpError(400, errors[0]!.slice(0, 120));
      const parts = applyOps(base.parts, event.ops, { scope: 'base', newId: idQueue(newIds) }).parts;
      const v = await this.saveVersion(
        ctx,
        { parentId: base.id, scope: { kind: 'base', effectiveFrom: date }, parts, ops: [...event.ops], changes, cause: { eventId: null, trigger: 'edit' }, status: 'accepted', engine: this.stampFor(event.ops) },
        tx,
      );
      await this.rebaseFuture(ctx, event.ops, newIds, tx);
      await this.deps.store.log({ userId: ctx.userId, kind: 'ritual.edited', payload: { versionId: v.id, scope: 'base', ops: event.ops } }, tx);
      return v;
    }
    const day = ritualOn(ctx.versions, date);
    const errors = validateOps({ scope: 'day', before: [...day.parts], ops: event.ops, actor: 'person', guarded, allowed, date, load: 'heavier' });
    if (errors.length) throw new HttpError(400, errors[0]!.slice(0, 120));
    const v = await this.saveVersion(
      ctx,
      { parentId: day.day?.id ?? null, scope: { kind: 'day', date }, parts: [], ops: [...(day.day?.ops ?? []), ...event.ops], changes, cause: { eventId: null, trigger: 'edit' }, status: 'accepted', engine: this.stampFor(event.ops) },
      tx,
    );
    await this.deps.store.log({ userId: ctx.userId, kind: 'ritual.edited', payload: { versionId: v.id, scope: 'day', date, ops: event.ops } }, tx);
    return v;
  }

  /** Accept a proposed week: the first Ritual ("This is my Ritual"), or an ongoing change. */
  async accept(userId: string, versionId: string, opts: { timeZone?: string } = {}): Promise<EngineResult> {
    return this.locked(userId, opts.timeZone, async (ctx, tx) => {
      const v = ctx.versions.find((x) => x.id === versionId);
      if (!v || v.status !== 'proposed' || v.scope.kind !== 'base') throw new HttpError(404, 'nothing_to_accept');
      await this.setStatus(ctx, v.id, 'accepted', tx);
      for (const other of ctx.versions)
        if (other.status === 'proposed' && other.scope.kind === 'base') await this.setStatus(ctx, other.id, 'superseded', tx);
      await this.deps.store.log({ userId, kind: 'ritual.accepted', payload: { versionId: v.id, first: !v.parentId } }, tx);
      // Anything that changed on their list while it waited joins now.
      await this.syncBase(ctx, this.decideNow(ctx), 'decision', tx);
      return { state: await this.stateFrom(ctx, tx) };
    });
  }

  /** Undo the newest change to a day, or the newest change to the week, within a day of making it. */
  async undo(userId: string, versionId: string, opts: { timeZone?: string } = {}): Promise<EngineResult> {
    return this.locked(userId, opts.timeZone, async (ctx, tx) => {
      const v = ctx.versions.find((x) => x.id === versionId);
      if (!v || (v.status !== 'accepted' && v.status !== 'proposed')) throw new HttpError(404, 'nothing_to_undo');
      if (v.status === 'accepted') {
        if (!UNDOABLE.includes(v.cause.trigger)) throw new HttpError(409, 'not_undoable');
        if (Date.parse(ctx.instant) - Date.parse(v.createdAt) > DAY_MS) throw new HttpError(409, 'too_late_to_undo');
        const same = ctx.versions.filter(
          (x) => x.status === 'accepted' && x.scope.kind === v.scope.kind && (v.scope.kind === 'base' || (x.scope.kind === 'day' && x.scope.date === v.scope.date)),
        );
        if (same.at(-1)?.id !== v.id) throw new HttpError(409, 'only_the_newest_change');
      } else if (!v.parentId) throw new HttpError(409, 'first_ritual_stays');
      await this.setStatus(ctx, v.id, 'undone', tx);
      // One message can change more than one day: Undo takes all of it back.
      if (v.scope.kind === 'day' && v.cause.eventId)
        for (const other of ctx.versions)
          if (other.id !== v.id && other.status === 'accepted' && other.scope.kind === 'day' && other.cause.eventId === v.cause.eventId) await this.setStatus(ctx, other.id, 'undone', tx);
      await this.deps.store.log({ userId, kind: 'ritual.undone', payload: { versionId: v.id, scope: v.scope.kind, trigger: v.cause.trigger } }, tx);
      return { state: await this.stateFrom(ctx, tx) };
    });
  }

  async setNightsShapeMornings(userId: string, on: boolean, opts: { timeZone?: string } = {}): Promise<EngineResult> {
    return this.locked(userId, opts.timeZone, async (ctx, tx) => {
      ctx.person = { ...ctx.person, version: ctx.person.version + 1, prefs: { ...ctx.person.prefs, nightsShapeMornings: on } };
      await this.deps.store.savePerson(userId, ctx.person, 'engine', tx);
      await this.deps.store.log({ userId, kind: 'prefs.changed', payload: { nightsShapeMornings: on } }, tx);
      return { state: await this.stateFrom(ctx, tx) };
    });
  }

  /** They said a line in "What Distill knows" isn't right. It comes out, and stays out. */
  async forget(userId: string, factId: string, opts: { timeZone?: string } = {}): Promise<EngineResult> {
    return this.locked(userId, opts.timeZone, async (ctx, tx) => {
      const next = forgetFact(ctx.person, factId);
      if (next !== ctx.person) {
        ctx.person = next;
        await this.deps.store.savePerson(userId, ctx.person, 'engine', tx);
        await this.deps.store.log({ userId, kind: 'person.forgot', payload: { factId } }, tx);
      }
      return { state: await this.stateFrom(ctx, tx) };
    });
  }

  /**
   * The week's real things near them. At most one search a week per person; the search runs outside
   * the lock, because it takes up to a minute and nothing else should wait on it. Nothing here
   * spends unless they open Explore, Claude is on, and ENGINE_EXPLORE_SEARCH isn't "off".
   */
  async exploreFeed(userId: string, region: string, opts: { timeZone?: string } = {}): Promise<EngineResult> {
    const place = region.trim().slice(0, 80);
    const plan = await this.locked(userId, opts.timeZone, async (ctx, tx) => {
      const state = await this.stateFrom(ctx, tx);
      const sameRegion = state.explore.region?.toLowerCase() === place.toLowerCase();
      if ((sameRegion && state.explore.fresh) || !state.explore.available || !ctx.client) return { state, search: null };
      const threads = this.threadsOf(ctx, state.items);
      if (!threads.length) return { state, search: null };
      // One at a time: leaving the tab and coming back, or a second device, never pays for a second search.
      const since = new Date(Date.parse(ctx.instant) - 3 * 60_000).toISOString();
      const underway = await this.deps.store.events(userId, ['explore.search', 'explore.feed'], since, tx);
      if (underway.at(-1)?.kind === 'explore.search' || !takeSearch(this.now().toISOString().slice(0, 10))) return { state, search: null };
      await this.deps.store.log({ userId, kind: 'explore.search', payload: { region: place } }, tx);
      const answers = await this.deps.store.events(userId, ['explore.in', 'explore.no', 'explore.how'], '2000-01-01T00:00:00Z', tx);
      const titleOf = (e: { payload: Record<string, unknown> }) => String(e.payload.title ?? (e.payload.event as { title?: string } | undefined)?.title ?? '');
      return {
        state,
        search: {
          client: ctx.client,
          person: ctx.person,
          today: ctx.today,
          threads: threads.map((t) => ({ id: t.id, name: t.name, from: t.from })),
          skip: answers.filter((e) => e.kind !== 'explore.how').map(titleOf).filter(Boolean),
          liked: answers.filter((e) => e.kind === 'explore.how' && e.payload.how === 'loved').map(titleOf).filter(Boolean),
        },
      };
    });
    if (!plan.search) return { state: plan.state };
    const { client, ...asked } = plan.search;
    const found = await findEvents(client, { ...asked, region: place, banned: this.deps.toneRules.bannedPhrases });
    return this.locked(userId, opts.timeZone, async (ctx, tx) => {
      this.logCall(ctx, 'explore-feed', EXPLORE_FEED_VERSION, found.usage, { from: found.from, searches: found.searches, dropped: found.dropped.slice(0, 10) });
      await this.deps.store.log({ userId, kind: 'explore.feed', payload: { region: place, events: found.events, failed: found.from !== 'claude' } }, tx);
      return { state: await this.stateFrom(ctx, tx) };
    });
  }

  /** Their answer to something real: I'm in (it goes on that day), not for me, or how it went. */
  async exploreGo(userId: string, eventId: string, answer: 'in' | 'no' | 'loved' | 'not-really', opts: { timeZone?: string; thread?: string } = {}): Promise<EngineResult> {
    return this.locked(userId, opts.timeZone, async (ctx, tx) => {
      const store = this.deps.store;
      const rows = await store.events(userId, ['explore.feed', 'explore.in'], '2000-01-01T00:00:00Z', tx);
      // A place from the bank, or something the weekly search found.
      const idea = this.deps.bank.ideas.find((i) => `idea:${i.id}` === eventId);
      const event = idea
        ? eventOfIdea(idea, opts.thread)
        : rows
            .flatMap((r) => (r.kind === 'explore.feed' ? ((r.payload.events as unknown[]) ?? []) : [r.payload.event]))
            .flatMap((e) => {
              const parsed = foundEventSchema.safeParse(e);
              return parsed.success ? [parsed.data] : [];
            })
            .find((e) => e.id === eventId);
      if (!event) throw new HttpError(404, 'no_such_event');
      if (answer === 'no') {
        await store.log({ userId, kind: 'explore.no', payload: { eventId, title: event.title } }, tx);
        return { state: await this.stateFrom(ctx, tx) };
      }
      if (answer === 'loved' || answer === 'not-really') {
        await store.log({ userId, kind: 'explore.how', payload: { eventId, title: event.title, how: answer } }, tx);
        return { state: await this.stateFrom(ctx, tx) };
      }
      await store.log({ userId, kind: 'explore.in', payload: { event } }, tx);
      // A race is something they're working toward now, and Distill shapes days around that.
      if (event.kind === 'race' && !ctx.person.identity.toward.some((t) => t.text === event.title)) {
        ctx.person = {
          ...ctx.person,
          version: ctx.person.version + 1,
          identity: {
            ...ctx.person.identity,
            toward: [...ctx.person.identity.toward, { text: event.title, hard: true, ...(event.date ? { by: event.date } : {}) }].slice(-12),
          },
        };
        await store.savePerson(userId, ctx.person, 'engine', tx);
      }
      let versionId: string | undefined;
      // A place they go regularly goes in their week.
      if (idea) {
        const base = baseOn(ctx.versions, ctx.today);
        const id = `part:explore:${idea.id}`;
        if (base && !base.parts.some((p) => p.id === id && p.status === 'active')) {
          const op: Op = { op: 'add', part: partForIdea(idea) };
          const parts = applyOps(base.parts.filter((p) => p.id !== id), [op], { scope: 'base', newId: idQueue([id]) }).parts;
          const v = await this.saveVersion(
            ctx,
            { parentId: base.id, scope: { kind: 'base', effectiveFrom: ctx.today }, parts, ops: [op], changes: [{ op: 'add', partId: id, reason: 'explore' }], cause: { eventId: null, trigger: 'edit' }, status: 'accepted', engine: this.stampFor({ eventId }) },
            tx,
          );
          await this.rebaseFuture(ctx, [op], [id], tx);
          versionId = v.id;
        }
      }
      if (event.date && baseOn(ctx.versions, ctx.today)) {
        const area = THREAD_AREA(event.thread);
        const op: Op = {
          op: 'add',
          part: { title: event.title.slice(0, 80), slot: 'morning', area, why: event.why.slice(0, 240), source: { kind: 'explore', ideaId: event.id } },
        };
        const previous = ritualOn(ctx.versions, event.date).day;
        const saved = await this.saveVersion(
          ctx,
          { parentId: previous?.id ?? null, scope: { kind: 'day', date: event.date }, parts: [], ops: [...(previous?.ops ?? []), op], changes: [{ op: 'add', partId: 'new', reason: 'explore' }], cause: { eventId: null, trigger: 'edit' }, status: 'accepted', engine: this.stampFor({ eventId }) },
          tx,
        );
        versionId = saved.id;
      }
      return { state: await this.stateFrom(ctx, tx), ...(versionId ? { versionId } : {}) };
    });
  }

  /** What opens a next step in Explore: what they kept, what they wrote, and who they spend time with. */
  private threadsOf(ctx: Ctx, standings: Readonly<Record<string, ItemStanding>>) {
    return threadsFor({
      items: ctx.progress.items,
      words: [ctx.person.identity.idealDay, ...ctx.person.identity.atBest, ...ctx.progress.items.flatMap((i) => i.notes.map((n) => n.text))].join('\n'),
      standings: standings as Readonly<Record<string, string>>,
      hasPeople: ctx.person.people.length > 0,
    });
  }

  private async exploreState(ctx: Ctx, db: Tx): Promise<ExploreState> {
    const rows = await this.deps.store.events(ctx.userId, ['explore.feed', 'explore.in', 'explore.no', 'explore.how'], '2000-01-01T00:00:00Z', db);
    const last = rows.filter((r) => r.kind === 'explore.feed').at(-1);
    const parse = (e: unknown) => {
      const parsed = foundEventSchema.safeParse(e);
      return parsed.success ? [parsed.data] : [];
    };
    const answered = new Set(rows.filter((r) => r.kind !== 'explore.feed' && r.kind !== 'explore.in').map((r) => String(r.payload.eventId)));
    const going = new Map(rows.filter((r) => r.kind === 'explore.in').flatMap((r) => parse(r.payload.event)).map((e) => [e.id, e]));
    const age = last ? Date.parse(ctx.instant) - Date.parse(last.at) : Infinity;
    return {
      region: last ? String(last.payload.region) : null,
      at: last?.at ?? null,
      fresh: !!last && age < (last.payload.failed ? DAY_MS : 7 * DAY_MS),
      available: !!ctx.client && process.env.ENGINE_EXPLORE_SEARCH !== 'off',
      events: ((last?.payload.events as unknown[]) ?? [])
        .flatMap(parse)
        .filter((e) => !answered.has(e.id) && !going.has(e.id) && (!e.date || e.date >= ctx.today)),
      going: [...going.values()]
        .filter((e) => !answered.has(e.id))
        .map((e) => ({ ...e, past: !!e.date && e.date < ctx.today }))
        .sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999')),
    };
  }

  /** Explore: they said what they want to try. Certified ideas only, at most three. */
  async explore(userId: string, want: string, region: string | undefined, opts: { timeZone?: string } = {}): Promise<EngineResult> {
    return this.locked(userId, opts.timeZone, async (ctx, tx) => {
      const declined = (await this.deps.store.events(userId, ['explore.declined'], '2000-01-01T00:00:00Z', tx)).map((e) => String(e.payload.ideaId));
      const ideas = ideasFor(this.deps.bank, { person: ctx.person, want, ...(region ? { region } : {}), declined });
      await this.deps.store.addMessage(userId, { role: 'person', text: want.slice(0, 2000), at: ctx.instant }, tx);
      const r = await exploreStep(ctx.client, { person: ctx.person, want, ...(region ? { region } : {}), ideas, toneRules: this.deps.toneRules, lineContext: this.lineContext(ctx, [want]), today: ctx.today });
      this.logCall(ctx, 'explore', EXPLORE_VERSION, r.usage, { from: r.from });
      await this.deps.store.log({ userId, kind: 'explore.asked', payload: { want, region: region ?? null, shown: r.options.map((o) => o.idea.id), toReview: r.toReview } }, tx);
      await this.deps.store.addMessage(userId, { role: 'companion', text: r.reply, at: this.after(ctx) }, tx);
      return {
        state: await this.stateFrom(ctx, tx),
        reply: r.reply,
        explore: { options: r.options.map((o) => ({ ideaId: o.idea.id, title: o.idea.title, why: o.why, url: o.idea.url, partner: o.idea.partner })) },
      };
    });
  }

  /** Their answer to an idea: added to the week once a week, or never offered again. */
  async exploreAnswer(userId: string, ideaId: string, answer: 'add' | 'decline', opts: { timeZone?: string } = {}): Promise<EngineResult> {
    return this.locked(userId, opts.timeZone, async (ctx, tx) => {
      const idea = this.deps.bank.ideas.find((i) => i.id === ideaId && i.certified);
      if (!idea) throw new HttpError(404, 'no_such_idea');
      if (answer === 'decline') {
        await this.deps.store.log({ userId, kind: 'explore.declined', payload: { ideaId } }, tx);
        return { state: await this.stateFrom(ctx, tx) };
      }
      const base = baseOn(ctx.versions, ctx.today);
      if (!base) throw new HttpError(409, 'no_ritual');
      const op: Op = { op: 'add', part: partForIdea(idea) };
      const ids = [`part:explore:${idea.id}`];
      if (base.parts.some((p) => p.id === ids[0] && p.status === 'active')) return { state: await this.stateFrom(ctx, tx) };
      const parts = applyOps(base.parts.filter((p) => p.id !== ids[0]), [op], { scope: 'base', newId: idQueue(ids) }).parts;
      const v = await this.saveVersion(
        ctx,
        { parentId: base.id, scope: { kind: 'base', effectiveFrom: ctx.today }, parts, ops: [op], changes: [{ op: 'add', partId: ids[0]!, reason: 'explore' }], cause: { eventId: null, trigger: 'edit' }, status: 'accepted', engine: this.stampFor({ ideaId }) },
        tx,
      );
      await this.rebaseFuture(ctx, [op], ids, tx);
      await this.deps.store.log({ userId, kind: 'explore.added', payload: { ideaId, versionId: v.id } }, tx);
      return { state: await this.stateFrom(ctx, tx), versionId: v.id };
    });
  }

  /** Their answer to a swap: added to their Ritual where it fits, or never offered again. */
  async swapAnswer(userId: string, itemKey: string, answer: 'add' | 'decline', opts: { timeZone?: string } = {}): Promise<EngineResult> {
    return this.locked(userId, opts.timeZone, async (ctx, tx) => {
      const view = this.deps.catalog.item(itemKey);
      if (!view?.swap || !ctx.progress.items.some((i) => i.itemKey === itemKey)) throw new HttpError(404, 'no_such_swap');
      if (answer === 'decline') {
        await this.deps.store.log({ userId, kind: 'swap.declined', payload: { itemKey } }, tx);
        return { state: await this.stateFrom(ctx, tx) };
      }
      const base = baseOn(ctx.versions, ctx.today);
      if (!base) throw new HttpError(409, 'no_ritual');
      const id = swapPartId(itemKey);
      if (base.parts.some((p) => p.id === id && p.status === 'active')) return { state: await this.stateFrom(ctx, tx) };
      const op: Op = { op: 'add', part: partForSwap(view) };
      const parts = applyOps(base.parts.filter((p) => p.id !== id), [op], { scope: 'base', newId: idQueue([id]) }).parts;
      const v = await this.saveVersion(
        ctx,
        { parentId: base.id, scope: { kind: 'base', effectiveFrom: ctx.today }, parts, ops: [op], changes: [{ op: 'add', partId: id, reason: 'swap' }], cause: { eventId: null, trigger: 'edit' }, status: 'accepted', engine: this.stampFor({ itemKey }) },
        tx,
      );
      await this.rebaseFuture(ctx, [op], [id], tx);
      await this.deps.store.log({ userId, kind: 'swap.added', payload: { itemKey, versionId: v.id } }, tx);
      return { state: await this.stateFrom(ctx, tx), versionId: v.id };
    });
  }

  /**
   * Called when the app opens: the night check runs once for the newest night their wearable sent,
   * if it is last night's. Returns null when there is nothing new to check.
   */
  async checkNight(userId: string, opts: { timeZone?: string } = {}): Promise<EngineResult | null> {
    const { nights, through } = await this.outside(userId, opts.timeZone);
    const newest = [...nights].filter((n) => typeof n.sleepMin === 'number').sort((a, b) => a.date.localeCompare(b.date)).at(-1);
    if (!newest || newest.date > through || daysBetween(newest.date, through) > 1) return null;
    const since = new Date(this.now().getTime() - 3 * DAY_MS).toISOString();
    const checked = await this.deps.store.events(userId, ['night.checked'], since);
    if (checked.some((e) => e.payload.date === newest.date)) return null;
    return this.run(userId, { kind: 'night', date: newest.date, sleepMin: newest.sleepMin! }, opts);
  }

  /**
   * A Ritual made by the rules before they could say it in full (no times, no reasons, no "Up at")
   * gets said in full, once, when they next open the app. Rules only, nothing changes but the words
   * and the times, and nothing they've moved or locked is touched.
   */
  async upgradeThinRitual(userId: string, opts: { timeZone?: string } = {}): Promise<void> {
    await this.locked(userId, opts.timeZone, async (ctx, tx) => {
      const base = baseOn(ctx.versions, ctx.today);
      if (!base) return;
      const events = await this.deps.store.events(userId, ['ritual.composed', 'ritual.upgraded'], '2000-01-01T00:00:00Z', tx);
      if (events.some((e) => e.kind === 'ritual.upgraded') || !events.some((e) => e.kind === 'ritual.composed' && e.payload.from === 'rules')) return;
      if (base.parts.some((p) => p.status === 'active' && p.when.at)) return;
      const { parts } = wholeRitual(base.parts, ctx.progress, this.decideNow(ctx).decisions, {
        evidenceFor: (key) => (key ? this.deps.catalog.item(key)?.evidenceFor : undefined),
        banned: this.deps.toneRules.bannedPhrases,
      });
      const v = await this.saveVersion(
        ctx,
        { parentId: base.id, scope: { kind: 'base', effectiveFrom: ctx.today }, parts, ops: [], changes: [], cause: { eventId: null, trigger: 'refresh' }, status: 'accepted', engine: this.stampFor({ upgraded: base.id }) },
        tx,
      );
      await this.deps.store.log({ userId, kind: 'ritual.upgraded', payload: { from: base.id, versionId: v.id } }, tx);
    });
  }

  /** What the app shows. Reading it logs today's one thing the first time each day. */
  async state(userId: string, opts: { timeZone?: string } = {}): Promise<EngineState> {
    return this.locked(userId, opts.timeZone, (ctx, tx) => this.stateFrom(ctx, tx));
  }

  private async stateFrom(ctx: Ctx, db: Tx): Promise<EngineState> {
    const since = new Date(Date.parse(ctx.instant) - 14 * DAY_MS).toISOString();
    const events = await this.deps.store.events(
      ctx.userId,
      ['part.done', 'part.skipped', 'today.shown', 'explore.asked', 'explore.added', 'explore.declined', 'question.answered'],
      since,
      db,
    );
    const checks = new Map<string, 'done' | 'skipped'>();
    for (const e of events)
      if (e.kind === 'part.done' || e.kind === 'part.skipped') checks.set(`${e.payload.date}:${e.payload.partId}`, e.kind === 'part.done' ? 'done' : 'skipped');
    const decided = this.decideNow(ctx);
    const founded = new Set(revealNotes(decided.decisions, ctx.progress.items, ctx.progress.dayOne.yours, this.deps.toneRules.bannedPhrases).wellFounded);
    // A row with only the engine's stock reason says what a well-founded thing is for, so a Ritual never reads as a bare list.
    const spoken = <T extends RitualPart>(p: T): T => {
      if (p.source.kind !== 'stack' || !founded.has(p.source.stackItemId) || !isStockWhy(p.why)) return p;
      const benefit = this.deps.catalog.item(p.source.itemKey)?.evidenceFor;
      return benefit ? { ...p, why: copy.reveal.detail.founded(benefit) } : p;
    };
    const dayOut = (date: string): DayOut => {
      const view = ritualOn(ctx.versions, date);
      return {
        date,
        changed: !!view.day,
        parts: sortParts(view.parts).map((p) => {
          const check = checks.get(`${date}:${p.id}`);
          return { ...spoken(p), moment: momentOfPart(p, date), ...(check ? { check } : {}) };
        }),
      };
    };
    const accepted = ctx.versions.filter((v) => v.scope.kind === 'base' && v.status === 'accepted');
    const proposed = newestProposedBase(ctx.versions) ?? null;
    const first = ctx.versions.find((v) => v.scope.kind === 'base' && !v.parentId && (v.status === 'accepted' || v.status === 'proposed'));
    const latest = [...ctx.versions].reverse().find((v) => v.status === 'accepted' && UNDOABLE.includes(v.cause.trigger));
    const shown = events.filter((e) => e.kind === 'today.shown');
    const already = shown.find((e) => e.payload.date === ctx.today);
    const pick = already ? (already.payload.pick as TodayPick['pick']) : await this.pickFor(ctx, events, db);
    const ref = pick && 'ref' in pick ? (pick.ref as string | undefined) : undefined;
    const decision = pick && ref ? ctx.decisions.find((d) => d.id === ref) : undefined;
    const question = pick?.kind === 'question' ? this.questions(ctx).find((q) => q.id === ref) : undefined;
    const swap = decision?.kind === 'clear' && decision.status === 'yes' && decision.stackItemId ? await this.swapFor(ctx, decision.stackItemId, db) : undefined;
    const items = standingsOf(
      ctx.progress.items,
      decided,
      ctx.decisions.filter((d) => d.status === 'proposed'),
      ctx.decisions,
    );
    return {
      person: { name: ctx.person.name, season: seasonOn(ctx.person, ctx.today), nightsShapeMornings: ctx.person.prefs.nightsShapeMornings, readDone: !ctx.client || (await this.deps.store.events(ctx.userId, ['person.read'], '2000-01-01T00:00:00Z', db)).length > 0, wearable: ctx.person.signals.wearable },
      ritual: {
        status: accepted.length ? 'accepted' : proposed ? 'proposed' : 'none',
        summary: first?.reply ?? '',
        proposed,
        today: dayOut(ctx.today),
        week: Array.from({ length: 7 }, (_, i) => dayOut(addDays(ctx.today, i))),
        anyDay: flexibleParts(baseOn(ctx.versions, ctx.today)?.parts ?? newestProposedBase(ctx.versions)?.parts ?? []).map(spoken),
        lastChange: latest
          ? {
              versionId: latest.id,
              ...(latest.reply ? { reply: latest.reply } : {}),
              scope: latest.scope.kind,
              date: latest.scope.kind === 'day' ? latest.scope.date : latest.scope.effectiveFrom,
              undoable: Date.parse(ctx.instant) - Date.parse(latest.createdAt) < DAY_MS,
            }
          : null,
      },
      decisions: ctx.decisions.filter((d) => d.status !== 'withdrawn'),
      today: {
        kind: pick?.kind ?? null,
        ...(decision ? { decision } : {}),
        ...(question ? { question } : {}),
        ...(pick?.kind === 'more' && ref ? { more: ref } : {}),
        ...(pick?.kind === 'learn' && ref ? { learn: ref } : {}),
        ...(swap ? { swap } : {}),
      },
      thread: await this.deps.store.messages(ctx.userId, 60, db),
      explore: await this.exploreState(ctx, db),
      knows: knowsOf(ctx.person, {
        today: ctx.today,
        nameOf: (id) => {
          const item = ctx.progress.items.find((i) => i.id === id);
          if (!item || item.status === 'cut') return null;
          return item.label || item.customName || this.deps.catalog.item(item.itemKey)?.name || null;
        },
      }),
      items,
      money: {
        back: sum(ctx.decisions.filter((d) => d.kind === 'clear' && d.status === 'yes').map((d) => d.money)),
        waiting: sum(ctx.decisions.filter((d) => d.kind === 'clear' && d.status === 'proposed').map((d) => d.money)),
      },
    };
  }

  /** Today's one thing: rules rank it, a fair seeded draw breaks ties, and the chance is logged. */
  private async pickFor(ctx: Ctx, events: readonly { kind: string; payload: Record<string, unknown>; at: string }[], db: Tx) {
    const history: TodayHistory[] = events.flatMap((e) => {
      if (e.kind !== 'today.shown') return [];
      const p = e.payload.pick as { kind?: TodayHistory['kind']; ref?: string } | null;
      return p?.kind && p.ref ? [{ date: String(e.payload.date), kind: p.kind, ref: p.ref }] : [];
    });
    const asked = new Set(ctx.progress.moreAsked ?? []);
    const firstAccepted = ctx.versions.find((v) => v.scope.kind === 'base' && v.status === 'accepted');
    const clears = ctx.decisions.filter((d) => d.kind === 'clear');
    const lastAsked = events.filter((e) => e.kind === 'explore.asked').at(-1);
    const answeredAfter = lastAsked && events.some((e) => (e.kind === 'explore.added' || e.kind === 'explore.declined') && e.at >= lastAsked.at);
    const gate = exploreGate({
      today: ctx.today,
      ...(firstAccepted ? { ritualAcceptedOn: firstAccepted.createdAt.slice(0, 10) } : {}),
      clearsAccepted: clears.filter((d) => d.status === 'yes').length,
      clearsOpen: clears.filter((d) => d.status === 'proposed').length,
      clearsEver: clears.length,
      season: seasonOn(ctx.person, ctx.today),
      threadOpen: !!lastAsked && !answeredAfter && Date.parse(ctx.instant) - Date.parse(lastAsked.at) < 7 * DAY_MS,
    });
    const day = Math.floor(Date.parse(`${ctx.today}T12:00:00Z`) / DAY_MS);
    // "Not sure" rests a question for the two weeks these events cover; any other answer changes
    // what they told us, so the question stops mattering on its own.
    const resting = new Set(
      events.filter((e) => e.kind === 'question.answered' && e.payload.label === NOT_SURE).map((e) => String(e.payload.questionId)),
    );
    const result = pickToday({
      personId: ctx.userId,
      today: ctx.today,
      season: seasonOn(ctx.person, ctx.today),
      decisions: ctx.decisions,
      questions: this.questions(ctx).filter((q) => !resting.has(q.id)),
      history,
      moreLeft: morePlaces.map((p) => p.id).filter((id) => !asked.has(id)),
      exploreOpen: gate.open,
      learnQuestion: pickQuestion(day, ctx.progress),
    });
    await this.deps.store.log(
      {
        userId: ctx.userId,
        kind: 'today.shown',
        payload: {
          date: ctx.today,
          pick: result.pick,
          propensity: result.propensity,
          why: result.why,
          explore: gate.why,
          candidates: result.candidates.map((c) => ({ id: c.id, kind: c.kind, cls: c.cls, score: c.score })),
        },
      },
      db,
    );
    return result.pick;
  }
}

/**
 * The signed-out preview: the same rules on what they typed, nothing stored, no Claude. It shows
 * what Distill would clear, keep and shape before anyone makes an account.
 */
/**
 * Where each thing on their list stands, for the screens: a clinician's, theirs, ready to clear, a
 * dose or form to adjust, kept, or still open. `open` is the decisions still waiting on them.
 */
function standingsOf(
  items: Progress['items'],
  decided: { clinicianIds: readonly string[]; theirsIds: readonly string[] },
  open: readonly { stackItemId: string | null; kind: string; reason: string }[],
  all: readonly { stackItemId: string | null; kind: string; reason?: string }[],
): Record<string, ItemStanding> {
  const out: Record<string, ItemStanding> = {};
  for (const i of items) {
    if (i.status === 'cut') continue;
    const mine = open.filter((d) => d.stackItemId === i.id);
    out[i.id] = decided.clinicianIds.includes(i.id)
      ? 'clinician'
      : decided.theirsIds.includes(i.id)
        ? 'theirs'
        : mine.some((d) => d.kind === 'clear')
          ? 'clear'
          : mine.some((d) => d.kind === 'curate' && (d.reason === 'ADJUST_DOSE' || d.reason === 'ADJUST_FORM'))
            ? 'adjust'
            : // "No reason to change it" is their call, not something Distill keeps for them.
              all.some((d) => d.stackItemId === i.id && d.kind === 'keep' && d.reason !== 'NOTHING_TO_CLEAR')
              ? 'keep'
              : 'open';
  }
  return out;
}

export function previewEngine(
  progress: Progress,
  deps: { catalog: CatalogView; banned?: readonly string[]; now?: Date; timeZone?: string },
) {
  const instant = (deps.now ?? new Date()).toISOString();
  const tz = validZone(deps.timeZone) ?? DEFAULT_ZONE;
  const today = localDate(instant, tz);
  const person = personFromProgress(progress, { personId: 'preview', timeZone: tz, today });
  const decided = decide({ person, stack: progress.items, catalog: deps.catalog, history: [], today });
  const ritual = composeByRules({ person, stack: progress.items, decided, catalog: deps.catalog, firstCompose: true });
  return {
    today,
    parts: ritual.parts,
    summary: ritual.summary,
    decisions: decided.decisions.map((d) => ({ ...d, line: fallbackLine(d, deps.banned ?? []) })),
    /** Where each thing stands, as the signed-in state's `items` says it. */
    standings: standingsOf(progress.items, decided, decided.decisions, decided.decisions),
  };
}

/**
 * The signed-out first Ritual with Claude's shaping on top of the rules draft, for the onboarding
 * reveal. Same checks and fallback as the signed-in compose; nothing is stored. Null without a client.
 */
export async function previewCompose(
  progress: Progress,
  deps: {
    catalog: CatalogView;
    toneRules: Pick<ToneRules, 'bannedPhrases' | 'maxWordsExclusive' | 'gatedMaxWords'>;
    client: ClaudeClient | null;
    now?: Date;
    timeZone?: string;
  },
) {
  if (!deps.client) return null;
  const instant = (deps.now ?? new Date()).toISOString();
  const tz = validZone(deps.timeZone) ?? DEFAULT_ZONE;
  const today = localDate(instant, tz);
  const person = personFromProgress(progress, { personId: 'preview', timeZone: tz, today });
  const decided = decide({ person, stack: progress.items, catalog: deps.catalog, history: [], today });
  const rules = composeByRules({ person, stack: progress.items, decided, catalog: deps.catalog, firstCompose: true });
  const words = theirWords(person, progress.items, progress.asks.map((a) => a.a));
  const shaped = await composeRitual(deps.client, {
    person,
    rules,
    allowed: {
      words,
      stackItemIds: new Set(progress.items.filter((i) => i.status !== 'cut').map((i) => i.id)),
      ideaIds: new Set(),
      peopleIds: new Set(person.people.map((p) => p.id)),
      productNames: productNames(deps.catalog, progress),
    },
    toneRules: deps.toneRules,
    lineContext: {
      allowedNumbers: allowedNumbersFrom(words, ...progress.items.map((i) => String(Math.round(i.monthlyCost)))),
      names: [
        person.name,
        ...person.people.map((p) => p.name),
        ...progress.items.flatMap((i) => [i.label ?? '', i.customName ?? '', deps.catalog.item(i.itemKey)?.shortName ?? '']),
      ].filter(Boolean),
    },
    firstCompose: true,
    today,
    stack: progress.items,
    asks: progress.asks,
    newId: () => `part:${randomUUID()}`,
  });
  return { parts: shaped.parts, summary: shaped.summary, from: shaped.from };
}

/** Fixed lines the engine says itself; each passes the same checks as Claude's. */
export const FIXED_LINES = {
  noRitualYet: "Okay, got it. Once you say yes to your Ritual, we'll shape your days around it.",
  nothingToMove: 'Okay, got it. That day is already clear for you.',
} as const;

const THREAD_AREA = (id: string) => THREADS.find((t) => t.id === id)?.area ?? 'move';

/** A ceiling on real searches per server instance per day, whatever else goes wrong. */
const SEARCHES_PER_DAY = 300;
let searches = { date: '', count: 0 };
function takeSearch(date: string): boolean {
  if (searches.date !== date) searches = { date, count: 0 };
  if (searches.count >= SEARCHES_PER_DAY) return false;
  searches.count += 1;
  return true;
}

const sum = (xs: readonly number[]) => xs.reduce((t, x) => t + x, 0);

const validZone = (tz: string | undefined) => {
  if (!tz) return undefined;
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return tz;
  } catch {
    return undefined;
  }
};

/** Ids handed out in order to the parts an edit adds, so a week and its rebased copies agree. */
function idQueue(ids: readonly string[]) {
  const queue = [...ids];
  return () => queue.shift() ?? `part:${randomUUID()}`;
}

function newestProposedBase(versions: readonly RitualVersion[]) {
  return [...versions].reverse().find((v) => v.scope.kind === 'base' && v.status === 'proposed');
}

function sharesDay(a: RitualPart, b: RitualPart) {
  if (!a.when.days.length || !b.when.days.length) return true;
  return a.when.days.some((d) => b.when.days.includes(d));
}

function newPartOf(p: RitualPart): NewPart {
  return {
    title: p.title,
    slot: p.when.slot,
    ...(p.when.at ? { at: p.when.at } : {}),
    days: [...p.when.days],
    ...(p.when.perWeek ? { perWeek: p.when.perWeek } : {}),
    ...(p.minutes ? { minutes: p.minutes } : {}),
    ...(p.place ? { place: p.place } : {}),
    ...(p.people?.length ? { people: [...p.people] } : {}),
    area: p.area,
    why: p.why,
    source: p.source,
  };
}

/** An idea from the bank as a part of their week: once a week, at the time of day it happens. */
const IDEA_KIND: Partial<Record<ExploreBank['ideas'][number]['kind'], FoundEvent['kind']>> = { community: 'group', class: 'class', trip: 'trip', place: 'place', scene: 'event' };

/** A place from the bank, in the same shape as what the weekly search finds. */
function eventOfIdea(idea: ExploreBank['ideas'][number], thread: string | undefined): FoundEvent {
  return {
    id: `idea:${idea.id}`,
    thread: thread && THREADS.some((t) => t.id === thread) ? thread : 'together',
    kind: IDEA_KIND[idea.kind] ?? 'place',
    title: idea.title.slice(0, 120),
    when: idea.when.slice(0, 80),
    where: (idea.neighbourhood ?? idea.city).slice(0, 120),
    url: idea.url,
    source: new URL(idea.url).hostname.replace(/^www\./, ''),
    why: idea.line.slice(0, 240),
  };
}

function partForIdea(idea: ExploreBank['ideas'][number]): NewPart {
  const when = idea.when.toLowerCase();
  const slot = /morning|sunrise|dawn/.test(when) ? 'morning' : /night|after dark/.test(when) ? 'night' : /evening|after work|sunset/.test(when) ? 'evening' : 'midday';
  const days = /sunday/.test(when) ? (['sun'] as const) : /saturday|weekend/.test(when) ? (['sat'] as const) : undefined;
  return {
    title: idea.title.slice(0, 80),
    slot,
    ...(days ? { days: [...days] } : { perWeek: 1 }),
    area: idea.area,
    why: idea.line.slice(0, 240),
    source: { kind: 'explore', ideaId: idea.id },
  };
}

const swapPartId = (itemKey: string) => `part:swap:${itemKey}`;

function partForSwap(view: CatalogItemView): NewPart {
  const swap = view.swap!;
  return {
    title: swap.title,
    slot: swap.slot,
    ...(swap.perWeek ? { perWeek: swap.perWeek } : {}),
    area: view.area,
    why: view.fitsInstead.slice(0, 240),
    source: { kind: 'swap', itemKey: view.key },
  };
}

/** A message that asks something. */
const QUESTIONISH = /\?|^\s*(why|how|what|should|is|are|does|do|can|could|would|will)\b/i;
/** A short follow-up to the card or the last answer: "why?", "is it worth it?", "how do I fit this in?". */
const POINTS_BACK = /\b(it|this|that|these|those|them|one|swap|instead)\b/i;
const BARE = /^\s*(why|how come|how so|how|really|wait|huh)\b/i;
const FOLLOW_UP_MS = 12 * 3_600_000;
function isFollowUp(text: string): boolean {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return words <= 14 && (POINTS_BACK.test(text) || (BARE.test(text) && words <= 5));
}

/** Message text lives (with consent) in the thread table; the event log keeps only its shape. */
function redact(event: EngineEvent): Record<string, unknown> {
  if (event.kind === 'message') return { kind: event.kind, length: event.text.length, ...(event.about ? { about: event.about } : {}) };
  if (event.kind === 'note') return { kind: event.kind, stackItemId: event.stackItemId, length: event.text.length };
  if (event.kind === 'answer') return { kind: event.kind, q: event.q, length: event.a.length };
  return { ...event } as Record<string, unknown>;
}

function productNames(catalog: CatalogView, progress: Progress): string[] {
  const names = new Set<string>(['magnesium', 'melatonin', 'creatine', 'ashwagandha', 'collagen', 'protein powder', 'greens', 'gummies', 'pre-workout', 'electrolytes']);
  for (const i of progress.items) {
    const v = catalog.item(i.itemKey);
    if (v && (v.kind === 'supplement' || v.kind === 'device' || v.kind === 'service')) {
      names.add(v.shortName.toLowerCase());
      if (i.label) names.add(i.label.toLowerCase());
    }
  }
  return [...names];
}

const STOP = new Set(['the', 'my', 'a', 'an', 'and', 'of', 'for', 'with', 'daily', 'night', 'morning']);
const tokens = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));

/** The item on their list a message names ("stopped the ag1"), by their word or the catalog's. */
export function matchItem(progress: Progress, catalog: CatalogView, name: string): string | undefined {
  const said = new Set(tokens(name));
  if (!said.size) return undefined;
  let best: { id: string; hits: number } | undefined;
  for (const i of progress.items) {
    if (i.status === 'cut') continue;
    const v = catalog.item(i.itemKey);
    const words = new Set([i.label, i.customName, v?.shortName, v?.name].filter(Boolean).flatMap((x) => tokens(x!)));
    const hits = [...said].filter((w) => words.has(w)).length;
    if (hits && (!best || hits > best.hits)) best = { id: i.id, hits };
  }
  return best?.id;
}

