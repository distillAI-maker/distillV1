import type { VerdictTemplate } from '@distill/catalog';
import type { Progress } from '../../progress/types';
import type { DataSource, Experiment, Night, Verdict } from '../types';
import { dollars, fillTemplate, minutes, sourceClauses } from '../verdict';
import { demoEffect, demoExperiment, demoExperimentId, demoItemKey, demoNights } from './experiments';

/**
 * The demo data source: the Worked Example person, mid-experiment. Progress holds only what the
 * person tapped themselves; the fixture supplies the rest. Templates come from the catalog, via
 * a server action, so the verdict text is never written here.
 */
export function createDemoSource(templates: VerdictTemplate[], now = new Date()): DataSource {
  const dropped = templates.find((t) => t.name === 'Tier 1, dropped');
  if (!dropped) throw new Error('Missing the "Tier 1, dropped" template');

  function nightsFor(progress: Progress): Night[] {
    const own = progress.taps[demoExperimentId] ?? {};
    return demoNights(now).map((n) => {
      const mine = own[n.date];
      if (!mine) return n;
      return { ...n, tap: mine.value, counted: !mine.excluded };
    });
  }

  return {
    id: 'demo',
    async experiments(progress) {
      if (!progress.dayOne.started) return [];
      // Running while the item is under test; still here after the verdict's decision moved it.
      const started =
        progress.items.some((i) => i.itemKey === demoItemKey && i.status === 'testing') ||
        Boolean(progress.verdictChoices[demoExperimentId]);
      if (!started) return [];
      const exp = demoExperiment(now, progress.dayOne.months);
      // Done once today's tap is in. A missed morning earlier stays unknown; that is a real answer.
      const nights = nightsFor(progress);
      const last = nights[nights.length - 1];
      const done = Boolean(last && progress.taps[demoExperimentId]?.[last.date]);
      return [{ ...exp, status: done ? 'done' : 'running' }];
    },
    async verdicts(progress) {
      const [exp] = await this.experiments(progress);
      if (!exp || exp.status !== 'done') return [];
      const nights = nightsFor(progress);
      const { change } = demoEffect();
      const origin = progress.items.find((i) => i.itemKey === demoItemKey)?.origin ?? 'other';
      const text = fillTemplate(dropped, {
        item: exp.name,
        number: 'your total sleep',
        change: minutes(change),
        swing: minutes(exp.prereg.swing),
        months: exp.monthsIn ?? 8,
        source_clause: sourceClauses[origin],
        cost: dollars(exp.monthlyCost),
      });
      const verdict: Verdict = {
        id: exp.id,
        experimentId: exp.id,
        itemKey: exp.itemKey,
        name: exp.name,
        word: 'Dropped',
        templateName: dropped.name,
        text,
        metric: exp.metric,
        unit: exp.unit,
        change,
        swing: exp.prereg.swing,
        nights,
        effort: { days: exp.days, taps: nights.filter((n) => n.tap !== 'unknown').length },
        monthlyCost: exp.monthlyCost,
        decidedAt: nights[nights.length - 1]?.date ?? '',
      };
      return [verdict];
    },
  };
}

export function nightsWithTaps(exp: Experiment, progress: Progress, now = new Date()): Night[] {
  const own = progress.taps[exp.id] ?? {};
  return demoNights(now).map((n) => {
    const mine = own[n.date];
    if (!mine) return n;
    return { ...n, tap: mine.value, counted: !mine.excluded };
  });
}
