import type { BehaviorObservation, CheckIn, Exclusion, PreRegistration } from './types.js';
import { assertDate, immutable } from './utils.js';

export const dailyCopy = {
  on: 'Follow your saved on condition today.',
  off: 'Follow your saved off condition today.',
  observe: 'Keep your usual routine. Record this item only if it happens.',
  none: 'You have no experiment instruction today.',
} as const;
export function dailyInstruction(
  record: PreRegistration | null,
  activityDate: string,
  observed?: BehaviorObservation,
) {
  assertDate(activityDate);
  const day = record?.schedule.days.find((day) => day.date === activityDate);
  if (!day) return { kind: 'none' as const, text: dailyCopy.none, askForTap: false };
  const known =
    observed?.confirmed &&
    observed.sleepDate === day.sleepDate &&
    observed.exposure !== 'unknown' &&
    observed.provenance !== 'alcohol_signature';
  return { kind: day.condition, text: dailyCopy[day.condition], askForTap: !known };
}
export function recordCheckIn(
  record: PreRegistration,
  input: {
    readonly sleepDate: string;
    readonly tap?: 'did' | 'didnt';
    readonly exposure?: 'on' | 'off';
    readonly inferred?: BehaviorObservation;
    readonly exclusions?: readonly Exclusion[];
  },
): CheckIn {
  const day = record.schedule.days.find((day) => day.sleepDate === input.sleepDate);
  if (!day) throw new Error('Check-in is outside this experiment');
  if (input.tap !== undefined && !['did', 'didnt'].includes(input.tap))
    throw new Error('Invalid tap');
  if (input.exposure !== undefined && !['on', 'off'].includes(input.exposure))
    throw new Error('Invalid exposure');
  const exclusions = [...new Set(input.exclusions ?? [])];
  if (
    exclusions.some(
      (flag) => !['ill', 'travelling', 'kids_woke_me', 'unusually_hard_session'].includes(flag),
    )
  )
    throw new Error('Invalid exclusion flag');
  const observation = input.inferred;
  if (
    observation &&
    (typeof observation.confirmed !== 'boolean' ||
      !['on', 'off', 'unknown'].includes(observation.exposure) ||
      !['wearable', 'confirmed_tag', 'self_report', 'alcohol_signature'].includes(
        observation.provenance,
      ))
  )
    throw new Error('Invalid inferred observation');
  if (observation && observation.sleepDate !== input.sleepDate)
    throw new Error('Inference belongs to another night');
  let exposure: CheckIn['exposure'] = 'unknown';
  let provenance: CheckIn['provenance'] = 'unknown';
  if (
    observation?.confirmed &&
    observation.exposure !== 'unknown' &&
    observation.provenance !== 'alcohol_signature'
  ) {
    exposure = observation.exposure;
    provenance = observation.provenance;
  } else if (input.exposure) {
    exposure = input.exposure;
    provenance = 'self_report';
  } else if (input.tap && day.condition !== 'observe') {
    const assigned = day.condition;
    exposure = input.tap === 'did' ? assigned : assigned === 'on' ? 'off' : 'on';
    provenance = 'tap';
  }
  return immutable({
    sleepDate: input.sleepDate,
    tap: input.tap ?? 'unknown',
    exposure,
    provenance,
    exclusions,
    excludedForCarryover: day.excludedForCarryover,
    usable: exposure !== 'unknown' && !exclusions.length && !day.excludedForCarryover,
  });
}
