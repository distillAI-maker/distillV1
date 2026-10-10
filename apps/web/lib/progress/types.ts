import { z } from 'zod';

/** Where an item came from. Doctor or blood test means Protected (SPEC 11.2). */
export const originSchema = z.enum([
  'doctor',
  'blood test',
  'friend',
  'podcast',
  'online',
  'other',
]);
export type Origin = z.infer<typeof originSchema>;

export const dataSourceIdSchema = z.enum([
  'demo',
  'oura',
  'whoop',
  'fitbit',
  'apple_export',
  'csv',
]);
export type DataSourceId = z.infer<typeof dataSourceIdSchema>;

/** Onboarding steps, in the order the Figma flow runs them. 'heard', 'goals' and 'day-one' are older saves. */
export const stepSchema = z.enum([
  'name',
  'stack',
  'life',
  'questions',
  'number',
  'heard',
  'sorted',
  'ready',
  'invitation',
  'connect',
  'done',
  'goals',
  'day-one',
]);
export type Step = z.infer<typeof stepSchema>;

export const stackItemSchema = z
  .object({
    id: z.string().min(1),
    /** Catalog key, or null for something the person added that is not listed. */
    itemKey: z.string().min(1).nullable(),
    customName: z.string().max(120).optional(),
    /** The person's own word for a catalog item ("Equinox"), shown instead of the row's name. */
    label: z.string().max(60).optional(),
    /** The connected wearable's own subscription: counted, never rated. */
    dataSource: z.boolean().optional(),
    monthlyCost: z.number().finite().nonnegative(),
    origin: originSchema.optional(),
    /** Typed values for the item's rule (engine RuleAnswers): numbers, booleans, strings. */
    answers: z.record(z.string(), z.unknown()).default({}),
    /** The chip label tapped for a field, kept beside the value for the record and for ranges. */
    chips: z.record(z.string(), z.string()).default({}),
    /** Fields the person answered "not sure" to. The rule stays conservative; we stop asking. */
    unknown: z.array(z.string()).default([]),
    /** Answers read from the wearable (or the demo fixture), shown as a confirmation. */
    readFrom: z.object({ source: z.string(), summary: z.string() }).optional(),
    confirmedRead: z.boolean().optional(),
    status: z.enum(['listed', 'cut', 'kept', 'testing', 'protected']).default('listed'),
    position: z.number().int().nonnegative(),
  })
  .strict();
export type StackItem = z.infer<typeof stackItemSchema>;

export const progressSchema = z
  .object({
    version: z.literal(1),
    step: stepSchema,
    dataSource: dataSourceIdSchema.optional(),
    /** When the source was chosen. */
    connectedAt: z.string().optional(),
    backfill: z.object({ nights: z.number().int().nonnegative(), done: z.boolean() }).optional(),
    /** Set once the demo stack has been copied in, so a cleared list stays cleared. */
    prefilledFrom: z.enum(['demo']).optional(),
    /** Goal names from the Goal to Number sheet, plus "nothing specific". */
    goals: z.array(z.string()).default([]),
    /** The first name they gave on the name screen, used to address them. Optional. */
    name: z.string().max(80).default(''),
    /** What the person wrote about their ideal day. Kept for them, never analysed. */
    lifeText: z.string().max(4000).default(''),
    /** Founding membership: free while the app is in beta. Unlocks the private reading. */
    member: z.boolean().default(false),
    items: z.array(stackItemSchema).default([]),
    /** Follow-up questions already shown, as `${itemId}:${field}`. Back removes the last one. */
    seenQuestions: z.array(z.string()).default([]),
    dayOne: z
      .object({
        overlapChoices: z.record(z.string(), z.string()).default({}),
        /** Stack item IDs the person would never give up. Never tested, never suggested to drop. */
        yours: z.array(z.string()).default([]),
        runAnyway: z.array(z.string()).default([]),
        keepAnyway: z.array(z.string()).default([]),
        months: z.number().int().nonnegative().nullable().optional(),
        /** The person's pick for the first experiment, when not the engine's first. */
        firstExperiment: z.string().optional(),
        started: z.boolean().default(false),
      })
      .default({ overlapChoices: {}, yours: [], runAnyway: [], keepAnyway: [], started: false }),
    /** The person's own taps, by experiment and night. Fixture taps live in the data source. */
    taps: z
      .record(
        z.string(),
        z.record(
          z.string(),
          z
            .object({
              value: z.enum(['did', 'didnt', 'unknown']),
              excluded: z.string().max(60).optional(),
            })
            .strict(),
        ),
      )
      .default({}),
    /** What the person decided on each verdict. */
    verdictChoices: z.record(z.string(), z.enum(['cut', 'kept'])).default({}),
    reducedMotion: z.boolean().default(false),
    /** Signed-out demo only: how many weeks past the first read the person skipped ahead (0 to 2). */
    demoSkipDays: z.number().int().min(0).max(2).default(0),
    updatedAt: z.string(),
  })
  .strict();
export type Progress = z.infer<typeof progressSchema>;

export function emptyProgress(): Progress {
  return {
    version: 1,
    step: 'stack',
    goals: [],
    name: '',
    lifeText: '',
    member: false,
    items: [],
    seenQuestions: [],
    dayOne: { overlapChoices: {}, yours: [], runAnyway: [], keepAnyway: [], started: false },
    taps: {},
    verdictChoices: {},
    reducedMotion: false,
    demoSkipDays: 0,
    updatedAt: new Date(0).toISOString(),
  };
}

export function newItemId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `i-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }
}

/** Saved progress. Supabase when configured, this device otherwise. */
export interface ProgressStore {
  readonly id: 'local' | 'supabase';
  load(): Promise<Progress | null>;
  save(progress: Progress): Promise<void>;
  clear(): Promise<void>;
}
