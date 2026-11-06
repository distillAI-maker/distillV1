import { z } from 'zod';
import type { CatalogView } from '@distill/catalog';
import { copy } from '../../lib/copy';
import { catalog } from '../../lib/catalog/server';
import { emptyProgress, type Progress } from '../../lib/progress/types';
import { previewEngine } from './engine';

/**
 * "What's on your list?" on the landing page, answered by the app's own engine: the same rules,
 * the same catalog and the same decisions a person gets in the app. Nothing is stored.
 */

export const tryInputSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            key: z.string().regex(/^[a-z0-9-]{1,80}$/),
            /** They said it came from a feed: what the app's first study question asks. */
            feed: z.boolean().optional(),
            /** "Can you feel it doing something for you?", the app's question for mixed evidence. */
            feels: z.boolean().optional(),
          })
          .strict(),
      )
      .max(40),
  })
  .strict();
export type TryInput = z.infer<typeof tryInputSchema>;

export type TryStatus = 'go' | 'look' | 'adjust' | 'founded' | 'stays';

export interface TryItem {
  readonly key: string;
  readonly name: string;
  readonly status: TryStatus;
  /** A few words on why, for what can go or is worth a look. */
  readonly why: string;
  /** What it costs a month, from the catalog. */
  readonly monthly: number;
  /** The cheaper or simpler thing that does the same job, when the catalog has one. */
  readonly instead?: string;
}

export interface TryResult {
  readonly items: readonly TryItem[];
  /** What letting go of everything in `go` keeps, a month. */
  readonly back: number;
}

const t = copy.landingTry;

export function tryList(input: TryInput, view: CatalogView, banned: readonly string[] = catalog.toneRules.bannedPhrases): TryResult {
  const known = new Map(catalog.items.map((i) => [i.key, i]));
  const seen = new Set<string>();
  const picked = input.items.filter((i) => known.has(i.key) && !seen.has(i.key) && seen.add(i.key));
  const progress: Progress = {
    ...emptyProgress(),
    items: picked.map((i, n) => ({
      id: `t${n}`,
      itemKey: i.key,
      monthlyCost: known.get(i.key)!.monthlyCost ?? 0,
      answers: i.feels === undefined ? {} : { feels: i.feels },
      chips: {},
      unknown: [],
      status: 'listed',
      notes: [],
      position: n,
      ...(i.feed ? { origin: 'online' as const } : {}),
    })),
  };
  const run = previewEngine(progress, { catalog: view, banned });
  // Mixed evidence that costs money comes down to one question. Ask the engine what a "Not really"
  // would do, so this page offers exactly the choice the app does.
  const ifNotFelt = previewEngine(
    { ...progress, items: progress.items.map((s) => (s.answers.feels === undefined ? { ...s, answers: { ...s.answers, feels: false } } : s)) },
    { catalog: view, banned },
  );
  const items = progress.items.map((s): TryItem => {
    const key = s.itemKey!;
    const row = view.item(key);
    const mine = run.decisions.filter((d) => d.stackItemId === s.id);
    const name = mine[0]?.name ?? known.get(key)!.name;
    const clear = mine.find((d) => d.kind === 'clear');
    const context = (clear ?? mine[0])?.context as { keeperName?: string; fitsInstead?: string } | undefined;
    const instead = usefulInstead(context?.fitsInstead ?? row?.fitsInstead, row?.shortName);
    const because = t.because[key];
    const base = { key, name, monthly: s.monthlyCost, ...(instead ? { instead } : {}) };
    // A habit that costs them gets a swap, not a let-go: it stays, done a little differently.
    if (clear?.reason === 'UNLOVED_HABIT') return { ...base, status: 'adjust', why: because ?? t.why.UNLOVED_HABIT };
    if (clear) {
      const why = clear.reason === 'OVERLAP' && context?.keeperName ? t.why.overlap(context.keeperName) : (because ?? t.why[clear.reason as keyof typeof t.why]);
      return { ...base, status: 'go', why: typeof why === 'string' ? why : t.why.fallback };
    }
    if (mine.some((d) => d.reason === 'WORTH_A_LOOK')) return { ...base, status: 'look', why: because ?? t.why.look };
    if (mine.some((d) => d.reason === 'PAIR')) return { ...base, status: 'adjust', why: t.why.pair };
    if (mine.some((d) => d.reason === 'BUDGET')) return { ...base, status: 'adjust', why: because ?? t.why.budget };
    if (mine.some((d) => d.reason === 'ADJUST_DOSE' || d.reason === 'ADJUST_FORM'))
      return { ...base, status: 'adjust', why: mine.some((d) => d.reason === 'ADJUST_DOSE') ? t.why.dose : t.why.form };
    if (mine.some((d) => d.kind === 'keep' && (d.reason === 'EVIDENCE_REGULAR' || d.reason === 'TRAINS')))
      return { ...base, status: 'founded', why: row?.evidenceFor ? t.why.founded(row.evidenceFor) : '' };
    // A habit the app would ask about first (is the afternoon coffee shared?): the same swap, as a preview.
    if (row?.clearWhen.includes('UNLOVED_HABIT')) return { ...base, status: 'adjust', why: because ?? t.why.UNLOVED_HABIT };
    if (ifNotFelt.decisions.some((d) => d.stackItemId === s.id && d.kind === 'clear' && d.reason === 'NOT_FELT'))
      return { ...base, status: 'look', why: because ?? t.why.mixed };
    return { ...base, status: 'stays', why: '' };
  });
  return { items, back: items.filter((i) => i.status === 'go').reduce((s, i) => s + i.monthly, 0) };
}

/** A swap that only names the same thing again ("a basic multivitamin") isn't one. */
function usefulInstead(instead: string | undefined, shortName: string | undefined): string | undefined {
  if (!instead) return undefined;
  return shortName && instead.toLowerCase().includes(shortName.toLowerCase()) ? undefined : instead;
}
