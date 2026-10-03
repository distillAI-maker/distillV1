import { evaluateItemRule } from '@distill/engine';
import type { Item } from '@distill/catalog';
import { describe, expect, it } from 'vitest';
import { catalog } from '../catalog/server';
import { demoGoals, demoStack } from '../data/demo/stack';
import { fieldSpecs } from './fields';
import { itemSpecs, unitLabels } from './items';
import { contextFor, flowState, nextQuestion, ruleAnswers } from './resolve';
import type { Question, Stored } from './resolve';

const byKey = new Map(catalog.items.map((i) => [i.key, i]));
const item = (key: string): Item => {
  const i = byKey.get(key);
  if (!i) throw new Error(key);
  return i;
};
const empty = (): Stored => ({ answers: {}, chips: {}, unknown: [] });
const ctx = { goals: [], inventoryKeys: [] };

/** Answers a question the way a person would, with a plausible value, so the loop can be driven. */
function answer(stored: Stored, q: Question): Stored {
  const next: Stored = { ...stored, answers: { ...stored.answers }, chips: { ...stored.chips }, unknown: [...stored.unknown] };
  switch (q.kind) {
    case 'confirm':
      next.confirmedRead = true;
      break;
    case 'form': {
      const first = q.chips.find((c) => c.value !== null);
      if (first?.value) next.answers.form = first.value;
      else next.unknown.push('form');
      break;
    }
    case 'dose':
      next.answers.dose = 1000;
      break;
    case 'time':
      next.answers.time = q.chips[0]?.value;
      break;
    case 'goal':
      next.answers.goal = 'sleep';
      break;
    case 'bool':
      next.answers[q.field] = false;
      break;
    case 'number':
      next.answers[q.field] = q.min ?? 1;
      break;
    case 'range':
      next.chips[q.field] = q.chips[1]?.label ?? q.chips[0]!.label;
      break;
    case 'exact':
      next.answers[q.field] = q.min ?? 0;
      break;
  }
  return next;
}

describe('follow-ups over the whole catalog', () => {
  it('every field a rule can ask for has a way to ask it', () => {
    const seen = new Set<string>();
    for (const i of catalog.items) {
      let stored = empty();
      for (let n = 0; n < 12; n++) {
        const q = nextQuestion(i, stored, ctx);
        if (!q) break;
        seen.add(q.field);
        const after = answer(stored, q);
        expect(JSON.stringify(after), `${i.key}: ${q.kind} ${q.field} loops`).not.toBe(JSON.stringify(stored));
        stored = after;
      }
      const { result } = { result: evaluateItemRule(i, ruleAnswers(i, stored, ctx).answers) };
      const left = (result.needsAnswers ?? []).filter((f) => f !== 'inventoryKeys' && !stored.unknown.includes(f));
      // Anything still missing must be a field we deliberately cannot ask (none today).
      expect(left, `${i.key} still needs ${left.join(', ')}`).toEqual([]);
    }
    expect(seen.size).toBeGreaterThan(20);
  });

  it('dose units match what each rule reads', () => {
    for (const [key, spec] of Object.entries(itemSpecs)) {
      const i = item(key);
      if (!spec.unit && !spec.unitByForm) continue;
      const forms = spec.forms?.filter((f) => f.value !== null) ?? [{ label: '', value: undefined }];
      for (const f of forms) {
        const unit = (spec.unitByForm && f.value && spec.unitByForm[f.value]) || spec.unit;
        if (!unit) continue;
        const r = evaluateItemRule(i, {
          ...(f.value ? { form: f.value } : {}),
          dose: 1,
          doseUnit: unit,
          goal: 'sleep',
          onMedication: false,
          onAntidepressant: false,
          diabetes: false,
          prediabetes: false,
          deficiency: false,
          namedProblem: false,
        });
        expect(r.needsAnswers ?? [], `${key} ${f.label} ${unit}`).not.toContain('doseUnit');
        expect(r.needsAnswers ?? [], `${key} ${f.label} ${unit}`).not.toContain('dose');
      }
      expect(unitLabels[spec.unit ?? 'mg']).toBeTruthy();
    }
  });

  it('form chips are the strings the rules compare against', () => {
    for (const [key, spec] of Object.entries(itemSpecs)) {
      for (const f of spec.forms ?? []) {
        if (f.value === null) continue;
        const r = evaluateItemRule(item(key), { form: f.value, dose: 1000, doseUnit: spec.unit ?? 'mg', goal: 'sleep', deficiency: false, namedProblem: false });
        expect(r.needsAnswers ?? [], `${key} form ${f.value}`).not.toContain('form');
      }
      for (const t of spec.times ?? []) {
        const r = evaluateItemRule(item(key), { time: t.value });
        expect(r.needsAnswers ?? [], `${key} time ${t.value}`).not.toContain('time');
      }
    }
  });

  it('every item with a form or time question in the sheet has chips here', () => {
    for (const i of catalog.items) {
      const q = nextQuestion(i, empty(), ctx);
      if (q?.kind === 'form' || q?.kind === 'time') expect(itemSpecs[i.key], i.key).toBeTruthy();
    }
  });

  it('range chips carry whole-number bounds', () => {
    for (const [field, spec] of Object.entries(fieldSpecs)) {
      if (spec.kind !== 'range') continue;
      for (const c of spec.chips) {
        expect(c.min, `${field} ${c.label}`).toBeLessThanOrEqual(c.max);
        expect(Number.isInteger(c.min) && Number.isInteger(c.max)).toBe(true);
      }
    }
  });
});

describe('threshold chips (OPEN_QUESTIONS THRESHOLD_CHIPS)', () => {
  it('sauna membership: "1 to 3" visits crosses the rule line, so the exact count is asked', () => {
    const i = item('sauna-bathhouse-membership');
    const q1 = nextQuestion(i, empty(), ctx);
    expect(q1).toMatchObject({ kind: 'range', field: 'visitsLast30Days' });
    const q2 = nextQuestion(i, { ...empty(), chips: { visitsLast30Days: '1 to 3' } }, ctx);
    expect(q2).toMatchObject({ kind: 'exact', field: 'visitsLast30Days', chip: '1 to 3' });
    const q3 = nextQuestion(i, { ...empty(), chips: { visitsLast30Days: '4 to 7' } }, ctx);
    expect(q3).toBeNull();
  });
  it('meditation app: "1 to 3 months ago" straddles 30 days, so the exact day count is asked', () => {
    const i = item('meditation-app-calm-headspace');
    const s1: Stored = { ...empty(), answers: { stillPaying: true } };
    expect(nextQuestion(i, s1, ctx)).toMatchObject({ kind: 'range', field: 'lastUsed' });
    const s2: Stored = { ...s1, chips: { lastUsed: '1 to 3 months ago' } };
    expect(nextQuestion(i, s2, ctx)).toMatchObject({ kind: 'exact', field: 'daysSinceLastUse' });
    const s3: Stored = { ...s1, chips: { lastUsed: 'This month' } };
    expect(nextQuestion(i, s3, ctx)).toBeNull();
    const s4: Stored = { ...s2, answers: { stillPaying: true, daysSinceLastUse: 60 } };
    expect(nextQuestion(i, s4, ctx)).toBeNull();
    expect(evaluateItemRule(i, ruleAnswers(i, s4, ctx).answers)).toMatchObject({ tier: 'T2', reason: 'not being used' });
  });
  it('late dinner: "1.5 to 3 hours" meets the 90-minute gap, so minutes are asked; "under 1.5" is enough', () => {
    const i = item('late-dinner-within-2-3-h-of-bed');
    expect(nextQuestion(i, { ...empty(), chips: { dinnerToBedMinutes: '1.5 to 3 hours' } }, ctx)).toMatchObject({ kind: 'exact' });
    expect(nextQuestion(i, { ...empty(), chips: { dinnerToBedMinutes: 'Under 1.5 hours' } }, ctx)).toBeNull();
  });
  it('a doctor or blood test origin asks nothing', () => {
    expect(nextQuestion(item('magnesium-any-form'), { ...empty(), origin: 'doctor' }, ctx)).toBeNull();
  });
  it('"not sure" stops the question without pretending to an answer', () => {
    const i = item('cbd');
    expect(nextQuestion(i, empty(), ctx)).toMatchObject({ kind: 'bool', field: 'onMedication' });
    expect(nextQuestion(i, { ...empty(), unknown: ['onMedication'] }, ctx)).toBeNull();
    expect(evaluateItemRule(i, ruleAnswers(i, { ...empty(), unknown: ['onMedication'] }, ctx).answers).tier).toBe('T3');
  });
});

describe('the demo stack', () => {
  const stack = demoStack();
  const progress = { goals: demoGoals, items: stack };
  const context = contextFor(progress);
  const pairs = stack.filter((s) => s.itemKey).map((s) => ({ stack: s, item: item(s.itemKey!) }));

  it('has 21 items that sum to the sheet total', () => {
    expect(stack).toHaveLength(21);
    expect(stack.reduce((t, s) => t + s.monthlyCost, 0)).toBe(1428);
  });
  it('shows every prefilled answer once as a confirmation, twelve in all', () => {
    const seen = new Set<string>();
    const order: string[] = [];
    let live = pairs;
    for (let n = 0; n < 40; n++) {
      const s = flowState(live, context, seen);
      if (!s.current) break;
      if (s.current.question.kind !== 'confirm')
        expect(s.current.prefilled, s.current.id).not.toBeUndefined();
      order.push(`${s.current.item.key}:${s.current.question.kind}`);
      seen.add(s.current.id);
      // "That's right" on a confirmation
      if (s.current.question.kind === 'confirm') {
        const id = s.current.stackId;
        live = live.map((p) => (p.stack.id === id ? { ...p, stack: { ...p.stack, confirmedRead: true } } : p));
      }
    }
    // Magnesium's goal is never asked: at 120 mg the rule settles on "dose too low" first.
    expect(order).toEqual([
      'meditation-app-calm-headspace:bool',
      'meditation-app-calm-headspace:range',
      'meditation-app-calm-headspace:exact',
      'magnesium-any-form:form',
      'magnesium-any-form:dose',
      'omega-3-fish-oil:dose',
      'facials-monthly:bool',
      'facials-monthly:range',
      'coffee-after-2pm:time',
      'alcohol-in-the-evening:range',
      'training-after-7pm:confirm',
      'late-dinner-within-2-3-h-of-bed:range',
    ]);
    expect(flowState(live, context, seen).current).toBeNull();
  });
  it('lands each answered item where the sheet says', () => {
    const land = (key: string) => {
      const s = stack.find((x) => x.itemKey === key)!;
      return evaluateItemRule(item(key), ruleAnswers(item(key), s, context).answers);
    };
    expect(land('magnesium-any-form')).toMatchObject({ tier: 'T2', reason: 'dose too low' });
    expect(land('omega-3-fish-oil')).toMatchObject({ tier: 'T2', reason: 'dose too low' });
    expect(land('meditation-app-calm-headspace')).toMatchObject({ tier: 'T2', reason: 'not being used' });
    expect(land('coffee-after-2pm')).toMatchObject({ tier: 'T1' });
    expect(land('alcohol-in-the-evening')).toMatchObject({ tier: 'T1', onDays: 'observe' });
    expect(land('training-after-7pm')).toMatchObject({ tier: 'T1', expectedEffect: 1 });
    expect(land('late-dinner-within-2-3-h-of-bed')).toMatchObject({ tier: 'T1', expectedEffect: 0.8 });
    expect(land('facials-monthly')).toMatchObject({ tier: 'T3' });
  });
  it('asks the demo person about twelve things when the answers are cleared', () => {
    let count = 0;
    for (const p of pairs) {
      let stored: Stored = { origin: p.stack.origin, answers: {}, chips: {}, unknown: [], readFrom: p.stack.readFrom };
      for (let n = 0; n < 12; n++) {
        const q = nextQuestion(p.item, stored, context);
        if (!q) break;
        count++;
        stored = answer(stored, q);
      }
    }
    expect(count).toBeGreaterThanOrEqual(10);
    expect(count).toBeLessThanOrEqual(16);
  });
});
