import { z } from 'zod';

/**
 * The engine's vocabulary (docs/ENGINE.md). Zod schemas are the source of truth; the types are
 * inferred from them so the server can validate anything read back from the database or a model.
 *
 * Two deliberate departures from the October 20 build plan, both decided before any data exists:
 * - Time: a part has a time of day (`slot`) and a set of weekdays, instead of four fixed moments.
 *   Morning, Night, Saturday and Sunday are views computed from those, so a nightly bath is one
 *   part, not three copies, and a 6pm session has a home.
 * - A changed day is stored as edits on top of the base week, not as a full copy, so a later
 *   change to the base week still reaches days that were adjusted earlier.
 */

export const areaSchema = z.enum(['eat', 'move', 'mind', 'sleep', 'skin']);
export type Area = z.infer<typeof areaSchema>;

export const slotSchema = z.enum(['morning', 'midday', 'evening', 'night']);
export type Slot = z.infer<typeof slotSchema>;

export const daySchema = z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
export type Day = z.infer<typeof daySchema>;
export const DAYS: readonly Day[] = daySchema.options;
export const WEEKDAYS: readonly Day[] = ['mon', 'tue', 'wed', 'thu', 'fri'];
export const WEEKEND: readonly Day[] = ['sat', 'sun'];

/** How the screens and the message reader talk about a day: a view over slot and weekday. */
export const momentSchema = z.enum(['morning', 'night', 'saturday', 'sunday']);
export type Moment = z.infer<typeof momentSchema>;

export const lockSchema = z.enum(['theirs', 'clinician']).nullable();
export type Lock = z.infer<typeof lockSchema>;

export const attachmentSchema = z.enum(['theirs', 'loved', 'neutral', 'borrowed', 'unknown']);
export type Attachment = z.infer<typeof attachmentSchema>;

export const seasonSchema = z.enum([
  'steady',
  'busy',
  'stressed',
  'travelling',
  'energised',
  'low',
  'unwell',
]);
export type Season = z.infer<typeof seasonSchema>;

export const aweSchema = z.enum([
  'nature',
  'music',
  'visual',
  'collective',
  'moral',
  'spiritual',
  'life',
  'epiphany',
]);
export type Awe = z.infer<typeof aweSchema>;

export const tierSchema = z.enum(['A', 'B', 'C', 'D', 'N']);
export type EvidenceTier = z.infer<typeof tierSchema>;
/** 'U' is unknown evidence: a row nobody has reviewed. It neither protects nor clears. */
export const knownTierSchema = z.enum(['A', 'B', 'C', 'D', 'N', 'U']);
export type KnownTier = z.infer<typeof knownTierSchema>;

/** Conditions the person told us about in their own words; never inferred, always deletable. */
export const conditionSchema = z.enum([
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
export type Condition = z.infer<typeof conditionSchema>;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const clock = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const quote = z.string().min(1).max(600);

export const pictureLineSchema = z
  .object({
    id: z.string().min(1),
    kind: z.enum(['joy', 'people', 'toward', 'theirs']),
    text: z.string().min(1).max(200),
    by: z.enum(['distill', 'you']),
    at: z.string(),
  })
  .strict();
export type PictureLine = z.infer<typeof pictureLineSchema>;

export const personModelSchema = z
  .object({
    personId: z.string().min(1),
    /** IANA, from the browser. */
    timeZone: z.string().min(1).max(100),
    /** +1 on every change. */
    version: z.number().int().positive(),
    name: z.string().max(80),
    identity: z
      .object({
        /** progress.lifeText, verbatim. */
        idealDay: z.string().max(4000),
        atBest: z.array(z.string().max(200)).max(20),
        toward: z
          .array(
            z
              .object({
                text: z.string().min(1).max(200),
                hard: z.boolean(),
                /** YYYY-MM or YYYY-MM-DD, when they said when. */
                by: z.string().max(10).optional(),
                quote: quote.optional(),
              })
              .strict(),
          )
          .max(12),
        awe: z.array(aweSchema).max(8),
        goals: z.array(z.string().max(80)).max(20),
      })
      .strict(),
    people: z
      .array(
        z
          .object({
            id: z.string().min(1),
            name: z.string().min(1).max(80),
            relation: z.string().max(80).optional(),
            what: z.string().max(200),
            quote: quote.optional(),
          })
          .strict(),
      )
      .max(40),
    places: z
      .array(
        z
          .object({
            id: z.string().min(1),
            name: z.string().min(1).max(80),
            what: z.string().max(200),
            quote: quote.optional(),
          })
          .strict(),
      )
      .max(40),
    /** Why each thing is in their life, keyed by stack item id. */
    values: z.record(
      z.string(),
      z
        .object({
          attachment: attachmentSchema,
          /** Their words, quoted from notes, answers or messages. */
          reasons: z.array(quote).max(10),
          from: z.enum(['tap', 'note', 'answer', 'message', 'progress']),
        })
        .strict(),
    ),
    state: z
      .object({
        season: seasonSchema,
        since: isoDate,
        /** A season wears off; steady has no end. */
        until: isoDate.optional(),
        from: z.enum(['answer', 'message', 'nights', 'default']),
      })
      .strict(),
    signals: z
      .object({
        wearable: z.enum(['oura', 'whoop', 'fitbit', 'apple_export', 'csv', 'demo']).nullable(),
        /** Their own usual night, from their own history: median and scaled MAD, in minutes. */
        usual: z
          .object({ sleepMin: z.number(), swingMin: z.number(), nights: z.number().int() })
          .strict()
          .optional(),
        /** Never shown as scores. */
        lastNights: z
          .array(
            z
              .object({ date: isoDate, sleepMin: z.number().nonnegative().optional() })
              .strict(),
          )
          .max(28),
      })
      .strict(),
    constraints: z
      .object({
        clinicianItemIds: z.array(z.string()).max(200),
        declined: z.array(z.string().max(300)).max(100),
        removedLines: z.array(z.string().max(200)).max(200),
        /** Only from their own words, with the words kept; never inferred. */
        conditions: z
          .array(z.object({ condition: conditionSchema, quote, at: z.string() }).strict())
          .max(20),
      })
      .strict(),
    prefs: z
      .object({
        /** Off by default: a short night only reshapes the next morning when they turn this on. */
        nightsShapeMornings: z.boolean(),
      })
      .strict(),
    picture: z.array(pictureLineSchema).max(40),
  })
  .strict();
export type PersonModel = z.infer<typeof personModelSchema>;

export const partSourceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('stack'), stackItemId: z.string().min(1), itemKey: z.string().nullable() }).strict(),
  z.object({ kind: z.literal('words'), quote }).strict(),
  z.object({ kind: z.literal('explore'), ideaId: z.string().min(1) }).strict(),
  z.object({ kind: z.literal('engine'), rule: z.string().min(1).max(60) }).strict(),
  /** The catalog's swap for something they let go of (chamomile tea for apigenin), added on their yes. */
  z.object({ kind: z.literal('swap'), itemKey: z.string().min(1) }).strict(),
]);
export type PartSource = z.infer<typeof partSourceSchema>;

export const partWhenSchema = z
  .object({
    slot: slotSchema,
    /** The weekdays it runs. Empty with `perWeek` set means "a few times a week, any day". */
    days: z.array(daySchema).max(7),
    /** Local time, only when they told us or a reshape set it. */
    at: clock.optional(),
    perWeek: z.number().int().min(1).max(7).optional(),
  })
  .strict();
export type PartWhen = z.infer<typeof partWhenSchema>;

export const ritualPartSchema = z
  .object({
    /** Stable across every version, so check-offs, locks and learning can follow a part. */
    id: z.string().min(1),
    when: partWhenSchema,
    order: z.number().int().nonnegative(),
    title: z.string().min(1).max(80),
    minutes: z.number().int().min(1).max(600).optional(),
    place: z.string().max(80).optional(),
    /** PersonModel.people ids. */
    people: z.array(z.string()).max(10).optional(),
    area: areaSchema,
    /** One sentence in the companion voice, in their terms. */
    why: z.string().max(240),
    source: partSourceSchema,
    evidence: z.object({ itemKey: z.string(), tier: tierSchema }).strict().optional(),
    status: z.enum(['active', 'proposed', 'removed']),
    lock: lockSchema,
  })
  .strict();
export type RitualPart = z.infer<typeof ritualPartSchema>;

/** A part the engine or Claude proposes; ids, order, status and locks are assigned by code. */
export const newPartSchema = z
  .object({
    title: z.string().min(1).max(80),
    slot: slotSchema,
    at: clock.optional(),
    days: z.array(daySchema).max(7).optional(),
    perWeek: z.number().int().min(1).max(7).optional(),
    minutes: z.number().int().min(1).max(600).optional(),
    place: z.string().max(80).optional(),
    people: z.array(z.string()).max(10).optional(),
    area: areaSchema,
    why: z.string().max(240),
    source: partSourceSchema,
  })
  .strict();
export type NewPart = z.infer<typeof newPartSchema>;

/** Edits. Day scope: move, shorten, skip, swap, add. Base scope adds remove, edit and lock. */
export const opSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('move'), partId: z.string(), at: clock.optional(), slot: slotSchema.optional() }).strict(),
  z.object({ op: z.literal('shorten'), partId: z.string(), minutes: z.number().int().min(1).max(600) }).strict(),
  z.object({ op: z.literal('skip'), partId: z.string() }).strict(),
  z.object({ op: z.literal('swap'), partId: z.string(), with: newPartSchema }).strict(),
  z.object({ op: z.literal('add'), part: newPartSchema }).strict(),
  z.object({ op: z.literal('remove'), partId: z.string() }).strict(),
  z
    .object({
      op: z.literal('edit'),
      partId: z.string(),
      title: z.string().min(1).max(80).optional(),
      days: z.array(daySchema).max(7).optional(),
      perWeek: z.number().int().min(1).max(7).optional(),
      minutes: z.number().int().min(1).max(600).optional(),
      at: clock.nullable().optional(),
      slot: slotSchema.optional(),
    })
    .strict(),
  z.object({ op: z.literal('lock'), partId: z.string(), lock: lockSchema }).strict(),
]);
export type Op = z.infer<typeof opSchema>;

export const triggerKindSchema = z.enum([
  'onboarding',
  'message',
  'plan',
  'night',
  'slip',
  'edit',
  'decision',
  'refresh',
]);
export type TriggerKind = z.infer<typeof triggerKindSchema>;

export const engineStampSchema = z
  .object({
    engineVersion: z.string(),
    catalogVersion: z.string(),
    promptVersion: z.string().optional(),
    model: z.string().optional(),
    inputsHash: z.string(),
  })
  .strict();
export type EngineStamp = z.infer<typeof engineStampSchema>;

export const ritualVersionSchema = z
  .object({
    id: z.string().min(1),
    personId: z.string().min(1),
    /** Per person, monotonic across base and day versions. */
    version: z.number().int().positive(),
    parentId: z.string().nullable(),
    scope: z.discriminatedUnion('kind', [
      /** The recurring week, in force from a date (a plan that starts Monday starts Monday). */
      z.object({ kind: z.literal('base'), effectiveFrom: isoDate }).strict(),
      /** One dated day: edits on top of whatever base week is in force that day. */
      z.object({ kind: z.literal('day'), date: isoDate }).strict(),
    ]),
    /** Base: the full week. Day: empty; the day is rebuilt from `ops` over the base. */
    parts: z.array(ritualPartSchema),
    ops: z.array(opSchema),
    changes: z.array(z.object({ op: z.string(), partId: z.string(), reason: z.string().max(200) }).strict()),
    cause: z.object({ eventId: z.string().nullable(), trigger: triggerKindSchema }).strict(),
    status: z.enum(['proposed', 'accepted', 'undone', 'superseded']),
    reply: z.string().max(600).optional(),
    engine: engineStampSchema,
    createdAt: z.string(),
  })
  .strict();
export type RitualVersion = z.infer<typeof ritualVersionSchema>;

export const decisionKindSchema = z.enum(['clear', 'keep', 'curate', 'explore', 'refer']);
export type DecisionKind = z.infer<typeof decisionKindSchema>;

export const reasonCodeSchema = z.enum([
  // keep
  'THEIRS',
  'LOVED',
  'EVIDENCE_REGULAR',
  'TRAINS',
  'NOTHING_TO_CLEAR',
  // clear
  'BORROWED_WEAK',
  'OVERLAP',
  'UNUSED',
  'DOSE_BELOW_MIN',
  'FORM_NOT_ABSORBED',
  'UNLOVED_HABIT',
  /** Mixed or weak evidence, it costs money, and they said they can't feel it doing anything. */
  'NOT_FELT',
  /** Something expensive they don't love: the same activity for less, offered once. */
  'BUDGET',
  'NOT_TRAINING',
  'TOO_MANY_STEPS',
  // curate
  'ANCHOR',
  'PAIR',
  'ADJUST_DOSE',
  'ADJUST_FORM',
  /** Little or no evidence, and we don't yet know why they have it: one curious question, never a verdict. */
  'WORTH_A_LOOK',
  // explore
  'ROOM_MADE',
  // refer
  'SEE_A_DERMATOLOGIST',
  'SEE_A_CLINICIAN',
]);
export type ReasonCode = z.infer<typeof reasonCodeSchema>;

export const decisionStatusSchema = z.enum(['proposed', 'yes', 'not-now', 'theirs', 'withdrawn']);
export type DecisionStatus = z.infer<typeof decisionStatusSchema>;

export const decisionSchema = z
  .object({
    id: z.string().min(1),
    /** Null only for explore, which is about them, not one thing they have. */
    stackItemId: z.string().nullable(),
    itemKey: z.string().nullable(),
    kind: decisionKindSchema,
    reason: reasonCodeSchema,
    line: z.string().max(600),
    evidenceTier: knownTierSchema.optional(),
    /** Monthly money a clear gives back; 0 for free things. */
    money: z.number().nonnegative(),
    status: decisionStatusSchema,
    engine: engineStampSchema,
    createdAt: z.string(),
    answeredAt: z.string().optional(),
  })
  .strict();
export type Decision = z.infer<typeof decisionSchema>;

/** What the decide step needs to know about earlier answers, so "not now" means not now. */
export interface PriorDecision {
  readonly stackItemId: string | null;
  readonly kind: DecisionKind;
  readonly reason: ReasonCode;
  readonly status: DecisionStatus;
  readonly answeredAt?: string;
}

/** What a message, plan, night, slip or edit touches, before code resolves it to dates. */
export const triggerSchema = z
  .object({
    kind: z.enum(['message', 'plan', 'night', 'slip', 'edit']),
    dates: z.array(isoDate).max(31),
    moments: z.array(momentSchema).max(4),
    durability: z.enum(['once', 'ongoing']),
    load: z.enum(['lighter', 'same', 'heavier']),
    mentions: z
      .object({ people: z.array(z.string().max(80)).max(10), places: z.array(z.string().max(80)).max(10) })
      .strict()
      .optional(),
  })
  .strict();
export type Trigger = z.infer<typeof triggerSchema>;

/** Everything that can happen to a person; each one reruns the engine on what it touches. */
export type EngineEvent =
  | { readonly kind: 'onboarding' }
  | { readonly kind: 'stack-change' }
  | { readonly kind: 'note'; readonly stackItemId: string; readonly text: string }
  | { readonly kind: 'answer'; readonly q: string; readonly a: string; readonly stackItemId?: string }
  /** `about`: the stackItemId of the card they asked from (a Why? tap), when there is one. */
  | { readonly kind: 'message'; readonly text: string; readonly about?: string }
  | { readonly kind: 'night'; readonly date: string; readonly sleepMin: number }
  | { readonly kind: 'edit'; readonly scope: 'base' | 'day'; readonly date?: string; readonly ops: readonly Op[] }
  | {
      readonly kind: 'decision-answer';
      readonly decisionId: string;
      readonly answer: 'yes' | 'not-now' | 'theirs';
    }
  | { readonly kind: 'part'; readonly partId: string; readonly date: string; readonly done: boolean }
  /** They tapped an answer on a question card. Answers about their list are saved by the app first. */
  | {
      readonly kind: 'question-answer';
      readonly questionId: string;
      readonly label: string;
      readonly attachment?: 'loved' | 'neutral' | 'borrowed' | 'theirs';
      readonly stackItemId?: string;
    }
  /** Their yes to a feeling Distill heard in their words ("is AG1 something you love?"). */
  | { readonly kind: 'confirm'; readonly stackItemId: string; readonly attachment: 'loved' | 'neutral' | 'borrowed' }
  | { readonly kind: 'refresh' };
