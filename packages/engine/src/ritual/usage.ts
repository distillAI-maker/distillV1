import type { CatalogItemView } from '@distill/catalog';

/** The parts of a saved stack item the decide step reads. Structural, like progress itself. */
export interface StackItemLike {
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
}

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;
const bool = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null);

/** Origins that mean someone else's idea, as the person told us. */
export const BORROWED_ORIGINS = new Set(['online', 'friend', 'podcast']);

export interface Usage {
  /** Used often enough to count as part of their life; null when we don't know. */
  readonly regular: boolean | null;
  /** Known to be sitting unused; null when we don't know. */
  readonly unused: boolean | null;
  /** Uses or visits in the last 30 days, when known. */
  readonly perMonth: number | null;
  readonly stillPaying: boolean | null;
}

/** How many uses in 30 days makes something regular, by how often it is meant to happen. */
const REGULAR_FROM: Record<CatalogItemView['cadence'], number> = {
  daily: 8,
  weekly: 3,
  monthly: 1,
  occasional: 1,
};

const STALE_LAST_USED = new Set(['1 to 3 months ago', 'longer', 'cannot remember']);

export function usageOf(item: StackItemLike, view: CatalogItemView | undefined): Usage {
  const a = item.answers;
  const uses = num(a.usesLast30Days);
  const visits = num(a.visitsLast30Days);
  const perWeek = num(a.nightsPerWeek) ?? num(a.workoutNightsPerWeek) ?? num(a.phoneNightsPerWeek);
  const daysSince = num(a.daysSinceLastUse);
  const lastUsed = typeof a.lastUsed === 'string' ? a.lastUsed : null;
  const stillPaying = bool(a.stillPaying);
  const perMonth = uses ?? visits ?? (perWeek !== null ? Math.round(perWeek * 4.3) : null);
  const unused =
    perMonth === 0 ||
    (daysSince !== null && daysSince > 30) ||
    (lastUsed !== null && STALE_LAST_USED.has(lastUsed)) ||
    a.packageUnused === true
      ? true
      : perMonth !== null || daysSince !== null || lastUsed !== null
        ? false
        : null;
  const threshold = REGULAR_FROM[view?.cadence ?? 'daily'];
  const regular =
    unused === true
      ? false
      : perMonth !== null
        ? perMonth >= threshold
        : daysSince !== null
          ? daysSince <= 7
          : lastUsed === 'this week'
            ? true
            : null;
  return { regular, unused, perMonth, stillPaying };
}

/** Catalog rows that mean the person trains. */
export const TRAINING_KEYS = new Set([
  'strength-training',
  'gym-membership',
  'premium-gym-membership-equinox-life-time',
  'boutique-class-membership-barry-s-soulcycle-f45-orangetheory',
  'personal-trainer',
  'zone-2-cardio-3-h-week',
  'hiit-in-the-evening',
  'second-gym-or-studio-membership',
  'class-pack-or-studio-credits',
]);

/** Whether they train: their own answer first, then what their stack says; null when unknown. */
export function trainsOf(item: StackItemLike, stack: readonly StackItemLike[]): boolean | null {
  const own = bool(item.answers.trains);
  if (own !== null) return own;
  for (const s of stack) {
    if (s.status === 'cut') continue;
    const said = bool(s.answers.trains);
    if (said !== null) return said;
  }
  if (stack.some((s) => s.status !== 'cut' && s.itemKey && TRAINING_KEYS.has(s.itemKey)))
    return true;
  if (num(item.answers.trainingMinutesPerDay) !== null)
    return (num(item.answers.trainingMinutesPerDay) ?? 0) >= 20;
  return null;
}

const MASS: Record<string, number> = { g: 1000, mg: 1, mcg: 0.001 };

/** Their dose in the row's unit, when we know both and they can be compared. */
export function doseIn(item: StackItemLike, unit: string): number | null {
  const dose = num(item.answers.dose);
  if (dose === null) return null;
  const given = typeof item.answers.doseUnit === 'string' ? item.answers.doseUnit : unit;
  const from = given === 'mg elemental' || given === 'mg EPA+DHA' ? 'mg' : given;
  if (from === unit) return dose;
  if (MASS[from] !== undefined && MASS[unit] !== undefined) return (dose * MASS[from]!) / MASS[unit]!;
  return null;
}

export interface DoseCheck {
  readonly below: boolean | null;
  readonly unstudiedForm: boolean | null;
}

/** Whether their dose and form match what was studied; null when we don't know. */
export function doseCheck(item: StackItemLike, view: CatalogItemView | undefined): DoseCheck {
  if (!view?.dose) return { below: null, unstudiedForm: null };
  const dose = doseIn(item, view.dose.unit);
  const form = typeof item.answers.form === 'string' ? item.answers.form.trim().toLowerCase() : '';
  const studied = view.dose.studiedForms.map((f) => f.toLowerCase());
  return {
    below: dose === null ? null : dose < view.dose.min,
    unstudiedForm:
      !form || !studied.length ? null : !studied.some((f) => form.includes(f) || f.includes(form)),
  };
}

/** Whether the person meets what the evidence needs (trains, a measured deficiency); null if unknown. */
export function requirementMet(
  view: CatalogItemView,
  item: StackItemLike,
  stack: readonly StackItemLike[],
): boolean | null {
  switch (view.evidenceRequires) {
    case 'none':
      return true;
    case 'trains':
      return trainsOf(item, stack);
    case 'deficiency': {
      const said = bool(item.answers.deficiency);
      if (said !== null) return said;
      return item.origin === 'blood test' ? true : null;
    }
    case 'low_intake':
      return bool(item.answers.lowIntake);
  }
}

export function displayName(item: StackItemLike, view: CatalogItemView | undefined): string {
  return (item.label || view?.shortName || item.customName || view?.name || 'This').slice(0, 80);
}
