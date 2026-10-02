import { z } from 'zod';

export const tierSchema = z.enum([
  'T1',
  'T1_QUEUED_SLOW',
  'T1_QUEUED_SPECIAL',
  'T3_TOO_SMALL',
  'T2',
  'T3',
  'PROTECTED',
]);
export type Tier = z.infer<typeof tierSchema>;
export const triggerSchema = z.enum([
  'DOSE_FORM',
  'FREQUENCY',
  'CLOCK_TIME',
  'NIGHTS_PER_WEEK',
  'LAST_USED',
  'STILL_PAYING',
  'OVERLAP',
  'NONE',
]);
export const reasonSchema = z.enum([
  'dose too low',
  'form not absorbed',
  'tested, found nothing',
  'no way it could work',
  'overlaps with something else',
  'not being used',
]);
export type DropReason = z.infer<typeof reasonSchema>;
const text = z.string().min(1);
const optionalText = text.nullable();
const number = z.number().finite().nonnegative();
export const sourceSchema = z.object({ sheet: text, row: z.number().int().positive() }).strict();

export const itemSchema = z
  .object({
    key: text,
    name: text,
    kind: z.enum(['buy', 'do', 'environment']),
    category: z.enum([
      'supplement',
      'food/drink',
      'timing',
      'habit',
      'device',
      'service',
      'environment',
      'skincare',
    ]),
    monthlyCost: number,
    annualCost: number,
    typicalAmount: optionalText,
    usualGoal: optionalText,
    visibility: z.enum(['yes', 'partial', 'no']),
    metricText: optionalText,
    directionText: optionalText,
    speed: z.enum(['fast', 'slow']),
    testDesign: text,
    runnableThisSemester: z.boolean(),
    expectedEffect: number.nullable(),
    effectBasis: optionalText,
    chance: z.enum(['good', 'fair', 'low', 'not in two weeks', 'not tested']),
    naturalTier: z.enum(['1', '2', '3', 'P']),
    tierName: text,
    tier: tierSchema,
    historyText: text,
    onDays: z.enum(['assign', 'observe']).nullable(),
    lowestDoseText: text,
    evidenceGrade: z.enum(['A', 'B', 'C', 'D', 'N']),
    evidence: text,
    mechanism: z.enum(['yes', 'weak', 'no']),
    dropReason: reasonSchema.nullable(),
    goalNotes: text,
    followUpTrigger: triggerSchema,
    question: text,
    answerOptionsText: text,
    ruleText: text,
    overlapGroups: z.array(text),
    safety: optionalText,
    dayOne: text,
    unverified: z.boolean(),
    factCheckNotes: optionalText,
    source: sourceSchema,
  })
  .strict();
export type Item = z.infer<typeof itemSchema>;

export const metricSchema = z
  .object({
    name: text,
    unit: text,
    description: text,
    availability: z.object({ oura: text, whoop: text, apple: text, garminFitbit: text }).strict(),
    personalSwingText: text,
    detectableChangeText: text,
    drivers: text,
    notes: text,
    source: sourceSchema,
  })
  .strict();
export type Metric = z.infer<typeof metricSchema>;
export const goalSchema = z
  .object({
    name: text,
    metricText: text.nullable(),
    notes: text,
    dailyRating: z.boolean(),
    source: sourceSchema,
  })
  .strict();
export type Goal = z.infer<typeof goalSchema>;
export const overlapGroupSchema = z
  .object({
    name: text,
    itemKeys: z.array(text),
    declaredCount: z.number().int().nonnegative(),
    ruleText: text,
    source: sourceSchema,
  })
  .strict();
export type OverlapGroup = z.infer<typeof overlapGroupSchema>;
export const followUpQuestionSchema = z
  .object({
    type: triggerSchema,
    wording: text,
    answerFormat: text,
    itemKeys: z.array(text),
    declaredCount: z.number().int().nonnegative(),
    source: sourceSchema,
  })
  .strict();
export type FollowUpQuestion = z.infer<typeof followUpQuestionSchema>;
export const verdictTemplateSchema = z
  .object({
    name: text,
    template: text,
    example: text,
    placeholders: z.array(text),
    source: sourceSchema,
  })
  .strict();
export type VerdictTemplate = z.infer<typeof verdictTemplateSchema>;
export const toneRulesSchema = z
  .object({
    bannedPhrases: z.array(text),
    allowedPhrasesText: text,
    maxWordsExclusive: z.literal(60),
    gatedMaxWords: z.literal(60),
    rules: z.array(z.object({ name: text, instruction: text, source: sourceSchema }).strict()),
  })
  .strict();
export type ToneRules = z.infer<typeof toneRulesSchema>;
const counts = z.record(z.string(), z.number().int().nonnegative());
export const summarySchema = z
  .object({
    total: z.number().int().positive(),
    naturalTiers: counts,
    tiers: z.record(tierSchema, z.number().int().nonnegative()),
    categories: z.array(
      z
        .object({
          name: itemSchema.shape.category,
          count: z.number().int(),
          naturalT1: z.number().int(),
          runnableT1: z.number().int(),
          t2: z.number().int(),
          t3: z.number().int(),
          protected: z.number().int(),
        })
        .strict(),
    ),
    reasons: counts,
    evidenceGrades: counts,
    unverified: z.number().int(),
    unverifiedT2: z.number().int(),
  })
  .strict();
export const sourceCellSchema = z
  .object({
    value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
    formula: z.string().optional(),
  })
  .strict();
export const catalogSchema = z
  .object({
    schemaVersion: z.literal(1),
    sourceFile: z.literal('Routing-Table_V3.xlsx'),
    sourceSha256: z.string().length(64),
    items: z.array(itemSchema),
    metrics: z.array(metricSchema),
    goals: z.array(goalSchema),
    overlapGroups: z.array(overlapGroupSchema),
    followUpQuestions: z.array(followUpQuestionSchema),
    verdictTemplates: z.array(verdictTemplateSchema),
    sourceClausesText: text,
    toneRules: toneRulesSchema,
    summary: summarySchema,
    // Preserve every nonblank cell and formula, including narrative sheets and the worked example.
    sheets: z.record(z.string(), z.record(z.string(), sourceCellSchema)),
  })
  .strict();
export type Catalog = z.infer<typeof catalogSchema>;
