import type { Item } from '@distill/catalog';
import { evaluateItemRule } from '@distill/engine';
import type { EvaluatedRule, RuleAnswers } from '@distill/engine';
import type { StackItem } from '../progress/types';
import { fieldSpecs } from './fields';
import type { AskableField, RangeChip } from './fields';
import { engineGoalsFor } from './goals';
import { itemSpecs } from './items';
import type { DoseUnit, ItemSpec } from './items';

/**
 * Turns what a person tapped into what a rule reads, and asks the rule what is still missing.
 * Chips that cover a range are probed across the whole range: when the rule lands the same
 * everywhere, the chip is enough; when it does not, the exact value is asked for. No threshold is
 * copied out of the engine.
 */

export interface Context {
  /** Goal names from the Goal to Number sheet. */
  goals: string[];
  /** Every listed catalog key, for overlap checks. */
  inventoryKeys: string[];
}

export type Stored = Pick<
  StackItem,
  'origin' | 'answers' | 'chips' | 'unknown' | 'readFrom' | 'confirmedRead'
>;

export type Question =
  | { kind: 'confirm'; field: 'readFrom'; source: string; summary: string }
  | { kind: 'form'; field: 'form'; chips: NonNullable<ItemSpec['forms']> }
  | {
      kind: 'dose';
      field: 'dose';
      unit: DoseUnit;
      perServing?: ItemSpec['perServing'];
      presets?: number[];
    }
  | { kind: 'time'; field: 'time'; chips: NonNullable<ItemSpec['times']> }
  | { kind: 'goal'; field: 'goal' }
  | { kind: 'bool'; field: AskableField; notSure: boolean }
  | {
      kind: 'number';
      field: AskableField;
      unit?: string;
      min?: number;
      max?: number;
      step?: number;
    }
  | { kind: 'range'; field: AskableField; chips: RangeChip[] }
  | { kind: 'exact'; field: AskableField; unit?: string; min?: number; max?: number; chip: string };

const protectedOrigins = new Set(['doctor', 'blood test']);
export const emptyStored = (): Stored => ({ answers: {}, chips: {}, unknown: [] });

function sameOutcome(a: EvaluatedRule, b: EvaluatedRule): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function sampleRange(min: number, max: number): number[] {
  if (max - min <= 200) return Array.from({ length: max - min + 1 }, (_, i) => min + i);
  const out = new Set<number>([min, max]);
  for (let k = 1; k < 10; k++) out.add(Math.round(min + ((max - min) * k) / 10));
  return [...out];
}

/** The rule lands the same way for every value in the range, so the chip is enough. */
export function rangeIsEnough(
  item: Item,
  base: RuleAnswers,
  field: AskableField,
  chip: RangeChip,
): boolean {
  let first: EvaluatedRule | null = null;
  for (const v of sampleRange(chip.min, chip.max)) {
    const r = evaluateItemRule(item, { ...base, [field]: v });
    if (!first) first = r;
    else if (!sameOutcome(first, r)) return false;
  }
  return true;
}

function unitFor(spec: ItemSpec | undefined, form: unknown): DoseUnit | undefined {
  if (!spec) return undefined;
  if (spec.unitByForm && typeof form === 'string' && spec.unitByForm[form])
    return spec.unitByForm[form];
  return spec.unit;
}

/** The field a range chip is probed on: lastUsed chips stand in for a day count. */
const probeFieldFor = (field: string): AskableField =>
  (field === 'lastUsed' ? 'daysSinceLastUse' : field) as AskableField;
const chipFieldFor = (field: string): AskableField =>
  (field === 'daysSinceLastUse' ? 'lastUsed' : field) as AskableField;

/** The answers the rule reads: origin, the person's goals, inventory, typed values, and ranges that are enough. */
export function ruleAnswers(
  item: Item,
  stored: Stored,
  ctx: Context,
): { answers: RuleAnswers; needsExact: AskableField[] } {
  const base: Record<string, unknown> = {};
  if (stored.origin) base.source = stored.origin;
  base.inventoryKeys = ctx.inventoryKeys;
  const spec = itemSpecs[item.key];
  for (const [k, v] of Object.entries(stored.answers))
    if (v !== undefined && v !== null && k !== 'servingAmount' && k !== 'servingsPerDay') base[k] = v;
  if (base.dose !== undefined && base.doseUnit === undefined) {
    const unit = unitFor(spec, base.form);
    if (unit) base.doseUnit = unit;
  }
  if (base.goal === undefined) {
    const mine = engineGoalsFor(ctx.goals);
    if (mine.length === 1) base.goal = mine[0];
  }
  const needsExact: AskableField[] = [];
  for (const [field, label] of Object.entries(stored.chips)) {
    const fs = fieldSpecs[field as AskableField];
    if (!fs || fs.kind !== 'range') continue;
    const chip = fs.chips.find((c) => c.label === label);
    if (!chip) continue;
    if (chip.also) Object.assign(base, chip.also);
    const probeField = probeFieldFor(field);
    if (base[probeField] !== undefined) continue;
    if (rangeIsEnough(item, base as RuleAnswers, probeField, chip)) base[probeField] = chip.min;
    else needsExact.push(probeField);
  }
  return { answers: base as RuleAnswers, needsExact };
}

export function evaluate(
  item: Item,
  stored: Stored,
  ctx: Context,
): { result: EvaluatedRule; needsExact: AskableField[] } {
  const { answers, needsExact } = ruleAnswers(item, stored, ctx);
  return { result: evaluateItemRule(item, answers), needsExact };
}

/** The next thing to ask about this item, or null when the rule has what it needs (or nothing more can be asked). */
export function nextQuestion(item: Item, stored: Stored, ctx: Context): Question | null {
  if (stored.origin && protectedOrigins.has(stored.origin)) return null;
  if (stored.readFrom && !stored.confirmedRead)
    return {
      kind: 'confirm',
      field: 'readFrom',
      source: stored.readFrom.source,
      summary: stored.readFrom.summary,
    };
  const spec = itemSpecs[item.key];
  const { result, needsExact } = evaluate(item, stored, ctx);
  const needs = (result.needsAnswers ?? []).filter(
    (f) => f !== 'inventoryKeys' && !stored.unknown.includes(f),
  ) as AskableField[];
  for (const field of needs) {
    if (field === 'dose' || field === 'doseUnit') {
      const unit = unitFor(spec, stored.answers.form);
      if (!unit || stored.answers.dose !== undefined) continue;
      return {
        kind: 'dose',
        field: 'dose',
        unit,
        perServing: spec?.perServing,
        presets: spec?.presets,
      };
    }
    if (field === 'form') {
      if (!spec?.forms || stored.answers.form !== undefined) continue;
      return { kind: 'form', field: 'form', chips: spec.forms };
    }
    if (field === 'time') {
      if (!spec?.times || stored.answers.time !== undefined) continue;
      return { kind: 'time', field: 'time', chips: spec.times };
    }
    if (field === 'goal') {
      if (stored.answers.goal !== undefined) continue;
      return { kind: 'goal', field: 'goal' };
    }
    const fs = fieldSpecs[field];
    if (!fs) continue;
    if (fs.kind === 'range') {
      const chipField = chipFieldFor(field);
      const chip = stored.chips[chipField];
      if (stored.answers[field] !== undefined) continue;
      if (chip && needsExact.includes(field))
        return { kind: 'exact', field, unit: fs.exactUnit, min: fs.exactMin, max: fs.exactMax, chip };
      if (!chip) return { kind: 'range', field: chipField, chips: fs.chips };
      continue;
    }
    if (stored.answers[field] !== undefined) continue;
    if (fs.kind === 'bool') return { kind: 'bool', field, notSure: Boolean(fs.notSure) };
    if (fs.kind === 'number')
      return { kind: 'number', field, unit: fs.unit, min: fs.min, max: fs.max, step: fs.step };
  }
  return null;
}

/** What the person has for a question, if anything: an answer, a chip, "not sure" or a confirmation. */
export function storedValue(stored: Stored, q: Question): unknown {
  switch (q.kind) {
    case 'confirm':
      return stored.confirmedRead ? true : undefined;
    case 'range':
      return stored.chips[q.field];
    case 'form':
      if (stored.unknown.includes('form')) return null;
      return stored.chips.form ?? q.chips.find((c) => c.value === stored.answers.form)?.label;
    case 'time':
      return stored.chips.time ?? q.chips.find((c) => c.value === stored.answers.time)?.label;
    case 'dose':
      return stored.answers.dose;
    case 'bool':
      return stored.unknown.includes(q.field) ? null : stored.answers[q.field];
    default:
      return stored.answers[q.field];
  }
}

/** Copies the stored answer for one question onto a replay state. */
function applyStored(cur: Stored, stored: Stored, q: Question): Stored {
  const next: Stored = {
    ...cur,
    answers: { ...cur.answers },
    chips: { ...cur.chips },
    unknown: [...cur.unknown],
  };
  if (q.kind === 'confirm') {
    // "That's right": every value the wearable (or the fixture) supplied stands.
    next.confirmedRead = true;
    Object.assign(next.answers, stored.answers);
    Object.assign(next.chips, stored.chips);
  } else if (q.kind === 'range') {
    if (stored.chips[q.field] !== undefined) next.chips[q.field] = stored.chips[q.field] as string;
  } else {
    const f = q.field;
    if (stored.unknown.includes(f)) next.unknown.push(f);
    for (const key of [f, 'servingAmount', 'servingsPerDay'])
      if (q.kind === 'dose' || key === f) {
        if (stored.answers[key] !== undefined) next.answers[key] = stored.answers[key];
      }
    if (stored.chips[f] !== undefined) next.chips[f] = stored.chips[f] as string;
  }
  return next;
}

export interface Asked {
  id: string;
  stackId: string;
  item: Item;
  question: Question;
  /** The person's existing answer, if any: it is shown as a confirmation. Labels for chips. */
  prefilled: unknown;
  /** The stored answers, for the view to prefill number boxes. */
  stored: Stored;
}

/**
 * Replays the questions this item would be asked, from nothing, using the person's stored
 * answers to move on. Stops at the first question not yet seen; that is the current one. A
 * prefilled answer (demo data, a wearable) is still shown once, as a confirmation.
 */
export function replay(stackId: string, item: Item, stored: Stored, ctx: Context, seen: Set<string>): { asked: Asked[]; current: Asked | null } {
  const asked: Asked[] = [];
  let cur: Stored = { origin: stored.origin, answers: {}, chips: {}, unknown: [], readFrom: stored.readFrom };
  for (let n = 0; n < 24; n++) {
    const question = nextQuestion(item, cur, ctx);
    if (!question) break;
    const id = `${stackId}:${question.field}`;
    const prefilled = storedValue(stored, question);
    const entry: Asked = { id, stackId, item, question, prefilled, stored };
    if (!seen.has(id)) return { asked, current: entry };
    if (prefilled === undefined) return { asked, current: entry }; // seen but unanswered: ask again
    asked.push(entry);
    const after = applyStored(cur, stored, question);
    if (JSON.stringify(after) === JSON.stringify(cur)) break; // nothing changed; avoid a loop
    cur = after;
  }
  return { asked, current: null };
}

export function contextFor(progress: { goals: string[]; items: StackItem[] }): Context {
  return {
    goals: progress.goals,
    inventoryKeys: progress.items.map((i) => i.itemKey).filter((k): k is string => Boolean(k)),
  };
}

/** The whole flow: questions already answered, the current one, and how many items still wait. */
export function flowState(
  pairs: { stack: StackItem; item: Item }[],
  ctx: Context,
  seen: Set<string>,
): { answered: Asked[]; current: Asked | null; waiting: number } {
  const answered: Asked[] = [];
  let current: Asked | null = null;
  let waiting = 0;
  for (const { stack, item } of pairs) {
    const r = replay(stack.id, item, stack, ctx, seen);
    if (current) {
      if (r.current) waiting++;
      continue;
    }
    answered.push(...r.asked);
    if (r.current) current = r.current;
  }
  return { answered, current, waiting };
}
