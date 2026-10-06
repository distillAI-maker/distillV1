import type { itemHistoryHypothesis } from '../experiment/history.js';
import type { MetricField } from '../experiment/types.js';
import { formatChange, formatCount, metricUnit, finite } from './format.js';
import { renderTemplate, VerdictTextError } from './templates.js';
import type { VerdictText } from './render.js';

export function renderHistoryVerdict(
  hypothesis: NonNullable<ReturnType<typeof itemHistoryHypothesis>>,
  context: {
    itemName: string;
    didIt: string;
    monthsCovered: number;
    direction: 'higher' | 'lower';
  },
): VerdictText {
  const blocked = (issue: string): VerdictText => ({
    status: 'needs_review',
    text: null,
    issues: [issue],
    unverified: hypothesis.unverified,
  });
  if (
    hypothesis.label !== 'hypothesis' ||
    hypothesis.randomized ||
    hypothesis.onNights < 5 ||
    hypothesis.offNights < 5
  )
    return blocked('CONFIRMED_HISTORY_ON_BOTH_SIDES');
  finite(hypothesis.difference);
  if (hypothesis.difference === 0) return blocked('HISTORY_TEMPLATE_REQUIRES_A_DIRECTION');
  if (!['higher', 'lower'].includes(context.direction))
    throw new Error('Explicit metric direction required');
  const better =
    context.direction === 'higher' ? hypothesis.difference > 0 : hypothesis.difference < 0;
  try {
    const rendered = renderTemplate(
      'hypothesis',
      {
        item: context.itemName,
        'did it': context.didIt,
        n_on: formatCount(hypothesis.onNights),
        n_off: formatCount(hypothesis.offNights),
        months: formatCount(context.monthsCovered),
        number: `your ${hypothesis.metricName === 'Overnight HRV' ? 'overnight HRV' : hypothesis.metricName.toLowerCase()}`,
        change: formatChange(hypothesis.difference, metricUnit(hypothesis.metric)),
        'better/worse': better ? 'better' : 'worse',
      },
      { unverified: hypothesis.unverified },
    );
    return { status: 'ready', ...rendered, variant: 'source' };
  } catch (error) {
    if (error instanceof VerdictTextError) return blocked(error.code);
    throw error;
  }
}
export interface MorningObservation {
  readonly what: string;
  readonly metric: MetricField;
  readonly metricName: string;
  readonly observed: number;
  readonly usual: number;
  readonly awakeExcessMinutes: number;
  readonly remaining: number;
  readonly unverified?: boolean;
}
/** Only a confirmed night below usual with increased waking matches the exact source template. */
export function renderMorningObservation(observation: MorningObservation): VerdictText {
  const unverified = observation.unverified ?? false;
  const blocked = (issue: string): VerdictText => ({
    status: 'needs_review',
    text: null,
    issues: [issue],
    unverified,
  });
  const unit = metricUnit(observation.metric);
  finite(observation.observed);
  finite(observation.usual);
  finite(observation.awakeExcessMinutes);
  const difference = observation.observed - observation.usual,
    remaining = formatCount(observation.remaining);
  if (
    (observation.metric === 'overnightHrvMs' &&
      (observation.observed <= 0 || observation.usual <= 0)) ||
    (observation.metric === 'sleepLatencyMinutes' &&
      (observation.observed > 60 || observation.usual > 60))
  )
    return blocked('MEASUREMENT_ARTIFACT');
  if (difference >= 0 || observation.awakeExcessMinutes < 0)
    return blocked('OBSERVATION_SOURCE_ASSUMES_BELOW_USUAL_AND_MORE_AWAKE');
  try {
    const rendered = renderTemplate(
      'observe',
      {
        what: observation.what,
        number: `Your ${observation.metricName === 'Overnight HRV' ? 'overnight HRV' : observation.metricName.toLowerCase()}`,
        change: formatChange(difference, unit),
        awake: String(Math.round(observation.awakeExcessMinutes)),
        remaining,
      },
      { unverified },
    );
    return { status: 'ready', ...rendered, variant: 'source' };
  } catch (error) {
    if (error instanceof VerdictTextError) return blocked(error.code);
    throw error;
  }
}
