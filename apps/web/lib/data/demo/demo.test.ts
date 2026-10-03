import { toneLint } from '@distill/engine';
import { describe, expect, it } from 'vitest';
import { catalog } from '../../catalog/server';
import { emptyProgress } from '../../progress/types';
import { dollars, fillTemplate, minutes } from '../verdict';
import { createDemoSource } from './index';
import { demoEffect, demoExperiment, demoExperimentId, demoNights } from './experiments';
import { demoGoals, demoStack } from './stack';

const now = new Date('2026-10-16T12:00:00Z');
const started = () => {
  const p = { ...emptyProgress(), dataSource: 'demo' as const, goals: demoGoals, items: demoStack() };
  p.dayOne = { ...p.dayOne, started: true, months: 8 };
  p.items = p.items.map((i) => (i.itemKey === 'coffee-after-2pm' ? { ...i, status: 'testing' as const } : i));
  return p;
};

describe('the demo experiment fixture', () => {
  it('is fourteen nights, seven on and seven off, with today as day 14', () => {
    const exp = demoExperiment(now, 8);
    expect(exp.schedule).toHaveLength(14);
    expect(exp.schedule.filter((c) => c === 'on')).toHaveLength(7);
    const nights = demoNights(now);
    expect(nights[13]?.date).toBe('2026-10-16');
    expect(nights[0]?.date).toBe('2026-10-03');
    expect(nights.filter((n) => n.tap === 'unknown')).toHaveLength(2); // day 9 missed, day 14 not yet
  });
  it('locks the metric and the pass line before day one', () => {
    const exp = demoExperiment(now, 8);
    expect(exp.prereg.lockedAt < `${exp.startDate}T12`).toBe(true);
    expect(exp.prereg.metric).toBe(exp.metric);
  });
  it('instruction lines pass toneLint (OPEN_QUESTIONS: INSTRUCTION_LINES)', () => {
    const exp = demoExperiment(now, 8);
    for (const line of [exp.instruction.on, exp.instruction.off]) expect(toneLint(line, catalog.toneRules)).toEqual([]);
  });
  it('the on-nights run shorter by more than the swing', () => {
    const { change } = demoEffect();
    expect(change).toBeLessThan(-40);
  });
});

describe('fillTemplate', () => {
  const dropped = catalog.verdictTemplates.find((t) => t.name === 'Tier 1, dropped')!;
  it('fills every placeholder and omits the money clause at $0', () => {
    const text = fillTemplate(dropped, {
      item: 'Coffee after 2pm',
      number: 'your total sleep',
      change: minutes(-51),
      swing: minutes(40),
      months: 8,
      source_clause: '',
      cost: dollars(0),
    });
    expect(text).toBe(
      'Coffee after 2pm: your total sleep was 51 minutes worse on the days you did it, outside your normal swing of 40 minutes. 8 months in. Dropped.',
    );
    expect(toneLint(text, catalog.toneRules)).toEqual([]);
  });
  it('keeps the money clause when there is money', () => {
    const text = fillTemplate(dropped, {
      item: 'X',
      number: 'n',
      change: '1 minute',
      swing: '2 minutes',
      months: 3,
      source_clause: ", on a friend's word",
      cost: dollars(30),
    });
    expect(text.endsWith('Dropped, and $30 a month back.')).toBe(true);
    expect(text).toContain("3 months in, on a friend's word.");
  });
  it('refuses to leave a placeholder unfilled', () => {
    expect(() => fillTemplate(dropped, { item: 'X' })).toThrow(/Missing placeholder/);
  });
});

describe('the demo data source', () => {
  const source = createDemoSource(catalog.verdictTemplates, now);
  it('has no experiment before day one is started', async () => {
    const p = { ...emptyProgress(), dataSource: 'demo' as const, items: demoStack() };
    expect(await source.experiments(p)).toEqual([]);
    expect(await source.verdicts(p)).toEqual([]);
  });
  it('runs coffee at day 14 and gives no verdict until the last tap', async () => {
    const p = started();
    const [exp] = await source.experiments(p);
    expect(exp?.status).toBe('running');
    expect(await source.verdicts(p)).toEqual([]);
  });
  it('after the last tap, the verdict is the filled template and passes toneLint', async () => {
    const p = started();
    p.taps = { [demoExperimentId]: { '2026-10-16': { value: 'did' } } };
    const [exp] = await source.experiments(p);
    expect(exp?.status).toBe('done');
    const [v] = await source.verdicts(p);
    expect(v?.word).toBe('Dropped');
    expect(v?.change).toBe(-51);
    expect(v?.effort).toEqual({ days: 14, taps: 13 });
    expect(v?.text).toBe(
      'Coffee after 2pm: your total sleep was 51 minutes worse on the days you did it, outside your normal swing of 40 minutes. 8 months in. Dropped.',
    );
    expect(toneLint(v!.text, catalog.toneRules)).toEqual([]);
  });
  it('a night left out stops counting', async () => {
    const p = started();
    p.taps = { [demoExperimentId]: { '2026-10-16': { value: 'did' }, '2026-10-15': { value: 'did', excluded: 'Ill' } } };
    const [v] = await source.verdicts(p);
    expect(v?.nights.filter((n) => n.counted)).toHaveLength(13);
  });
});
