import { z } from 'zod';
import { median } from '../experiment/utils.js';
import { addDays } from './time.js';
import {
  attachmentSchema,
  aweSchema,
  conditionSchema,
  seasonSchema,
  type Attachment,
  type Condition,
  type PersonModel,
  type Season,
} from './types.js';

/**
 * The person model is built from what the app already saves (progress) and grows from their words.
 * Building it is pure; the server stores the result and every patch, so it can always be rebuilt.
 */

/** The parts of today's saved progress the person model reads. Kept structural on purpose. */
export interface ProgressLike {
  readonly name: string;
  readonly lifeText: string;
  readonly goals: readonly string[];
  readonly dataSource?: string;
  readonly items: readonly {
    readonly id: string;
    readonly itemKey: string | null;
    readonly customName?: string;
    readonly label?: string;
    readonly monthlyCost: number;
    readonly origin?: string;
    readonly answers: Readonly<Record<string, unknown>>;
    readonly status: 'listed' | 'cut' | 'kept' | 'testing' | 'protected';
    readonly dataSource?: boolean;
    readonly notes: readonly { readonly id: string; readonly text: string; readonly at: string }[];
    readonly ideasDeclined?: readonly string[];
  }[];
  readonly dayOne: { readonly yours: readonly string[] };
  readonly asks: readonly { readonly q: string; readonly a: string; readonly at: string }[];
  readonly picture?: {
    readonly lines: readonly {
      readonly id: string;
      readonly kind: 'joy' | 'people' | 'toward' | 'theirs';
      readonly text: string;
      readonly by: 'distill' | 'you';
      readonly at: string;
    }[];
    readonly removed: readonly string[];
  };
}

export const CLINICIAN_ORIGINS = new Set(['doctor', 'blood test']);

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'x';

/** "Leah: reformer, matcha after" or "Leah, who ..." from a people line; null when there's no name. */
function personFromLine(text: string): { name: string; what: string } | null {
  const colon = /^([A-Z][\p{L}'-]+(?: [A-Z][\p{L}'-]+)?)\s*:\s*(.+)$/u.exec(text.trim());
  if (colon) return { name: colon[1]!, what: colon[2]!.trim() };
  const lead = /^(?:your\s+)?([A-Z][\p{L}'-]+)\b[, ]+(.+)$/u.exec(text.trim());
  if (lead && !/^(Your|The|A|An|When|Who|With)$/.test(lead[1]!)) return { name: lead[1]!, what: text.trim() };
  return null;
}

/**
 * Conditions in their own plain words, read without a model: a skin condition, a pregnancy,
 * breastfeeding. Conservative on purpose (present tense, never negated), and each keeps the
 * sentence it came from. Claude's reading of their words adds the rest.
 */
const WORD_CONDITIONS: readonly [Condition, RegExp][] = [
  [
    'skin-condition',
    /\b(acne|breaking out|break ?outs?|eczema|rosacea|psoriasis|dermatitis|cystic)\b|\bmole\b[^.!?]{0,60}\b(bigger|darker|changed|changing|growing|itch\w*|bleed\w*)\b/i,
  ],
  ['pregnant', /\b(i'?m|i am|we'?re|currently)\s+(\d+\s+(?:weeks?|months?)\s+)?pregnant\b/i],
  ['breastfeeding', /\b(breast-?feeding|pumping (?:at work|milk))\b/i],
];
const NEGATED = /\b(no|not|never|isn'?t|aren'?t|don'?t|doesn'?t|didn'?t|used to|was|were|had|stopped)\b[^.!?]{0,25}$/i;

export function conditionsFromWords(
  texts: readonly { readonly text: string; readonly at: string }[],
): PersonModel['constraints']['conditions'] {
  const out: PersonModel['constraints']['conditions'] = [];
  for (const { text, at } of texts)
    for (const sentence of text.split(/(?<=[.!?])\s+|\n+/))
      for (const [condition, pattern] of WORD_CONDITIONS) {
        if (out.some((c) => c.condition === condition)) continue;
        const m = pattern.exec(sentence);
        if (!m || NEGATED.test(sentence.slice(0, m.index))) continue;
        out.push({ condition, quote: sentence.trim().slice(0, 600), at });
      }
  return out;
}

export function personFromProgress(
  progress: ProgressLike,
  ctx: { personId: string; timeZone: string; today: string },
): PersonModel {
  const lines = progress.picture?.lines ?? [];
  const yours = new Set(progress.dayOne.yours);
  const values: PersonModel['values'] = {};
  for (const item of progress.items) {
    const theirs = item.status === 'kept' || yours.has(item.id);
    values[item.id] = {
      attachment: theirs ? 'theirs' : 'unknown',
      reasons: [],
      from: theirs ? 'tap' : 'progress',
    };
  }
  const people: PersonModel['people'] = [];
  for (const line of lines.filter((l) => l.kind === 'people')) {
    const found = personFromLine(line.text);
    if (found && !people.some((p) => p.name === found.name))
      people.push({ id: slug(found.name), name: found.name, what: found.what.slice(0, 200) });
  }
  const wearable = progress.dataSource;
  return {
    personId: ctx.personId,
    timeZone: ctx.timeZone,
    version: 1,
    name: progress.name.trim().split(/\s+/)[0]?.slice(0, 80) ?? '',
    identity: {
      idealDay: progress.lifeText,
      atBest: lines.filter((l) => l.kind === 'joy').map((l) => l.text).slice(0, 20),
      toward: lines
        .filter((l) => l.kind === 'toward')
        .slice(0, 12)
        .map((l) => ({ text: l.text, hard: false })),
      awe: [],
      goals: progress.goals.filter((g) => !/nothing specific/i.test(g)).slice(0, 20),
    },
    people: people.slice(0, 40),
    places: [],
    values,
    state: { season: 'steady', since: ctx.today, from: 'default' },
    signals: {
      wearable:
        wearable === 'oura' ||
        wearable === 'whoop' ||
        wearable === 'fitbit' ||
        wearable === 'apple_export' ||
        wearable === 'csv' ||
        wearable === 'demo'
          ? wearable
          : null,
      lastNights: [],
    },
    constraints: {
      clinicianItemIds: progress.items
        .filter((i) => (i.origin && CLINICIAN_ORIGINS.has(i.origin)) || i.status === 'protected')
        .map((i) => i.id),
      declined: progress.items.flatMap((i) => i.ideasDeclined ?? []).slice(-100),
      removedLines: [...(progress.picture?.removed ?? [])].slice(-200),
      conditions: conditionsFromWords([
        { text: progress.lifeText, at: ctx.today },
        ...progress.items.flatMap((i) => i.notes.map((n) => ({ text: n.text, at: n.at }))),
        ...progress.asks.map((a) => ({ text: a.a, at: a.at })),
      ]),
    },
    prefs: { nightsShapeMornings: false },
    picture: lines.map((l) => ({ ...l })).slice(0, 40),
  };
}

/**
 * Re-reads progress into an existing model: taps, stack and picture come from progress again;
 * what only words taught us (people, places, seasons, attachments with quotes) is kept.
 */
export function refreshFromProgress(
  person: PersonModel,
  progress: ProgressLike,
  today: string,
): PersonModel {
  const fresh = personFromProgress(progress, {
    personId: person.personId,
    timeZone: person.timeZone,
    today,
  });
  const values: PersonModel['values'] = {};
  for (const [id, v] of Object.entries(fresh.values)) {
    const before = person.values[id];
    // A tap in progress always wins; otherwise what their words taught us stays.
    values[id] = v.attachment === 'theirs' ? v : before && before.from !== 'progress' ? before : v;
  }
  const byName = new Map(person.people.map((p) => [p.name, p]));
  for (const p of fresh.people) if (!byName.has(p.name)) byName.set(p.name, p);
  const towardTexts = new Set(person.identity.toward.map((t) => t.text));
  return {
    ...person,
    name: fresh.name,
    identity: {
      ...person.identity,
      idealDay: fresh.identity.idealDay,
      atBest: unique([...fresh.identity.atBest, ...person.identity.atBest]).slice(0, 20),
      toward: [
        ...person.identity.toward,
        ...fresh.identity.toward.filter((t) => !towardTexts.has(t.text)),
      ].slice(0, 12),
      goals: fresh.identity.goals,
    },
    people: [...byName.values()].slice(0, 40),
    values,
    signals: { ...person.signals, wearable: fresh.signals.wearable },
    constraints: {
      ...person.constraints,
      clinicianItemIds: fresh.constraints.clinicianItemIds,
      declined: unique([...person.constraints.declined, ...fresh.constraints.declined]).slice(-100),
      removedLines: unique([...person.constraints.removedLines, ...fresh.constraints.removedLines]).slice(-200),
      conditions: [
        ...person.constraints.conditions,
        ...fresh.constraints.conditions.filter((c) => !person.constraints.conditions.some((k) => k.condition === c.condition)),
      ].slice(0, 20),
    },
    picture: fresh.picture,
  };
}

const unique = <T,>(xs: readonly T[]) => [...new Set(xs)];

/** How long a season lasts when they don't say: it wears off and Distill goes back to steady. */
export const SEASON_DAYS: Record<Exclude<Season, 'steady'>, number> = {
  busy: 7,
  stressed: 7,
  travelling: 5,
  energised: 10,
  low: 5,
  unwell: 3,
};

/** Their season today: an expired season is steady again. */
export function seasonOn(person: PersonModel, today: string): Season {
  const { season, until } = person.state;
  if (season === 'steady') return 'steady';
  if (until && today > until) return 'steady';
  return season;
}

/** Changes Claude may propose from their words. Each must quote the words it came from. */
export const personOpSchema = z.discriminatedUnion('op', [
  z
    .object({
      op: z.literal('attachment'),
      stackItemId: z.string().min(1),
      attachment: attachmentSchema.exclude(['theirs']),
      /** 'explicit' when they said so in as many words ("I bought it from a TikTok and feel nothing"). */
      basis: z.enum(['explicit', 'implied']),
      quote: z.string().min(1).max(600),
    })
    .strict(),
  z
    .object({
      op: z.literal('person'),
      name: z.string().min(1).max(80),
      relation: z.string().max(80).optional(),
      what: z.string().min(1).max(200),
      quote: z.string().min(1).max(600),
    })
    .strict(),
  z
    .object({
      op: z.literal('place'),
      name: z.string().min(1).max(80),
      what: z.string().min(1).max(200),
      quote: z.string().min(1).max(600),
    })
    .strict(),
  z
    .object({
      op: z.literal('toward'),
      text: z.string().min(1).max(200),
      hard: z.boolean(),
      by: z.string().regex(/^\d{4}-\d{2}(?:-\d{2})?$/).optional(),
      quote: z.string().min(1).max(600),
    })
    .strict(),
  z
    .object({ op: z.literal('atBest'), text: z.string().min(1).max(200), quote: z.string().min(1).max(600) })
    .strict(),
  z.object({ op: z.literal('awe'), awe: aweSchema, quote: z.string().min(1).max(600) }).strict(),
  z
    .object({
      op: z.literal('season'),
      season: seasonSchema,
      /** YYYY-MM-DD, only when they said how long. */
      until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      quote: z.string().min(1).max(600),
    })
    .strict(),
  z
    .object({ op: z.literal('condition'), condition: conditionSchema, quote: z.string().min(1).max(600) })
    .strict(),
  /** "Makes me jittery during showings" (false), "Mónica fixes my back" (true). */
  z
    .object({ op: z.literal('feels'), stackItemId: z.string().min(1), feels: z.boolean(), quote: z.string().min(1).max(600) })
    .strict(),
  /** "Only on travel nights", "after night shifts": when it actually happens. */
  z
    .object({ op: z.literal('occasion'), stackItemId: z.string().min(1), occasion: z.string().min(1).max(80), quote: z.string().min(1).max(600) })
    .strict(),
]);
export type PersonOp = z.infer<typeof personOpSchema>;

export interface PersonPatchResult {
  readonly person: PersonModel;
  readonly applied: readonly PersonOp[];
  readonly dropped: readonly { readonly op: PersonOp; readonly why: string }[];
  /** Readings we won't apply without asking: a downgrade of something they love. */
  readonly ask: readonly { readonly stackItemId: string; readonly attachment: Attachment; readonly quote: string }[];
}

const normalize = (s: string) =>
  s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

/** True when the quote is really in what they wrote (ignoring case, curly quotes and spacing). */
export function quotes(source: string, quote: string): boolean {
  const q = normalize(quote).replace(/^["']|["']$/g, '');
  return q.length >= 3 && normalize(source).includes(q);
}

const RANK: Record<Attachment, number> = { theirs: 4, loved: 3, neutral: 1, borrowed: 0, unknown: 2 };

/**
 * Applies Claude's reading of their words. Code, not the model, decides what sticks:
 * - every op must quote words that are really in `source`, or it's dropped;
 * - "theirs" is final and only ever set by their own tap;
 * - a downgrade of something loved is never applied; it becomes a question for them;
 * - "borrowed" needs explicit words, because misreading love as borrowed costs trust.
 */
export function applyPersonOps(
  person: PersonModel,
  ops: readonly PersonOp[],
  source: string,
  ctx: { today: string; at: string; from: 'note' | 'answer' | 'message' | 'onboarding' },
): PersonPatchResult {
  const applied: PersonOp[] = [];
  const dropped: { op: PersonOp; why: string }[] = [];
  const ask: { stackItemId: string; attachment: Attachment; quote: string }[] = [];
  let next: PersonModel = structuredClone(person);
  for (const op of ops) {
    if (!quotes(source, op.quote)) {
      dropped.push({ op, why: 'quote not in their words' });
      continue;
    }
    switch (op.op) {
      case 'attachment': {
        const current = next.values[op.stackItemId];
        if (!current) {
          dropped.push({ op, why: 'unknown item' });
          break;
        }
        if (current.attachment === 'theirs') {
          dropped.push({ op, why: 'theirs is final' });
          break;
        }
        const down = RANK[op.attachment] < RANK[current.attachment];
        if (current.attachment === 'loved' && down) {
          ask.push({ stackItemId: op.stackItemId, attachment: op.attachment, quote: op.quote });
          dropped.push({ op, why: 'downgrade of something loved becomes a question' });
          break;
        }
        if (op.attachment === 'borrowed' && op.basis !== 'explicit') {
          dropped.push({ op, why: 'borrowed needs their explicit words' });
          break;
        }
        // Keep what else was read about it (feels, occasion): an attachment says why, not when.
        next.values[op.stackItemId] = {
          ...current,
          attachment: op.attachment,
          reasons: [...current.reasons, op.quote].slice(-10),
          from: ctx.from,
        };
        applied.push(op);
        break;
      }
      case 'feels':
      case 'occasion': {
        const current = next.values[op.stackItemId];
        if (!current) {
          dropped.push({ op, why: 'unknown item' });
          break;
        }
        next.values[op.stackItemId] = {
          ...current,
          reasons: [...current.reasons, op.quote].slice(-10),
          ...(op.op === 'feels' ? { feels: op.feels } : { occasion: op.occasion }),
        };
        applied.push(op);
        break;
      }
      case 'person': {
        const existing = next.people.find((p) => p.name.toLowerCase() === op.name.toLowerCase());
        if (existing) {
          existing.what = op.what;
          if (op.relation) existing.relation = op.relation;
          existing.quote = op.quote;
        } else if (next.people.length < 40) {
          let id = slug(op.name);
          while (next.people.some((p) => p.id === id)) id = `${id}-x`;
          next.people.push({
            id,
            name: op.name,
            what: op.what,
            ...(op.relation ? { relation: op.relation } : {}),
            quote: op.quote,
          });
        }
        applied.push(op);
        break;
      }
      case 'place': {
        const existing = next.places.find((p) => p.name.toLowerCase() === op.name.toLowerCase());
        if (existing) {
          existing.what = op.what;
          existing.quote = op.quote;
        } else if (next.places.length < 40) {
          let id = slug(op.name);
          while (next.places.some((p) => p.id === id)) id = `${id}-x`;
          next.places.push({ id, name: op.name, what: op.what, quote: op.quote });
        }
        applied.push(op);
        break;
      }
      case 'toward': {
        const list = next.identity.toward.filter(
          (t) => normalize(t.text) !== normalize(op.text),
        );
        list.push({ text: op.text, hard: op.hard, ...(op.by ? { by: op.by } : {}), quote: op.quote });
        next.identity.toward = list.slice(-12);
        applied.push(op);
        break;
      }
      case 'atBest': {
        if (!next.identity.atBest.some((t) => normalize(t) === normalize(op.text)))
          next.identity.atBest = [...next.identity.atBest, op.text].slice(-20);
        applied.push(op);
        break;
      }
      case 'awe': {
        if (!next.identity.awe.includes(op.awe)) next.identity.awe = [...next.identity.awe, op.awe];
        applied.push(op);
        break;
      }
      case 'season': {
        const until =
          op.season === 'steady'
            ? undefined
            : (op.until && op.until >= ctx.today ? op.until : undefined) ??
              addDays(ctx.today, SEASON_DAYS[op.season]);
        next.state = {
          season: op.season,
          since: ctx.today,
          ...(until ? { until } : {}),
          from: ctx.from === 'note' || ctx.from === 'onboarding' ? 'message' : ctx.from,
        };
        applied.push(op);
        break;
      }
      case 'condition': {
        if (!next.constraints.conditions.some((c) => c.condition === op.condition))
          next.constraints.conditions = [
            ...next.constraints.conditions,
            { condition: op.condition, quote: op.quote, at: ctx.at },
          ].slice(-20);
        applied.push(op);
        break;
      }
    }
  }
  if (applied.length) next = { ...next, version: person.version + 1 };
  else next = person;
  return { person: next, applied, dropped, ask };
}

/** Their usual night from their own history: median and scaled MAD over the last 28 nights. */
export function withNights(
  person: PersonModel,
  nights: readonly { readonly date: string; readonly sleepMin?: number }[],
): PersonModel {
  const recent = [...nights].sort((a, b) => a.date.localeCompare(b.date)).slice(-28);
  const values = recent.flatMap((n) => (typeof n.sleepMin === 'number' ? [n.sleepMin] : []));
  let usual: PersonModel['signals']['usual'];
  if (values.length >= 14) {
    const mid = median(values);
    const mad = median(values.map((v) => Math.abs(v - mid)));
    usual = { sleepMin: mid, swingMin: Math.max(1, mad * 1.4826), nights: values.length };
  }
  return {
    ...person,
    signals: {
      ...person.signals,
      ...(usual ? { usual } : {}),
      lastNights: recent.map((n) => ({
        date: n.date,
        ...(typeof n.sleepMin === 'number' ? { sleepMin: n.sleepMin } : {}),
      })),
    },
  };
}
