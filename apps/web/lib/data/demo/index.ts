import type { VerdictTemplate } from '@distill/catalog';
import type { Progress } from '../../progress/types';
import type { DataSource, Experiment, Night } from '../types';
import { fetchDemoExperiments, fetchDemoVerdicts } from './actions';

/**
 * The signed-out demo as the screens see it. The work happens on the server (`./run.ts`): the
 * real engine on a synthetic person, with the taps the browser keeps in local progress. The
 * clock is fixed when the source is made, so a session's demo keeps one start date.
 */
export function createDemoSource(_templates?: VerdictTemplate[], now = new Date()): DataSource {
  const nowIso = now.toISOString();
  return {
    id: 'demo',
    experiments: (progress) => fetchDemoExperiments(progress, nowIso),
    verdicts: (progress) => fetchDemoVerdicts(progress, nowIso),
  };
}

/** The experiment's own nights with the person's taps laid over them. */
export function nightsWithTaps(exp: Experiment, progress: Progress): Night[] {
  const own = progress.taps[exp.id] ?? {};
  return (exp.nights ?? []).map((n) => {
    const mine = own[n.date];
    if (!mine) return n;
    return { ...n, tap: mine.value, counted: !mine.excluded };
  });
}
