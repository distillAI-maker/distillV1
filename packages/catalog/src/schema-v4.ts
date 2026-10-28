import { z } from 'zod';

/**
 * Routing table V4 (docs/ROUTING-V4.md): five sheets read by header name into data/catalog-v4.json.
 * One row per thing a person does or buys, built to decide what to protect, what to propose
 * letting go of, and where each thing sits in a person's Ritual. Every closed column is an enum
 * here and a dropdown in the workbook.
 */

export const v4AreaSchema = z.enum(['eat', 'move', 'mind', 'sleep', 'skin']);
export const v4KindSchema = z.enum([
  'supplement',
  'food-drink',
  'movement',
  'practice',
  'device',
  'service',
  'environment',
  'timing',
  /** Something put on the skin: sunscreen, a retinoid, an acid, a serum. */
  'topical',
]);
export const v4MomentSchema = z.enum(['morning', 'midday', 'evening', 'night', 'weekend', 'any']);
export const v4CadenceSchema = z.enum(['daily', 'weekly', 'monthly', 'occasional']);
export const v4RoleSchema = z.enum(['anchor', 'companion', 'standalone']);
export const v4ComesFromSchema = z.enum([
  'feed',
  'ad',
  'podcast',
  'friend',
  'gym',
  'clinician',
  'brand',
  'culture',
]);
export const v4WhyLovedSchema = z.enum([
  'connection',
  'ritual',
  'confidence',
  'looks',
  'calm',
  'energy',
  'belonging',
  'treat',
]);
export const v4TierSchema = z.enum(['A', 'B', 'C', 'D', 'N']);
export const v4RequiresSchema = z.enum(['none', 'trains', 'deficiency', 'low_intake']);
export const v4DoseUnitSchema = z.enum(['g', 'mg', 'mcg', 'IU', 'min', 'sessions/week', '%', 'steps/day']);
export const v4KeepCodeSchema = z.enum(['THEIRS', 'LOVED', 'EVIDENCE_REGULAR', 'TRAINS']);
export const v4ClearCodeSchema = z.enum([
  'BORROWED_WEAK',
  'OVERLAP',
  'UNUSED',
  'DOSE_BELOW_MIN',
  'FORM_NOT_ABSORBED',
  'UNLOVED_HABIT',
  'NOT_TRAINING',
  'TOO_MANY_STEPS',
]);
export const v4AweSchema = z.enum([
  'nature',
  'music',
  'visual',
  'collective',
  'moral',
  'spiritual',
  'life',
  'epiphany',
]);
export const v4SeesSchema = z.enum(['yes', 'partial', 'no']);
export const v4StatusSchema = z.enum(['draft', 'reviewed', 'live']);
export const v4SourceTypeSchema = z.enum([
  'meta-analysis',
  'systematic review',
  'RCT',
  'cohort',
  'cross-sectional',
  'case series',
  'lab study',
  'review',
  'position stand',
  'guidance',
  'expert',
]);
export const v4OverlapRuleSchema = z.enum([
  'keep-one',
  'keep-best-evidence',
  'keep-most-used',
  'show-together',
]);
export const v4ConditionSchema = z.enum([
  'any',
  'on-medication',
  'pregnant',
  'breastfeeding',
  'kidney-disease',
  'liver-disease',
  'heart-condition',
  'blood-pressure',
  'diabetes',
  'under-18',
  'skin-condition',
  'bleeding-risk',
  'mental-health-condition',
  'smoker',
  'sleep-apnea',
]);
export const v4SafetyActionSchema = z.enum([
  'clinician-first',
  'see-dermatologist',
  'never-suggest',
  'note',
]);

const text = z.string().trim().min(1);
const location = z.object({ sheet: text, row: z.number().int().positive() }).strict();

export const v4ItemSchema = z
  .object({
    key: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    name: text,
    shortName: z.string().trim().min(1).max(32),
    area: v4AreaSchema,
    alsoServes: z.array(v4AreaSchema).max(2),
    kind: v4KindSchema,
    moments: z.array(v4MomentSchema).min(1),
    cadence: v4CadenceSchema,
    ritualRole: v4RoleSchema,
    costMonthUsd: z.number().finite().nonnegative(),
    howCommon: z.number().int().min(1).max(5),
    comesFrom: z.array(v4ComesFromSchema).min(1),
    whyLoved: z.array(v4WhyLovedSchema).max(3),
    evidenceTier: v4TierSchema,
    evidenceFor: text,
    evidenceRequires: v4RequiresSchema,
    tierOtherwise: v4TierSchema.nullable(),
    evidenceSummary: text,
    sources: z.array(text),
    doseMin: z.number().finite().positive().nullable(),
    doseTypical: z.string().trim(),
    doseUnit: v4DoseUnitSchema.nullable(),
    studiedForms: z.array(text),
    keepWhen: z.array(v4KeepCodeSchema).min(1),
    clearWhen: z.array(v4ClearCodeSchema),
    neverClear: z.boolean(),
    humanQuestion: text,
    /** How the app asks where it came from, in this item's own words; the buttons stay the same. */
    originQuestion: z.string().trim(),
    fitsInstead: z.string().trim(),
    /** The thing to do they can add to their Ritual once they let this go: never something to buy. */
    swap: z
      .object({
        title: z.string().trim().min(1).max(60),
        slot: z.enum(['morning', 'midday', 'evening', 'night']),
        /** Null for every day. */
        perWeek: z.number().int().min(1).max(7).nullable(),
      })
      .strict()
      .nullable(),
    /** The benefit builds with daily use (creatine, sunscreen): done now and then, it mostly misses. */
    builds: z.boolean(),
    /** For something expensive: the same activity for less, offered once unless they love it. */
    budgetOption: z.string().trim(),
    awe: v4AweSchema.nullable(),
    wearableSees: v4SeesSchema,
    overlaps: z.array(text),
    top50: z.boolean(),
    status: v4StatusSchema,
    reviewedBy: z.string().trim(),
    reviewedOn: z.string().trim(),
    notesInternal: z.string().trim(),
    /** Built from the Safety sheet. */
    safety: z
      .array(
        z
          .object({ condition: v4ConditionSchema, action: v4SafetyActionSchema, note: z.string().trim() })
          .strict(),
      )
      .default([]),
    source: location,
  })
  .strict();
export type V4Item = z.infer<typeof v4ItemSchema>;

export const v4SourceSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    citation: text,
    /** Blank for an undated web page (agency guidance). */
    year: z.number().int().min(1950).max(2100).nullable(),
    type: v4SourceTypeSchema,
    doiOrUrl: z.string().trim().url(),
    finding: text,
    population: z.string().trim(),
    checkedBy: z.string().trim(),
    checkedOn: z.string().trim(),
    /** Paid for or run by the brand that sells it. Counts as no independent evidence. */
    brandFunded: z.boolean(),
    source: location,
  })
  .strict();
export type V4Source = z.infer<typeof v4SourceSchema>;

export const v4OverlapSchema = z
  .object({
    group: text,
    members: z.array(text).min(2),
    rule: v4OverlapRuleSchema,
    note: z.string().trim(),
    source: location,
  })
  .strict();
export type V4Overlap = z.infer<typeof v4OverlapSchema>;

export const v4SafetyRowSchema = z
  .object({
    item: text,
    condition: v4ConditionSchema,
    action: v4SafetyActionSchema,
    note: z.string().trim(),
    source: location,
  })
  .strict();
export type V4SafetyRow = z.infer<typeof v4SafetyRowSchema>;

export const catalogV4Schema = z
  .object({
    schemaVersion: z.literal(4),
    sourceFile: z.literal('Routing-Table_V4.xlsx'),
    sourceSha256: z.string().length(64),
    items: z.array(v4ItemSchema),
    sources: z.array(v4SourceSchema),
    overlaps: z.array(v4OverlapSchema),
    safety: z.array(v4SafetyRowSchema),
    bannedPhrases: z.array(text),
    coverage: z
      .object({
        live: z.number().int().nonnegative(),
        reviewed: z.number().int().nonnegative(),
        draft: z.number().int().nonnegative(),
        top50Live: z.number().int().nonnegative(),
        top50Total: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict();
export type CatalogV4 = z.infer<typeof catalogV4Schema>;
