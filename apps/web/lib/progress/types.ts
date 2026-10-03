import { z } from 'zod';

/** Where an item came from. Doctor or blood test means Protected (SPEC 11.2). */
export const originSchema = z.enum(['doctor', 'blood test', 'friend', 'podcast', 'online', 'other']);
export type Origin = z.infer<typeof originSchema>;

export const dataSourceIdSchema = z.enum(['demo', 'oura', 'whoop', 'fitbit', 'apple_export']);
export type DataSourceId = z.infer<typeof dataSourceIdSchema>;

export const stepSchema = z.enum(['connect', 'stack', 'goals', 'questions', 'day-one', 'done']);
export type Step = z.infer<typeof stepSchema>;

export const stackItemSchema = z
  .object({
    id: z.string().min(1),
    /** Catalog key, or null for something the person added that is not listed. */
    itemKey: z.string().min(1).nullable(),
    customName: z.string().max(120).optional(),
    monthlyCost: z.number().finite().nonnegative(),
    origin: originSchema.optional(),
    /** Typed answers for the item's rule (engine RuleAnswers), kept as the chips were tapped. */
    answers: z.record(z.string(), z.unknown()).default({}),
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
    backfill: z.object({ nights: z.number().int().nonnegative(), done: z.boolean() }).optional(),
    goals: z.array(z.string()).default([]),
    items: z.array(stackItemSchema).default([]),
    questionIndex: z.number().int().nonnegative().default(0),
    dayOne: z
      .object({
        overlapChoices: z.record(z.string(), z.string()).default({}),
        runAnyway: z.array(z.string()).default([]),
        keepAnyway: z.array(z.string()).default([]),
        months: z.number().int().nonnegative().nullable().optional(),
        started: z.boolean().default(false),
      })
      .default({ overlapChoices: {}, runAnyway: [], keepAnyway: [], started: false }),
    reducedMotion: z.boolean().default(false),
    updatedAt: z.string(),
  })
  .strict();
export type Progress = z.infer<typeof progressSchema>;

export function emptyProgress(): Progress {
  return {
    version: 1,
    step: 'connect',
    goals: [],
    items: [],
    questionIndex: 0,
    dayOne: { overlapChoices: {}, runAnyway: [], keepAnyway: [], started: false },
    reducedMotion: false,
    updatedAt: new Date(0).toISOString(),
  };
}

/** Saved progress. Supabase when configured, this device otherwise. */
export interface ProgressStore {
  readonly id: 'local' | 'supabase';
  load(): Promise<Progress | null>;
  save(progress: Progress): Promise<void>;
  clear(): Promise<void>;
}
