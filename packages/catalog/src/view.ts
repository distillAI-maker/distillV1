import type { Catalog, Item } from './schema.js';
import type { CatalogV4, V4Item } from './schema-v4.js';

/**
 * One view of an item for the engine, whichever table it comes from.
 *
 * A V4 row reaches the engine only once its status is allowed (production: live). Anything else
 * falls back to V3, whose evidence has not been reviewed: those rows carry tier 'U', unknown, so
 * evidence can neither protect them nor clear them. Only the person's own values and the
 * objective rules (unused, overlap) apply to them. Unknown is not weak.
 */
export type ViewTier = 'A' | 'B' | 'C' | 'D' | 'N' | 'U';

export interface CatalogItemView {
  readonly key: string;
  readonly name: string;
  readonly shortName: string;
  readonly area: V4Item['area'];
  readonly alsoServes: readonly V4Item['area'][];
  readonly kind: V4Item['kind'];
  readonly moments: readonly V4Item['moments'][number][];
  readonly cadence: V4Item['cadence'];
  readonly ritualRole: V4Item['ritualRole'];
  readonly costMonthUsd: number;
  readonly comesFrom: readonly V4Item['comesFrom'][number][];
  readonly whyLoved: readonly V4Item['whyLoved'][number][];
  readonly tier: ViewTier;
  /**
   * What the tier is evidence of: a benefit (creatine, sunscreen), a cost (a nightcap, nicotine),
   * or neither. Derived from the row's codes: keep-by-evidence means benefit; an unloved-habit
   * clear means cost. Only benefit evidence protects anything.
   */
  readonly evidenceDirection: 'benefit' | 'cost' | 'neutral';
  readonly evidenceFor: string;
  readonly evidenceRequires: V4Item['evidenceRequires'];
  readonly tierOtherwise: ViewTier | null;
  readonly evidenceSummary: string;
  readonly dose: {
    readonly min: number;
    readonly typical: string;
    readonly unit: NonNullable<V4Item['doseUnit']>;
    readonly studiedForms: readonly string[];
  } | null;
  readonly keepWhen: readonly V4Item['keepWhen'][number][];
  readonly clearWhen: readonly V4Item['clearWhen'][number][];
  readonly neverClear: boolean;
  readonly humanQuestion: string;
  /** The where-did-it-come-from question in this item's words, or '' for the plain one. */
  readonly originQuestion: string;
  readonly fitsInstead: string;
  readonly awe: V4Item['awe'];
  readonly wearableSees: V4Item['wearableSees'];
  readonly overlaps: readonly string[];
  readonly safety: readonly V4Item['safety'][number][];
  readonly origin: 'v4' | 'v3';
  readonly status: V4Item['status'] | 'v3';
}

export interface OverlapGroupView {
  readonly group: string;
  readonly members: readonly string[];
  readonly rule: 'keep-one' | 'keep-best-evidence' | 'keep-most-used' | 'show-together';
  readonly note: string;
}

export interface CatalogView {
  /** sha256 of the V4 workbook, or 'v3-only'. Stamped on every engine output. */
  readonly version: string;
  item(key: string | null | undefined): CatalogItemView | undefined;
  readonly groups: readonly OverlapGroupView[];
  groupsOf(key: string): readonly OverlapGroupView[];
}

type V3Category = Item['category'];

const AREA_WORDS: [RegExp, V4Item['area']][] = [
  [/skin|hair|acne|wrinkle/i, 'skin'],
  [/sleep|insomnia|jet lag|wind[- ]down/i, 'sleep'],
  [/strength|muscle|fitness|recovery|soreness|endurance|cardio|training|joint/i, 'move'],
  [/stress|mood|focus|anxiety|calm|memory|cognition|mental/i, 'mind'],
];
const AREA_BY_CATEGORY: Record<V3Category, V4Item['area']> = {
  supplement: 'eat',
  'food/drink': 'eat',
  timing: 'sleep',
  habit: 'sleep',
  device: 'sleep',
  service: 'move',
  environment: 'sleep',
  skincare: 'skin',
};
const KIND_BY_CATEGORY: Record<V3Category, V4Item['kind']> = {
  supplement: 'supplement',
  'food/drink': 'food-drink',
  timing: 'timing',
  habit: 'practice',
  device: 'device',
  service: 'service',
  environment: 'environment',
  skincare: 'practice',
};

function areaFromV3(item: Item): V4Item['area'] {
  if (item.category === 'skincare') return 'skin';
  for (const [pattern, area] of AREA_WORDS) if (pattern.test(item.usualGoal ?? '')) return area;
  return AREA_BY_CATEGORY[item.category];
}

function shortNameFromV3(name: string): string {
  const base = name.replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
  const words = base.split(' ');
  return words.length <= 3 ? base : words.slice(0, 3).join(' ');
}

/** A V3 row seen through V4's eyes: identity, cost and the objective rules only. */
export function itemFromV3(item: Item): CatalogItemView {
  const service = item.category === 'service' || item.category === 'device';
  return {
    key: item.key,
    name: item.name,
    shortName: shortNameFromV3(item.name),
    area: areaFromV3(item),
    alsoServes: [],
    kind: KIND_BY_CATEGORY[item.category],
    moments: ['any'],
    cadence: item.category === 'service' ? 'weekly' : 'daily',
    ritualRole: service ? 'standalone' : 'companion',
    costMonthUsd: item.monthlyCost,
    comesFrom: [],
    whyLoved: [],
    tier: 'U',
    evidenceDirection: 'neutral',
    evidenceFor: '',
    evidenceRequires: 'none',
    tierOtherwise: null,
    evidenceSummary: '',
    dose: null,
    keepWhen: ['THEIRS', 'LOVED'],
    clearWhen: ['UNUSED', 'OVERLAP'],
    neverClear: item.tier === 'PROTECTED',
    humanQuestion: item.question,
    originQuestion: '',
    fitsInstead: '',
    awe: null,
    wearableSees: item.visibility,
    overlaps: item.overlapGroups,
    safety: item.safety ? [{ condition: 'any', action: 'note', note: item.safety }] : [],
    origin: 'v3',
    status: 'v3',
  };
}

export function itemFromV4(row: V4Item): CatalogItemView {
  return {
    key: row.key,
    name: row.name,
    shortName: row.shortName,
    area: row.area,
    alsoServes: row.alsoServes,
    kind: row.kind,
    moments: row.moments,
    cadence: row.cadence,
    ritualRole: row.ritualRole,
    costMonthUsd: row.costMonthUsd,
    comesFrom: row.comesFrom,
    whyLoved: row.whyLoved,
    tier: row.evidenceTier,
    evidenceDirection:
      row.keepWhen.includes('EVIDENCE_REGULAR') || row.keepWhen.includes('TRAINS')
        ? 'benefit'
        : row.clearWhen.includes('UNLOVED_HABIT')
          ? 'cost'
          : 'neutral',
    evidenceFor: row.evidenceFor,
    evidenceRequires: row.evidenceRequires,
    tierOtherwise: row.tierOtherwise,
    evidenceSummary: row.evidenceSummary,
    dose:
      row.doseMin !== null && row.doseUnit !== null
        ? { min: row.doseMin, typical: row.doseTypical, unit: row.doseUnit, studiedForms: row.studiedForms }
        : null,
    keepWhen: row.keepWhen,
    clearWhen: row.clearWhen,
    neverClear: row.neverClear,
    humanQuestion: row.humanQuestion,
    originQuestion: row.originQuestion,
    fitsInstead: row.fitsInstead,
    awe: row.awe,
    wearableSees: row.wearableSees,
    overlaps: row.overlaps,
    safety: row.safety,
    origin: 'v4',
    status: row.status,
  };
}

export interface ViewOptions {
  /** Which V4 statuses reach the engine. Production: ['live']. Evaluation may add 'reviewed'. */
  readonly statuses: readonly V4Item['status'][];
}

/** itemV4(key) ?? itemFromV3(key): the adapter the engine reads through until V4 covers every row. */
export function buildCatalogView(
  v4: CatalogV4 | null,
  v3: Pick<Catalog, 'items' | 'overlapGroups'>,
  options: ViewOptions = { statuses: ['live'] },
): CatalogView {
  const allowed = new Set(options.statuses);
  const v4Rows = new Map(
    (v4?.items ?? []).filter((r) => allowed.has(r.status)).map((r) => [r.key, itemFromV4(r)]),
  );
  const v3Rows = new Map(v3.items.map((i) => [i.key, i]));
  const cache = new Map<string, CatalogItemView>();
  const item = (key: string | null | undefined) => {
    if (!key) return undefined;
    const hit = cache.get(key);
    if (hit) return hit;
    const fromV4 = v4Rows.get(key);
    const view = fromV4 ?? (v3Rows.has(key) ? itemFromV3(v3Rows.get(key)!) : undefined);
    if (view) cache.set(key, view);
    return view;
  };
  // Once V4 exists its overlap sheet is the whole list: every V3 group was carried over with an
  // explicit rule, and V3's prose rules ("shown, not auto-dropped") can't be read as keep-one.
  const groups: OverlapGroupView[] = v4
    ? v4.overlaps.map((g) => ({ group: g.group, members: g.members, rule: g.rule, note: g.note }))
    : v3.overlapGroups.map((g) => ({ group: g.name, members: g.itemKeys, rule: 'keep-one' as const, note: g.ruleText }));
  return {
    version: v4?.sourceSha256 ?? 'v3-only',
    item,
    groups,
    groupsOf: (key) => groups.filter((g) => g.members.includes(key)),
  };
}
