import type { DropReason, Item, Tier } from '@distill/catalog';

/** Numbers are exact observations, never chip midpoint estimates. Omitted means unknown. */
export interface RuleAnswers {
  readonly source?: 'doctor' | 'blood test' | 'friend' | 'podcast' | 'online' | 'other';
  readonly prescription?: boolean;
  readonly hormone?: boolean;
  readonly clinicalService?: boolean;
  readonly diagnosedCondition?: boolean;
  readonly goal?:
    | 'sleep'
    | 'cramps'
    | 'general health'
    | 'nothing specific'
    | 'mood'
    | 'skin'
    | 'pain'
    | 'soreness'
    | 'energy'
    | 'focus'
    | 'gut'
    | 'fat loss'
    | 'bone'
    | 'testosterone';
  readonly dose?: number;
  readonly doseUnit?: 'mg' | 'g' | 'ml' | 'IU' | 'mg elemental' | 'mg EPA+DHA';
  readonly form?: string;
  readonly onMedication?: boolean;
  readonly onAntidepressant?: boolean;
  readonly diabetes?: boolean;
  readonly prediabetes?: boolean;
  readonly alcoholMostNights?: boolean;
  readonly liverCondition?: boolean;
  readonly vegan?: boolean;
  readonly vegetarian?: boolean;
  readonly age?: number;
  readonly onMetformin?: boolean;
  readonly onAcidReducers?: boolean;
  readonly deficiency?: boolean;
  readonly namedProblem?: boolean;
  readonly trainingMinutesPerDay?: number;
  readonly keto?: boolean;
  readonly stillPaying?: boolean;
  readonly cupsPerDay?: number;
  readonly time?:
    | 'before noon'
    | '12 to 2pm'
    | '2 to 5pm'
    | 'after 5pm'
    | 'before 2pm'
    | 'after 2pm'
    | 'daytime only'
    | 'some after 6pm'
    | 'mostly evening'
    | 'morning'
    | 'midday'
    | 'evening';
  readonly nightsPerWeek?: number;
  readonly dinnerToBedMinutes?: number;
  readonly bathroomNightsPerWeek?: number;
  readonly vigorous?: boolean;
  readonly workoutToBedMinutes?: number;
  readonly workoutEndHour?: number;
  readonly workoutNightsPerWeek?: number;
  readonly daysSinceLastUse?: number;
  readonly lastUsed?:
    'this week' | 'this month' | '1 to 3 months ago' | 'longer' | 'cannot remember';
  readonly phoneNightsPerWeek?: number;
  readonly wakeSpreadMinutes?: number;
  readonly weekendDelayMinutes?: number;
  readonly napHour?: number;
  readonly napMinutes?: number;
  readonly napDaysPerWeek?: number;
  readonly snores?: boolean;
  readonly possibleSleepApnoea?: boolean;
  readonly gaspingOrChoking?: boolean;
  readonly comfortableNasalBreathing?: boolean;
  readonly blockedNose?: boolean;
  readonly noisyRoom?: boolean;
  readonly snoringPartner?: boolean;
  readonly blackedOutRoom?: boolean;
  readonly sleepsHot?: boolean;
  readonly allergies?: boolean;
  readonly heavyTraffic?: boolean;
  readonly visitsLast30Days?: number;
  readonly visitsPrevious30Days?: number;
  readonly visitsLast60Days?: number;
  readonly packageUnused?: boolean;
  readonly bankedCredits?: number;
  readonly currentPain?: boolean;
  readonly subscriptionHasAdditionalTests?: boolean;
  readonly bothWearables?: boolean;
  readonly roomTemperatureC?: number;
  readonly inventoryKeys?: readonly string[];
}

/** An item-rule result, not a routed stack or permission to start an experiment. */
export interface RuleOutcome {
  readonly tier: Tier;
  readonly reason?: DropReason;
  readonly expectedEffect?: number;
  readonly metric?: string;
  readonly keep?: boolean;
  readonly canRunAnyway?: boolean;
  readonly dailyRating?:
    'mood' | 'skin' | 'pain' | 'soreness' | 'energy' | 'focus' | 'gut' | 'stress';
  readonly notHypothesis?: boolean;
  readonly excludeFromInventory?: boolean;
  readonly relatedExperiment?: string;
  readonly overlapCheck?: readonly string[];
  readonly notes?: readonly string[];
  readonly safetyNoteRequired?: boolean;
  readonly suggestedWeeks?: readonly [number, number];
  readonly needsAnswers?: readonly (keyof RuleAnswers)[];
  readonly teamQuestion?: string;
}
export type ItemRule = (answers: Readonly<RuleAnswers>) => RuleOutcome;
export type EvaluatedRule = RuleOutcome & {
  readonly key: string;
  readonly unverified: boolean;
  readonly onDays: Item['onDays'];
  readonly monthlyCost?: number;
  readonly safety?: string | null;
};
