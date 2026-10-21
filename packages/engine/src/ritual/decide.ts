import type { CatalogItemView, CatalogView, OverlapGroupView } from '@distill/catalog';
import { CLINICIAN_ORIGINS } from './person.js';
import { daysBetween } from './time.js';
import type {
  Attachment,
  DecisionKind,
  KnownTier,
  PersonModel,
  PriorDecision,
  ReasonCode,
} from './types.js';
import {
  BORROWED_ORIGINS,
  displayName,
  doseCheck,
  requirementMet,
  trainsOf,
  usageOf,
  type StackItemLike,
} from './usage.js';

/**
 * Clear, keep, curate and refer, decided by rules over the routing table and the person model.
 * No model is involved: Claude words these decisions, it never makes them.
 *
 * The plan described one first-match ladder per item. Overlap is a question about a group, so a
 * ladder would let the order of someone's list change the answer. This runs in passes instead:
 *   0. what is outside the edit (clinician care, the wearable's own subscription) and referrals;
 *   1. protections: theirs, loved, well-founded and regular (with a dose or form adjustment);
 *   2. overlap groups, settled as groups;
 *   3. the clearing rules, first match per item;
 *   4. everything else is kept, and kept anchors are offered as the centre of a moment.
 * Values come before evidence, and evidence protects before anything clears.
 */

export interface DecideInput {
  readonly person: PersonModel;
  readonly stack: readonly StackItemLike[];
  readonly catalog: CatalogView;
  readonly history: readonly PriorDecision[];
  /** The person's own local date. */
  readonly today: string;
}

export interface DecisionDraft {
  /** `${stackItemId}:${kind}`: one open decision per item and kind. */
  readonly key: string;
  readonly stackItemId: string | null;
  readonly itemKey: string | null;
  readonly kind: DecisionKind;
  readonly reason: ReasonCode;
  readonly evidenceTier?: KnownTier;
  /** Monthly money a clear gives back. */
  readonly money: number;
  readonly name: string;
  /** What the companion needs to word it, never shown raw. */
  readonly context: {
    readonly keeperId?: string;
    readonly keeperName?: string;
    readonly group?: string;
    readonly fitsInstead?: string;
    readonly humanQuestion?: string;
    readonly evidenceFor?: string;
    readonly evidenceSummary?: string;
    readonly doseTypical?: string;
    readonly doseUnit?: string;
    readonly studiedForms?: readonly string[];
    readonly safety?: readonly string[];
  };
}

export interface DecideResult {
  readonly decisions: readonly DecisionDraft[];
  /** Items outside the edit: never decided, never moved. */
  readonly clinicianIds: readonly string[];
  /** Items marked theirs: final. */
  readonly theirsIds: readonly string[];
  /** Well-founded things they do regularly: a reshape never skips or swaps them. */
  readonly protectedIds: readonly string[];
  /** Which pass settled each item, for tests and the event log. */
  readonly trace: Readonly<Record<string, string>>;
}

/** Days a "not now" holds before the same proposal can come back. */
export const NOT_NOW_DAYS: Partial<Record<ReasonCode, number>> = { UNLOVED_HABIT: 30 };
export const NOT_NOW_DEFAULT_DAYS = 21;

const TIER_RANK: Record<KnownTier, number> = { A: 5, B: 4, C: 3, D: 2, N: 1, U: 0 };
const ATTACH_RANK: Record<Attachment, number> = {
  theirs: 4,
  loved: 3,
  unknown: 1,
  neutral: 1,
  borrowed: 0,
};
/** Things people often love for the company or the moment, so we ask before naming them. */
const SOCIAL_LOVE = new Set(['connection', 'belonging', 'treat', 'ritual']);
/** Skin rows whose actives need a dermatologist's say once a skin condition is in the picture. */
const SKIN_ACTIVE_KINDS = new Set(['supplement', 'practice', 'device', 'service']);

/** The tier that applies to this person: the row's own, or the "otherwise" tier when they don't qualify. */
export function tierFor(
  view: CatalogItemView | undefined,
  item: StackItemLike,
  stack: readonly StackItemLike[],
): KnownTier {
  if (!view) return 'U';
  if (view.tier === 'U') return 'U';
  const met = requirementMet(view, item, stack);
  // Doubt protects: only a known "no" moves an item to its otherwise tier.
  if (met === false) return view.tierOtherwise ?? 'C';
  return view.tier;
}

function attachmentOf(person: PersonModel, item: StackItemLike): Attachment {
  if (person.values[item.id]?.attachment) return person.values[item.id]!.attachment;
  return item.status === 'kept' ? 'theirs' : 'unknown';
}

function underCooldown(
  history: readonly PriorDecision[],
  stackItemId: string,
  kind: DecisionKind,
  reason: ReasonCode,
  today: string,
): boolean {
  const days = NOT_NOW_DAYS[reason] ?? NOT_NOW_DEFAULT_DAYS;
  return history.some(
    (h) =>
      h.stackItemId === stackItemId &&
      h.kind === kind &&
      h.status === 'not-now' &&
      !!h.answeredAt &&
      daysBetween(h.answeredAt.slice(0, 10), today) < days,
  );
}

function answeredAlready(
  history: readonly PriorDecision[],
  stackItemId: string,
  kind: DecisionKind,
  reason: ReasonCode,
): boolean {
  return history.some(
    (h) =>
      h.stackItemId === stackItemId &&
      h.kind === kind &&
      h.reason === reason &&
      (h.status === 'yes' || h.status === 'theirs'),
  );
}

export function decide(input: DecideInput): DecideResult {
  const { person, catalog, history, today } = input;
  // Sorted by id so nothing depends on the order of their list.
  const stack = [...input.stack].sort((a, b) => a.id.localeCompare(b.id));
  const live = stack.filter((s) => s.status !== 'cut');
  const view = (s: StackItemLike) => catalog.item(s.itemKey);
  const conditions = new Set(person.constraints.conditions.map((c) => c.condition));
  const drafts = new Map<string, DecisionDraft>();
  const decided = new Map<string, string>();
  const clinician = new Set<string>();
  const theirs = new Set<string>();
  const protectedIds = new Set<string>();
  const trace: Record<string, string> = {};

  const put = (
    s: StackItemLike,
    kind: DecisionKind,
    reason: ReasonCode,
    extra: Partial<Pick<DecisionDraft, 'context' | 'evidenceTier'>> = {},
  ) => {
    const v = view(s);
    const key = `${s.id}:${kind}`;
    drafts.set(key, {
      key,
      stackItemId: s.id,
      itemKey: s.itemKey,
      kind,
      reason,
      money: kind === 'clear' ? Math.max(0, s.monthlyCost) : 0,
      name: displayName(s, v),
      evidenceTier: extra.evidenceTier ?? tierFor(v, s, stack),
      context: {
        ...(v?.fitsInstead ? { fitsInstead: v.fitsInstead } : {}),
        ...(v?.humanQuestion ? { humanQuestion: v.humanQuestion } : {}),
        ...(v?.evidenceFor ? { evidenceFor: v.evidenceFor } : {}),
        ...(v?.evidenceSummary ? { evidenceSummary: v.evidenceSummary } : {}),
        ...(v?.safety.length ? { safety: v.safety.map((r) => r.note).filter(Boolean) } : {}),
        ...extra.context,
      },
    });
  };
  const settle = (s: StackItemLike, pass: string) => {
    decided.set(s.id, pass);
    trace[s.id] = pass;
  };

  // Pass 0: outside the edit, and referrals.
  for (const s of live) {
    const v = view(s);
    if (s.dataSource) {
      settle(s, 'outside:data-source');
      continue;
    }
    const safetyHits = (v?.safety ?? []).filter(
      (r) => r.condition !== 'any' && conditions.has(r.condition as never),
    );
    if (
      (s.origin && CLINICIAN_ORIGINS.has(s.origin)) ||
      s.status === 'protected' ||
      person.constraints.clinicianItemIds.includes(s.id) ||
      v?.neverClear ||
      safetyHits.some((r) => r.action === 'clinician-first')
    ) {
      clinician.add(s.id);
      settle(s, 'outside:clinician');
      continue;
    }
    const derm =
      safetyHits.some((r) => r.action === 'see-dermatologist') ||
      (v?.area === 'skin' && SKIN_ACTIVE_KINDS.has(v.kind) && conditions.has('skin-condition'));
    if (derm) {
      put(s, 'refer', 'SEE_A_DERMATOLOGIST');
      settle(s, 'refer:dermatologist');
    }
  }

  // Pass 1: protections.
  for (const s of live) {
    if (decided.has(s.id)) continue;
    const v = view(s);
    const attachment = attachmentOf(person, s);
    if (attachment === 'theirs') {
      theirs.add(s.id);
      put(s, 'keep', 'THEIRS');
      settle(s, 'protect:theirs');
      continue;
    }
    if (attachment === 'loved') {
      put(s, 'keep', 'LOVED');
      settle(s, 'protect:loved');
      continue;
    }
    const tier = tierFor(v, s, stack);
    const usage = usageOf(s, v);
    const evidenceKeeps = !!v && (v.keepWhen.includes('EVIDENCE_REGULAR') || v.keepWhen.includes('TRAINS'));
    if (v && evidenceKeeps && (tier === 'A' || tier === 'B') && usage.regular !== false && usage.unused !== true) {
      const trains = v.evidenceRequires === 'trains' && trainsOf(s, stack) === true;
      protectedIds.add(s.id);
      put(s, 'keep', trains ? 'TRAINS' : 'EVIDENCE_REGULAR');
      // A dose or form that can't work is fixed, never cleared: the thing itself is well-founded.
      const dose = doseCheck(s, v);
      if (dose.below === true)
        put(s, 'curate', 'ADJUST_DOSE', {
          context: { doseTypical: v.dose?.typical, doseUnit: v.dose?.unit },
        });
      else if (dose.unstudiedForm === true)
        put(s, 'curate', 'ADJUST_FORM', { context: { studiedForms: v.dose?.studiedForms } });
      settle(s, 'protect:evidence');
    }
  }

  // Pass 2: overlap groups, settled as groups in name order.
  const groups = [...catalog.groups].sort((a, b) => a.group.localeCompare(b.group));
  for (const g of groups) {
    if (g.rule === 'show-together') continue;
    const members = live.filter(
      (s) => s.itemKey && g.members.includes(s.itemKey) && !clinician.has(s.id) && !s.dataSource,
    );
    if (members.length < 2) continue;
    // Something already cleared in an earlier group doesn't count as covering anything.
    const candidates = members.filter((s) => !drafts.get(`${s.id}:clear`));
    if (candidates.length < 2) continue;
    const keeper = keeperOf(candidates, g, person, stack, catalog);
    const keeperTier = tierFor(view(keeper), keeper, stack);
    for (const s of candidates) {
      if (s.id === keeper.id) continue;
      const attachment = attachmentOf(person, s);
      if (attachment === 'theirs' || attachment === 'loved') continue;
      // A well-founded thing is only cleared when the keeper covers it at least as well.
      if (protectedIds.has(s.id) && TIER_RANK[keeperTier] < TIER_RANK[tierFor(view(s), s, stack)])
        continue;
      if (decided.has(s.id) && !protectedIds.has(s.id)) continue;
      drafts.delete(`${s.id}:keep`);
      drafts.delete(`${s.id}:curate`);
      protectedIds.delete(s.id);
      put(s, 'clear', 'OVERLAP', {
        context: {
          keeperId: keeper.id,
          keeperName: displayName(keeper, view(keeper)),
          group: g.group,
        },
      });
      settle(s, `overlap:${g.group}`);
    }
  }

  // Pass 3: the clearing rules, first match per item.
  for (const s of live) {
    if (decided.has(s.id)) continue;
    const v = view(s);
    if (!v) continue;
    const attachment = attachmentOf(person, s);
    const tier = tierFor(v, s, stack);
    const usage = usageOf(s, v);
    const can = (code: CatalogItemView['clearWhen'][number]) => v.clearWhen.includes(code);
    const dose = doseCheck(s, v);
    let reason: ReasonCode | null = null;
    if (can('UNUSED') && usage.unused === true) reason = 'UNUSED';
    else if (can('DOSE_BELOW_MIN') && dose.below === true && tier !== 'U') reason = 'DOSE_BELOW_MIN';
    else if (can('FORM_NOT_ABSORBED') && dose.unstudiedForm === true && tier !== 'U')
      reason = 'FORM_NOT_ABSORBED';
    else if (can('NOT_TRAINING') && trainsOf(s, stack) === false) reason = 'NOT_TRAINING';
    else if (can('TOO_MANY_STEPS')) reason = 'TOO_MANY_STEPS';
    else if (can('BORROWED_WEAK') && borrowedWeak(tier, attachment, s)) reason = 'BORROWED_WEAK';
    else if (can('UNLOVED_HABIT') && unlovedHabit(attachment, v)) reason = 'UNLOVED_HABIT';
    if (reason) {
      put(s, 'clear', reason);
      settle(s, `clear:${reason}`);
    }
  }

  // Pass 4: everything left is kept; kept anchors are offered as the centre of a moment.
  for (const s of live) {
    if (decided.has(s.id)) continue;
    put(s, 'keep', 'NOTHING_TO_CLEAR');
    settle(s, 'keep:default');
  }
  const anchors = live
    .filter((s) => {
      const d = drafts.get(`${s.id}:keep`);
      return d && (d.reason === 'THEIRS' || d.reason === 'LOVED') && view(s)?.ritualRole === 'anchor';
    })
    .slice(0, 2);
  for (const s of anchors) if (!drafts.has(`${s.id}:curate`)) put(s, 'curate', 'ANCHOR');

  // "Not now" holds for its cooldown; anything already answered isn't asked again (a yes to a
  // clear stays answered while the app marks the item gone, and a yes to a dose change for good).
  const decisions = [...drafts.values()]
    .filter((d) => {
      if (!d.stackItemId) return true;
      if (answeredAlready(history, d.stackItemId, d.kind, d.reason)) return false;
      if ((d.kind === 'clear' || d.kind === 'curate') && underCooldown(history, d.stackItemId, d.kind, d.reason, today))
        return false;
      return true;
    })
    .sort((a, b) => a.key.localeCompare(b.key));
  return {
    decisions,
    clinicianIds: [...clinician].sort(),
    theirsIds: [...theirs].sort(),
    protectedIds: [...protectedIds].sort(),
    trace,
  };
}

/** Feed-bought, weakly supported, and nothing in their words says they love it. */
function borrowedWeak(tier: KnownTier, attachment: Attachment, s: StackItemLike): boolean {
  if (attachment === 'theirs' || attachment === 'loved') return false;
  // Unknown evidence never clears; mixed evidence only when they said it's borrowed.
  const weak = tier === 'D' || tier === 'N' || (tier === 'C' && attachment === 'borrowed');
  if (!weak) return false;
  // Their own origin, never the population's: someone else's AG1 came from a feed, theirs might not.
  return attachment === 'borrowed' || (!!s.origin && BORROWED_ORIGINS.has(s.origin));
}

/** A habit on autopilot. Things often loved for the company are asked about first. */
function unlovedHabit(attachment: Attachment, v: CatalogItemView): boolean {
  if (attachment === 'theirs' || attachment === 'loved') return false;
  if (attachment === 'unknown' && v.whyLoved.some((w) => SOCIAL_LOVE.has(w))) return false;
  return true;
}

/** The one an overlap group keeps: theirs, loved, better evidence, more used, better value. */
function keeperOf(
  members: readonly StackItemLike[],
  group: OverlapGroupView,
  person: PersonModel,
  stack: readonly StackItemLike[],
  catalog: CatalogView,
): StackItemLike {
  const score = (s: StackItemLike) => {
    const v = catalog.item(s.itemKey);
    const usage = usageOf(s, v);
    const uses = usage.perMonth ?? (usage.unused === true ? 0 : 4);
    return {
      attach: ATTACH_RANK[attachmentOf(person, s)],
      tier: TIER_RANK[tierFor(v, s, stack)],
      uses,
      value: -(Math.max(0, s.monthlyCost) / Math.max(1, uses)),
    };
  };
  const order =
    group.rule === 'keep-most-used'
      ? (['attach', 'uses', 'tier', 'value'] as const)
      : (['attach', 'tier', 'uses', 'value'] as const);
  return [...members].sort((a, b) => {
    const sa = score(a),
      sb = score(b);
    for (const k of order) if (sa[k] !== sb[k]) return sb[k] - sa[k];
    return a.id.localeCompare(b.id);
  })[0]!;
}
