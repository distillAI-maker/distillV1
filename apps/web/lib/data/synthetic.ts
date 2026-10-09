import type { HistoricalNight, MetricField } from '@distill/engine/experiment';
import type { RoutedItem } from '@distill/engine';
import { generatePerson } from '@distill/sim';

/**
 * One synthetic person per demo identity: AR(1) nights with a realistic swing, from the same
 * generator the simulations use. Never stored beside real measurements, never mixed with them.
 * Used by the signed-in demo on the server and by the signed-out demo in the browser.
 */
export const shiftDate = (date: string, days: number) =>
  new Date(+new Date(`${date}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);

export interface SyntheticEffect {
  readonly metric: MetricField;
  /** Size in the person's own swing; the catalogue's expected effect for the item. */
  readonly swingUnits: number;
  /** Direction of on minus off on the metric: the item's own expected direction. */
  readonly direction: 'higher' | 'lower';
  readonly onDates: readonly string[];
}
function seedFrom(text: string): number {
  let seed = 2166136261;
  for (const character of text) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619);
  return seed >>> 0;
}
export function syntheticNights(input: {
  readonly through: string;
  readonly seedText: string;
  readonly effect?: SyntheticEffect;
  readonly days?: number;
}): HistoricalNight[] {
  const days = input.days ?? 240;
  const to = shiftDate(input.through, 1);
  const person = generatePerson({
    seed: seedFrom(input.seedText),
    personId: `demo-${input.seedText}`,
    from: shiftDate(to, -days),
    to,
    illnessRate: 0,
    missedTapRate: 0,
    missingMetricRate: 0,
    ...(input.effect && input.effect.onDates.length ? { effect: { ...input.effect } } : {}),
  });
  return person.history
    .filter((row) => row.night.sleepDate <= input.through)
    .map((row) => ({
      night: {
        ...row.night,
        source: 'synthetic' as const,
        sourceId: `demo-${row.night.sleepDate}`,
        rawPayloadId: `demo-${row.night.sleepDate}`,
        deviceModel: 'Synthetic demo',
      },
    }));
}
/** The effect the demo injects for a tested item: the row's expected size, in its expected direction. */
export function demoEffectFor(
  item: Pick<RoutedItem, 'adjustedExpectedEffect' | 'directionText'>,
  metric: MetricField,
  beneficialDirection: 'higher' | 'lower',
  onDates: readonly string[],
): SyntheticEffect {
  const hurts = (item.directionText ?? '').toLowerCase().startsWith('worse');
  return {
    metric,
    swingUnits: item.adjustedExpectedEffect ?? 1,
    direction: (beneficialDirection === 'higher') !== hurts ? 'higher' : 'lower',
    onDates,
  };
}
