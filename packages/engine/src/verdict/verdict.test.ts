import { describe, expect, it } from 'vitest';
import catalog from '../../../../data/catalog.json' with { type: 'json' };
import { createDemoUsers } from '../../../sim/src/demo.js';
import type { AnalysisResult } from '../stats/types.js';
import { routeStack } from '../route/index.js';
import { renderTemplate, sourceClause, createVerdictRenderer, templateNames } from './templates.js';
import type { Catalog } from '@distill/catalog';
import { verdictExamples } from './examples.js';
import {
  formatChange,
  formatMeasurement,
  formatMoney,
  formatDose,
  roundMeasurement,
} from './format.js';
import { renderAuditVerdict, renderExperimentVerdict } from './render.js';
import { renderHistoryVerdict, renderMorningObservation } from './observations.js';
import { itemHistoryHypothesis } from '../experiment/history.js';
import { toneLint } from '../tone.js';

describe('exact filled workbook templates', () => {
  it('covers each of the 17 original templates exactly once', () => {
    expect(verdictExamples.map((example) => example.id).sort()).toEqual(
      Object.keys(templateNames).sort(),
    );
    expect(Object.values(templateNames).sort()).toEqual(
      catalog.verdictTemplates.map((template) => template.name).sort(),
    );
  });
  it.each(verdictExamples)('fills and snapshots $id', ({ id, values }) => {
    const result = renderTemplate(id, values);
    expect(result.text).toMatchSnapshot();
    expect(
      toneLint(result.text, (catalog as unknown as Catalog).toneRules, { gated: id === 'gated' }),
    ).toEqual([]);
    expect(result.text).not.toMatch(/[{}]/);
    expect(result.source.sheet).toBe('Verdict Templates');
  });
  it('rejects missing/extra slots, nested tokens, controls, banned substitutions and overlong filled text', () => {
    expect(() => renderTemplate('kept', { item: 'Walk' } as never)).toThrow('Missing value');
    expect(() => renderTemplate('free', { item: 'Walk', alpha: 0.05 } as never)).toThrow(
      'Unexpected',
    );
    for (const item of [
      '{cost}',
      'Walk\n',
      'Walk!',
      'Boost pill',
      Array(60).fill('walk').join(' '),
    ])
      expect(() => renderTemplate('free', { item })).toThrow();
    expect(() => renderTemplate('protected', { item: 'The user' })).toThrow('THIRD_PERSON');
  });
  it('maps source context once, never invents why an item was bought, and keeps Protected sources out', () => {
    expect(sourceClause()).toBe('');
    expect(sourceClause('other')).toBe('');
    expect(sourceClause('online')).toBe(sourceClause('influencer'));
    expect(sourceClause('ad')).toBe(', from an ad');
    expect(sourceClause("don't remember")).toContain("don't remember why");
    for (const source of ['doctor', 'blood test'])
      expect(() => sourceClause(source as never)).toThrow('Protected');
    expect(() => sourceClause('random' as never)).toThrow('Unknown');
    const fixture = verdictExamples.find((example) => example.id === 'noEvidence')!;
    if (fixture.id !== 'noEvidence') throw new Error('Wrong fixture');
    const text = renderTemplate(fixture.id, { ...fixture.values, source_clause: 'friend' }).text;
    expect(text.match(/on a friend's word/g)).toHaveLength(1);
  });
  it('keeps the original two-sentence Protected template available for source review', () => {
    expect(renderTemplate('protected', { item: 'Iron' }).text).toBe(
      catalog.verdictTemplates
        .find((template) => template.name === 'Protected')!
        .template.replace('{item}', 'Iron'),
    );
  });
  it('records the source-clause lookup verbatim so workbook revisions require review', () => {
    expect(catalog.sourceClausesText).toMatchSnapshot();
  });
  it('captures the source and rules so later caller mutations cannot change rendering', () => {
    const input = structuredClone(catalog) as unknown as Catalog,
      renderer = createVerdictRenderer(input);
    input.verdictTemplates[0]!.template = 'A different string';
    input.toneRules.bannedPhrases.push('walk');
    expect(renderer.render('free', { item: 'Walk' }).text).toContain('costs nothing');
  });
});
describe('measurement and money formatting', () => {
  it.each([
    [12.49, 'minutes', 12],
    [12.5, 'minutes', 13],
    [-12.5, 'minutes', -13],
    [6.49, 'ms', 6],
    [6.5, 'ms', 7],
    [52.24, 'bpm', 52],
    [52.25, 'bpm', 52.5],
    [52.75, 'bpm', 53],
    [-0.25, 'bpm', -0.5],
    [0.049, 'celsius', 0],
  ] as const)('rounds %s %s to %s', (input, unit, expected) =>
    expect(roundMeasurement(input, unit)).toBe(expected),
  );
  it('preserves units and small real changes without negative zero or artificial zero', () => {
    expect(formatChange(0.1, 'minutes')).toBe('less than 1 minute');
    expect(formatChange(-0.1, 'bpm')).toBe('less than 0.5 bpm');
    expect(formatChange(0, 'ms')).toBe('0 ms');
    expect(formatMeasurement(-0.01, 'minutes')).toBe('0 minutes');
    expect(formatMeasurement(15.34, 'percent')).toBe('15.3%');
    expect(formatMeasurement(3.14, 'percentage_points')).toBe('3.1 percentage points');
    expect(formatMeasurement(0.26, 'celsius')).toBe('0.3 °C');
    expect(formatMoney(1428)).toBe('$1,428');
    expect(formatMoney(10.125)).toBe('$10.13');
    expect(formatDose(120, 'mg elemental')).toBe('120 mg elemental');
    expect(formatDose(0.001, 'g')).toBe('0.001 g');
    expect(() => formatDose(1, 'capsules')).toThrow();
    for (const number of [NaN, Infinity, -Infinity])
      expect(() => formatMeasurement(number, 'minutes')).toThrow();
    expect(() => formatMoney(-1)).toThrow();
  });
});
describe('history and confirmed observational nights', () => {
  it('uses confirmed history as a hypothesis with counts, units and no causal verdict', () => {
    const user = users[0]!;
    const hypothesis = itemHistoryHypothesis(
      user.audit.runnable.find((item) => item.id === 'coffee')!,
      user.person.history,
      user.checkIns.map((entry) => ({
        sleepDate: entry.sleepDate,
        exposure: entry.exposure,
        confirmed: entry.exposure !== 'unknown',
        provenance: 'self_report' as const,
      })),
      user.registration.channel,
      user.asOf,
    )!;
    const text = renderHistoryVerdict(hypothesis, {
      itemName: 'Skip afternoon coffee',
      didIt: 'skipped afternoon coffee',
      monthsCovered: 6,
      direction: 'higher',
    });
    expect(text.status).toBe('ready');
    expect(text.text).toContain('pattern, not proof');
    expect(text.text).toMatchSnapshot();
    expect(text.text).not.toContain('Kept.');
    expect(
      renderHistoryVerdict(
        { ...hypothesis, difference: 0 },
        { itemName: 'Coffee', didIt: 'had coffee', monthsCovered: 6, direction: 'higher' },
      ).status,
    ).toBe('needs_review');
  });
  it('renders an observed lower HRV with rounded ms and waking, and rejects unmatched source claims', () => {
    const input = {
      what: 'drinking',
      metric: 'overnightHrvMs' as const,
      metricName: 'Overnight HRV',
      observed: 41.4,
      usual: 60.3,
      awakeExcessMinutes: 34.2,
      remaining: 12,
    };
    const text = renderMorningObservation(input);
    expect(text.status).toBe('ready');
    expect(text.text).toMatchSnapshot();
    expect(text.text).toContain('19 ms');
    expect(text.text).toContain('34 minutes');
    expect(renderMorningObservation({ ...input, observed: 80 }).status).toBe('needs_review');
    expect(renderMorningObservation({ ...input, awakeExcessMinutes: -5 }).status).toBe(
      'needs_review',
    );
    expect(renderMorningObservation({ ...input, observed: 0 }).status).toBe('needs_review');
    expect(() => renderMorningObservation({ ...input, remaining: -1 })).toThrow();
  });
});
const users = createDemoUsers('2026-10-03');
describe('experiment result semantics', () => {
  it.each(users)(
    'renders the saved on-condition for $name without statistical diagnostics',
    (user) => {
      const text = renderExperimentVerdict(user.analysis, {
        itemName: 'Afternoon coffee',
        monthlyCost: 0,
      });
      expect(text.status).toBe('ready');
      expect(text.text).toMatchSnapshot();
      expect(text.text).toContain('Skip coffee after 2pm');
      expect(text.text).not.toContain('a month back');
      const serialized = JSON.stringify(text);
      for (const field of [
        'pValue',
        'alpha',
        'randomization',
        'seed',
        'interval',
        'injectedEffect',
      ])
        expect(serialized).not.toContain(`"${field}"`);
      expect(toneLint(text.text!, (catalog as unknown as Catalog).toneRules)).toEqual([]);
    },
  );
  it('uses exact Dropped wording only for a paid item with actual savings and an outside-swing effect', () => {
    const analysis = {
      ...users[1]!.analysis,
      effect: { ...users[1]!.analysis.effect!, swingUnits: -1.5 },
    };
    const result = renderExperimentVerdict(analysis, {
      itemName: 'An item',
      subject: 'item',
      monthlyCost: 20,
      monthsUsed: 14,
      source: 'friend',
      dropsCharge: true,
      copyPolicy: 'exact',
    });
    expect(result).toMatchObject({ status: 'ready', variant: 'source' });
    expect(result.text).toContain('$20 a month back');
    expect(
      renderExperimentVerdict(analysis, {
        itemName: 'An item',
        monthlyCost: 20,
        copyPolicy: 'exact',
      }).status,
    ).toBe('needs_review');
    const small = { ...analysis, effect: { ...analysis.effect!, swingUnits: -0.5 } };
    expect(
      renderExperimentVerdict(small, {
        itemName: 'An item',
        subject: 'item',
        monthlyCost: 20,
        monthsUsed: 14,
        dropsCharge: true,
        copyPolicy: 'exact',
      }).status,
    ).toBe('needs_review');
    expect(
      renderExperimentVerdict(small, {
        itemName: 'An item',
        subject: 'item',
        monthlyCost: 20,
        monthsUsed: 14,
        dropsCharge: true,
      }).text,
    ).toContain('against your normal swing');
  });
  it('requires actual duration instead of substituting wearable history length', () => {
    expect(
      renderExperimentVerdict(users[1]!.analysis, {
        itemName: 'Item',
        subject: 'item',
        monthlyCost: 20,
        dropsCharge: true,
        copyPolicy: 'exact',
      }),
    ).toMatchObject({ status: 'needs_review', text: null });
    expect(
      renderExperimentVerdict(users[1]!.analysis, { itemName: 'Item', monthlyCost: 0 }).text,
    ).not.toContain('months in');
  });
  it('does not call a large inconclusive effect inside the swing or a habit a dose', () => {
    const result = {
      ...users[2]!.analysis,
      effect: { ...users[2]!.analysis.effect!, swingUnits: 2, difference: 100 },
    };
    const text = renderExperimentVerdict(result, { itemName: 'Coffee', monthlyCost: 0 });
    expect(text.text).not.toContain('inside');
    expect(text.text).not.toContain('dose');
    expect(
      renderExperimentVerdict(result, { itemName: 'Coffee', monthlyCost: 0, copyPolicy: 'exact' })
        .status,
    ).toBe('needs_review');
  });
  it.each([
    'insufficient_nights',
    'noncompliance',
    'assignment_resolution',
    'baseline_unavailable',
    'opposite_direction_not_tested',
    'experiment_not_finished',
    'effect_direction_disagreement',
  ] as const)('explains %s without claiming no effect', (reason) => {
    const result = {
      ...users[2]!.analysis,
      reasons: [reason],
      effect: reason === 'baseline_unavailable' ? null : users[2]!.analysis.effect,
    };
    const text = renderExperimentVerdict(result, { itemName: 'Coffee' });
    expect(text.status).toBe('ready');
    expect(text.text).not.toContain("your body didn't show a change");
    expect(text.text).toMatchSnapshot();
  });
  it('labels observational comparisons as such and rejects a fabricated decisive observational result', () => {
    const observed = {
      ...users[2]!.analysis,
      design: 'observational' as const,
      reasons: ['observational_design'] as const,
    };
    expect(renderExperimentVerdict(observed, { itemName: 'Alcohol' }).text).toContain(
      'observational',
    );
    const forged = { ...users[0]!.analysis, design: 'observational' as const };
    expect(renderExperimentVerdict(forged, { itemName: 'Alcohol' }).status).toBe('needs_review');
  });
  it('retains fact-check flags and rejects Protected sources, bad direction and invalid substituted names', () => {
    expect(
      renderExperimentVerdict({ ...users[0]!.analysis, unverified: true }, { itemName: 'Walk' })
        .unverified,
    ).toBe(true);
    expect(
      renderExperimentVerdict(users[0]!.analysis, { itemName: 'Iron', source: 'doctor' }).status,
    ).toBe('needs_review');
    expect(
      renderExperimentVerdict({ ...users[0]!.analysis, direction: 'lower' }, { itemName: 'Walk' })
        .status,
    ).toBe('needs_review');
    expect(
      renderExperimentVerdict(users[0]!.analysis, { itemName: 'Boost pill', subject: 'item' })
        .status,
    ).toBe('needs_review');
  });
  it('fills the dose-specific inconclusive template only for an eligible measured small effect', () => {
    const result: AnalysisResult = {
      ...users[2]!.analysis,
      effect: { ...users[2]!.analysis.effect!, swingUnits: 0.1 },
    };
    expect(
      renderExperimentVerdict(result, {
        itemName: 'An item',
        subject: 'item',
        doseExperiment: true,
        monthlyCost: 10,
      }),
    ).toMatchObject({ status: 'ready', variant: 'source', templateId: 'inconclusive' });
  });
});
describe('audit verdict selection', () => {
  it('keeps Protected sources in one sentence with no cost, rating or suggestion', () => {
    const item = routeStack([{ id: 'iron', key: 'iron' }], {
      iron: { source: 'blood test', goal: 'general health' },
    }).items[0]!;
    const text = renderAuditVerdict(item, { source: 'blood test' });
    expect(text.text).toContain('blood test');
    expect(text.text?.split('.').filter(Boolean)).toHaveLength(1);
    expect(text.text).not.toMatch(/\$|clinician|Keep\./);
    expect(
      renderAuditVerdict(item, { source: 'blood test' }, { copyPolicy: 'exact' }),
    ).toMatchObject({ status: 'needs_review', text: null });
  });
  it('does not imply a synthetic data source came from a clinician', () => {
    const text = renderAuditVerdict(users[0]!.audit.protected[0]!, { dataSource: true });
    expect(text.text).toContain('data source');
    expect(text.text).not.toContain('clinician');
  });
  it('requires an explicit compatible threshold instead of interpreting raw study prose', () => {
    const answers = { goal: 'sleep', dose: 120, doseUnit: 'mg elemental' } as const;
    const item = routeStack([{ id: 'mag', key: 'magnesium-any-form' }], {
      mag: { ...answers, form: 'citrate' },
    }).items[0]!;
    expect(renderAuditVerdict(item, answers)).toMatchObject({
      status: 'needs_context',
      text: null,
    });
    expect(
      renderAuditVerdict(item, answers, { threshold: { value: 200, unit: 'mg elemental' } }).text,
    ).toContain('120 mg elemental');
    expect(
      renderAuditVerdict(item, answers, { threshold: { value: 200, unit: 'mg' } }),
    ).toMatchObject({ status: 'needs_review', text: null });
  });
  it('does not turn pending/source-conflicting routes or missing study summaries into recommendations', () => {
    const pending = users[0]!.audit.items.find(
      (item) => item.needsAnswers?.length || item.teamQuestions?.length,
    )!;
    expect(renderAuditVerdict(pending, {}).status).not.toBe('ready');
    const slow = { ...users[0]!.audit.runnable[0]!, tier: 'T1_QUEUED_SLOW' as const };
    expect(renderAuditVerdict(slow, {}).status).toBe('needs_context');
    expect(renderAuditVerdict(slow, {}, { evidence: 'This can boost recovery' }).status).toBe(
      'needs_review',
    );
  });
});
