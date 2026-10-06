import type { NightRecord, ProviderId } from '@distill/providers';

export type MetricField =
  | 'totalSleepMinutes'
  | 'sleepLatencyMinutes'
  | 'deepSleepMinutes'
  | 'remSleepMinutes'
  | 'wakeAfterSleepOnsetMinutes'
  | 'sleepEfficiencyPercent'
  | 'overnightHrvMs'
  | 'restingHeartRateBpm'
  | 'breathingRatePerMinute'
  | 'skinTemperatureDeviationC';
export type Condition = 'on' | 'off' | 'observe';
export type Exposure = 'on' | 'off' | 'unknown';
export type Exclusion = 'ill' | 'travelling' | 'kids_woke_me' | 'unusually_hard_session';
export interface DataChannel {
  readonly source: ProviderId;
  readonly hrvMethod?: 'sdnn' | 'rmssd';
  readonly deviceModel?: string | null;
}
export interface ScheduleConfig {
  readonly totalDays?: number;
  readonly blockLength?: number;
  readonly blockLengths?: readonly number[];
  readonly dropFirstNightOfBlock?: boolean;
  readonly minimumNightsPerSide?: number;
}
export interface ScheduledDay {
  /** Local date on which the instruction applies; measurements arrive the next morning. */
  readonly date: string;
  readonly sleepDate: string;
  readonly block: number;
  readonly condition: Condition;
  readonly excludedForCarryover: boolean;
}
export interface Schedule {
  readonly version: 1;
  readonly startDate: string;
  readonly seed: number;
  readonly totalDays: number;
  readonly blockLengths: readonly number[];
  readonly dropFirstNightOfBlock: boolean;
  readonly minimumNightsPerSide: number;
  readonly design: 'randomized' | 'observational';
  readonly assignmentIndex: number;
  readonly assignmentCount: number;
  readonly minimumAttainableOneSidedP: number | null;
  readonly limitations: readonly string[];
  readonly days: readonly ScheduledDay[];
}
export interface SwingEstimate {
  readonly value: number;
  readonly scale: 'raw' | 'log';
  readonly sampleDates: readonly string[];
  /** Raw values aligned with sampleDates; optional only for Phase 4 legacy records. */
  readonly sampleValues?: readonly number[];
}
export type TestPolicy = 'benefit_only' | 'both_directions';
export interface BaselinePlan {
  readonly status: 'watching' | 'ready' | 'insufficient_data';
  readonly skipped: boolean;
  readonly requestedDate: string;
  readonly readyDate: string;
  readonly assessedDate: string;
  readonly metric: MetricField;
  readonly channel: DataChannel;
  readonly usableNights: number;
  readonly swing: SwingEstimate | null;
}
export interface PreRegistration {
  readonly version: 1;
  readonly experimentId: string;
  readonly cycleId: string;
  readonly itemId: string;
  readonly itemKey: string;
  readonly unverified: boolean;
  readonly onDays: 'assign' | 'observe';
  readonly lockedAt: string;
  readonly timeZone: string;
  readonly metricName: string;
  readonly metric: MetricField;
  readonly direction: 'higher' | 'lower';
  readonly alpha: 0.05;
  /** Absent on legacy registrations means benefit_only. */
  readonly testPolicy?: TestPolicy;
  readonly onDefinition: string;
  readonly offDefinition: string;
  readonly channel: DataChannel;
  readonly baseline: BaselinePlan;
  readonly personalSwing: SwingEstimate;
  readonly schedule: Schedule;
  readonly complianceRule: BehaviorRule | null;
}
export interface CheckIn {
  readonly sleepDate: string;
  readonly tap: 'did' | 'didnt' | 'unknown';
  readonly exposure: Exposure;
  readonly provenance: 'tap' | 'wearable' | 'confirmed_tag' | 'self_report' | 'unknown';
  readonly exclusions: readonly Exclusion[];
  readonly excludedForCarryover: boolean;
  readonly usable: boolean;
}
export type BehaviorRule = (
  | { readonly kind: 'late_workout'; readonly minutesBeforeBed: number }
  | {
      readonly kind: 'wake_window';
      readonly targetMinute: number;
      readonly toleranceMinutes: number;
    }
  | { readonly kind: 'nap'; readonly afterMinute: number; readonly longerThanMinutes: number }
) & {
  /** Match means off when the on-condition is avoiding this recorded behavior. */
  readonly matchingExposure?: 'on' | 'off';
};
export interface BehaviorObservation {
  readonly sleepDate: string;
  readonly exposure: Exposure;
  readonly provenance: 'wearable' | 'confirmed_tag' | 'self_report' | 'alcohol_signature';
  readonly confirmed: boolean;
}
export interface HistoricalNight {
  readonly night: NightRecord;
  readonly exclusions?: readonly Exclusion[];
}
