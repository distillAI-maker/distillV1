import { toneLint } from '@distill/engine';
import { describe, expect, it } from 'vitest';
import { catalog } from '../../catalog/server';
import { emptyProgress } from '../../progress/types';
import type { Progress } from '../../progress/types';
import { dollars, fillTemplate, minutes } from '../verdict';
import { createDemoSource } from './index';
import { demoExperimentId, demoInstruction } from './experiments';
import { demoGoals, demoStack } from './stack';

const now = new Date('2026-10-16T12:00:00Z');
const started = (): Progress => {
  const p = { ...emptyProgress(), dataSource: 'demo' as const, goals: demoGoals, items: demoStack() };
  p.dayOne = { ...p.dayOne, started: true, months: 8, firstExperiment: 'coffee-after-2pm' };
  p.items = p.items.map((i) => (i.itemKey === 'coffee-after-2pm' ? { ...i, status: 'testing' as const } : i));
  return p;
};
const startedObserved = (): Progress => {
  const p = started();
  p.dayOne = { ...p.dayOne, firstExperiment: undefined };
  p.items = p.items.map((i) => (i.itemKey === 'alcohol-in-the-evening' ? { ...i, status: 'testing' as const } : i));
  return p;
};
const outcomes = ['helps', 'costs_you', 'no_detectable_benefit', 'too_close_final', 'not_enough_nights'];

describe('the demo experiment', () => {
  const source = createDemoSource(undefined, now);
  it('starts on a Monday at least thirteen days ago and shows the first fortnight, seven on and seven off', async () => {
    const [exp] = await source.experiments(started());
    expect(exp?.startDate).toBe('2026-09-28');
    expect(exp?.nights).toHaveLength(14);
    expect(exp?.schedule.filter((c) => c === 'on')).toHaveLength(7);
    expect(exp?.nights?.at(-1)?.date).toBe('2026-10-12');
    expect(exp?.nights?.at(-1)?.tap).toBe('unknown'); // tonight, not yet tapped
    expect(exp?.nights?.slice(0, 13).every((n) => n.tap === 'did' && n.value !== null)).toBe(true);
    expect(exp?.decision?.status).toBe('in_progress');
  });
  it('locks the metric, the swing and the schedule before day one, and its lines pass toneLint', async () => {
    const [exp] = await source.experiments(started());
    expect(exp?.prereg.lockedAt < `${exp?.startDate}T13`).toBe(true);
    expect(exp?.prereg.metric).toBe('Total sleep');
    expect(exp?.prereg.swing).toBeGreaterThan(0);
    for (const line of [demoInstruction.on, demoInstruction.off])
      expect(toneLint(line, catalog.toneRules)).toEqual([]);
  });
  it('has no experiment before day one is started', async () => {
    const p = { ...emptyProgress(), dataSource: 'demo' as const, items: demoStack() };
    expect(await source.experiments(p)).toEqual([]);
    expect(await source.verdicts(p)).toEqual([]);
  });
  it('gives no verdict until tonight is tapped, then decides or asks for one more week', async () => {
    const p = started();
    expect(await source.verdicts(p)).toEqual([]);
    p.taps = { [demoExperimentId]: { '2026-10-12': { value: 'did' } } };
    const [exp] = await source.experiments(p);
    expect(['ready', 'extend']).toContain(exp?.decision?.status);
    if (exp?.decision?.status === 'ready') {
      expect(exp.status).toBe('done');
      const [v] = await source.verdicts(p);
      expect(outcomes).toContain(v?.outcome);
    } else {
      expect(exp?.status).toBe('running');
      expect(await source.verdicts(p)).toEqual([]);
    }
  });
  it('skipping ahead reaches day 28, where the engine always answers', async () => {
    const p = started();
    p.demoSkipDays = 2;
    let [exp] = await source.experiments(p);
    expect(exp?.nights).toHaveLength(28);
    const tonight = exp!.nights!.at(-1)!.date;
    p.taps = { [demoExperimentId]: { [tonight]: { value: 'did' } } };
    [exp] = await source.experiments(p);
    expect(exp?.status).toBe('done');
    const [v] = await source.verdicts(p);
    expect(v).toBeDefined();
    expect(['Kept', 'Dropped', 'Inconclusive']).toContain(v!.word);
    expect(outcomes).toContain(v!.outcome);
    expect(v!.change).not.toBeNull();
    expect(v!.text).not.toMatch(/\{[^}]+\}/);
    expect(toneLint(v!.text, catalog.toneRules)).toEqual([]);
    expect(v!.effort.days).toBe(28);
  });
  it('a night left out stops counting, and a "didn\'t" counts as the night it was', async () => {
    const p = started();
    p.demoSkipDays = 2;
    const [exp] = await source.experiments(p);
    const nights = exp!.nights!;
    const tonight = nights.at(-1)!.date;
    p.taps = {
      [demoExperimentId]: {
        [tonight]: { value: 'did' },
        [nights[5]!.date]: { value: 'did', excluded: 'Ill' },
        [nights[1]!.date]: { value: 'didnt' },
      },
    };
    const [after] = await source.experiments(p);
    expect(after!.nights!.filter((n) => n.counted)).toHaveLength(27);
    expect(after!.nights![1]!.tap).toBe('didnt');
    expect(after!.status).toBe('done');
  });
});

describe('the demo experiment on an observed item', () => {
  const source = createDemoSource(undefined, now);
  it('runs the engine\'s first pick, alcohol, as observed nights on overnight HRV', async () => {
    const p = startedObserved();
    const [exp] = await source.experiments(p);
    expect(exp?.itemKey).toBe('alcohol-in-the-evening');
    expect(exp?.observeOnly).toBe(true);
    expect(exp?.metric).toBe('Overnight HRV');
    expect(exp?.nights).toHaveLength(14);
    expect(exp?.instruction).toEqual({ on: 'A drink in the evening.', off: 'No drinks tonight.' });
  });
  it('reaches a verdict by day 28 with the person\'s taps read as what happened', async () => {
    const p = startedObserved();
    p.demoSkipDays = 2;
    let [exp] = await source.experiments(p);
    const nights = exp!.nights!;
    p.taps = { [demoExperimentId]: { [nights.at(-1)!.date]: { value: 'didnt' }, [nights[2]!.date]: { value: 'didnt' } } };
    [exp] = await source.experiments(p);
    expect(exp!.nights![2]!.tap).toBe('didnt');
    expect(exp!.status).toBe('done');
    const [v] = await source.verdicts(p);
    expect(outcomes).toContain(v?.outcome);
    expect(toneLint(v!.text, catalog.toneRules)).toEqual([]);
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
