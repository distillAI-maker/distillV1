import { describe, expect, it } from 'vitest';
import { allowedNumbersFrom, checkLine } from './check-line.js';
import { exploreGate } from './explore.js';
import { pickToday, type PickTodayInput } from './pick-today.js';
import { v3 } from './test-support.js';
import type { Decision } from './types.js';

const stamp = { engineVersion: 't', catalogVersion: 't', inputsHash: 't' };
const decision = (id: string, over: Partial<Decision>): Decision => ({
  id,
  stackItemId: id,
  itemKey: null,
  kind: 'clear',
  reason: 'BORROWED_WEAK',
  line: '',
  money: 20,
  status: 'proposed',
  engine: stamp,
  createdAt: '2026-10-20T00:00:00Z',
  ...over,
});
const input = (over: Partial<PickTodayInput> = {}): PickTodayInput => ({
  personId: 'p1',
  today: '2026-10-21',
  season: 'steady',
  decisions: [],
  questions: [],
  history: [],
  moreLeft: [],
  exploreOpen: false,
  ...over,
});

describe("today's one thing", () => {
  it('puts a dermatologist referral first', () => {
    const r = pickToday(input({ decisions: [decision('ag1', { money: 99 }), decision('ret', { kind: 'refer', reason: 'SEE_A_DERMATOLOGIST' })] }));
    expect(r.pick!.kind).toBe('refer');
  });
  it('clears with a rhythm: not two days running, and not more than three days without', () => {
    const decisions = [decision('ag1', { money: 99 }), decision('gum', { money: 20 })];
    const questions = [{ id: 'q:x:origin', stackItemId: 'x', variable: 'origin' as const, name: 'X', text: 'Where?', options: [], value: 30 }];
    expect(pickToday(input({ decisions, questions })).pick!.kind).toBe('clear');
    const afterClear = pickToday(input({ decisions, questions, history: [{ date: '2026-10-20', kind: 'clear', ref: 'ag1' }] }));
    expect(afterClear.pick!.kind).toBe('question');
  });
  it('a busy week gets small, kind things, and an unwell day can be quiet', () => {
    const decisions = [decision('ag1', { money: 99 })];
    expect(pickToday(input({ season: 'busy', decisions })).pick).toBeNull();
    const keep = decision('cr', { kind: 'keep', reason: 'EVIDENCE_REGULAR', evidenceTier: 'A' });
    expect(pickToday(input({ season: 'busy', decisions: [...decisions, keep] })).pick!.kind).toBe('keep');
    expect(pickToday(input({ season: 'unwell', decisions: [...decisions, keep] })).pick).toBeNull();
  });
  it('draws fairly among equals and logs the chance, the same draw on every rebuild', () => {
    const decisions = [decision('a', { money: 20 }), decision('b', { money: 25 }), decision('c', { money: 200 })];
    const r = pickToday(input({ decisions }));
    expect(r.pick!.ref).toBe('c');
    expect(r.propensity).toBe(1);
    const equal = [decision('a', { money: 20 }), decision('b', { money: 25 })];
    const one = pickToday(input({ decisions: equal }));
    expect(one.propensity).toBe(0.5);
    expect(pickToday(input({ decisions: equal })).pick).toEqual(one.pick);
  });
  it('does not offer the same thing again within five days', () => {
    const decisions = [decision('ag1', { money: 99 })];
    expect(pickToday(input({ decisions, history: [{ date: '2026-10-18', kind: 'question', ref: 'ag1' }] })).pick).toBeNull();
  });
});

describe('explore opens when room is made', () => {
  const gate = { today: '2026-10-30', ritualAcceptedOn: '2026-10-21', clearsAccepted: 1, clearsOpen: 2, clearsEver: 3, season: 'steady' as const, threadOpen: false };
  it('opens after a week with something cleared', () => expect(exploreGate(gate).open).toBe(true));
  it('waits for the first week and for room', () => {
    expect(exploreGate({ ...gate, today: '2026-10-25' }).open).toBe(false);
    expect(exploreGate({ ...gate, clearsAccepted: 0 }).open).toBe(false);
  });
  it('counts an already clean stack as room made', () => {
    expect(exploreGate({ ...gate, clearsAccepted: 0, clearsOpen: 0, clearsEver: 0 }).open).toBe(true);
  });
  it('stays closed in a busy season', () => expect(exploreGate({ ...gate, season: 'busy' }).open).toBe(false));
});

describe('every line is checked', () => {
  const ctx = (over = {}) => ({
    toneRules: v3.toneRules,
    allowedNumbers: allowedNumbersFrom('coffee walk at 10:00', 'out late with the team tonight', '$90'),
    names: ['Sam', 'Leo'],
    maxWords: 40,
    ...over,
  });
  it('lets a warm, specific reply through', () => {
    expect(checkLine('Have the best night with the team. Saturday starts slow, then your coffee walk with Sam and Leo at 10.', ctx())).toEqual([]);
  });
  it('catches "a ritual", health numbers, numbers that are not theirs, invented people and claims', () => {
    const codes = (t: string) => checkLine(t, ctx()).map((i) => i.code);
    expect(codes('This could become a ritual you love.')).toContain('RITUAL_WORD');
    expect(codes('Your sleep was 45 minutes short.')).toContain('HEALTH_NUMBER');
    expect(codes('Meet at 7 for a walk.')).toContain('NUMBER');
    expect(codes('A walk with Priya would be lovely.')).toContain('NAME');
    expect(codes('Magnesium is proven to help.')).toContain('CLAIM');
    expect(codes('You should rest.')).toContain('TONE');
  });
});
