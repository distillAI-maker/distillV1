import catalog from '../../../../data/catalog.json' with { type: 'json' };
import type { Catalog } from '@distill/catalog';
import { immutable } from '../experiment/utils.js';
import { toneLint } from '../tone.js';

export const templateNames = {
  kept: 'Tier 1, kept',
  dropped: 'Tier 1, dropped',
  inconclusive: 'Tier 1, inconclusive',
  hypothesis: 'Tier 1, day-one hypothesis from history',
  observe: 'Tier 1, observe-only (morning after)',
  slow: "Tier 1, slow (can't run yet)",
  gated: 'Tier 3, effect too small to see (new in v3)',
  dose: 'Tier 2, dose too low',
  form: 'Tier 2, form not absorbed',
  noEvidence: 'Tier 2, tested and found nothing',
  noMechanism: 'Tier 2, no way it could work',
  duplicate: 'Tier 2, duplicate',
  rating: 'Tier 3, with a daily rating offered',
  keep: 'Tier 3, keep (strong evidence)',
  noGoal: "Tier 3, can't test (no specific goal)",
  free: 'Tier 3, free and harmless',
  protected: 'Protected',
} as const;
export type TemplateId = keyof typeof templateNames;
export type SourceOrigin =
  | 'influencer'
  | 'online'
  | 'friend'
  | 'podcast'
  | 'ad'
  | "don't remember"
  | 'other'
  | 'doctor'
  | 'blood test';
export interface TemplateSlots {
  kept: { item: string; number: string; change: string; swing: string };
  dropped: {
    item: string;
    number: string;
    change: string;
    swing: string;
    months: string;
    source_clause?: SourceOrigin;
    cost: string;
  };
  inconclusive: { item: string; number: string; change: string; swing: string; cost: string };
  hypothesis: {
    item: string;
    n_on: string;
    n_off: string;
    months: string;
    'did it': string;
    number: string;
    change: string;
    'better/worse': 'better' | 'worse';
  };
  observe: { what: string; number: string; change: string; awake: string; remaining: string };
  slow: { item: string; evidence: string };
  gated: { hook: string; fraction: string };
  dose: { item: string; dose: string; threshold: string; cost: string };
  form: { item: string; form: string; cost: string };
  noEvidence: { item: string; months: string; source_clause?: SourceOrigin; cost: string };
  noMechanism: { item: string; cost: string };
  duplicate: { item: string; other: string; cost: string };
  rating: { item: string; annual: string; evidence: string; goal: string; weeks: string };
  keep: { item: string };
  noGoal: { item: string; annual: string };
  free: { item: string };
  protected: { item: string };
}
const sourceClauses: Readonly<Partial<Record<SourceOrigin, string>>> = {
  influencer: ', from something you saw online',
  online: ', from something you saw online',
  friend: ", on a friend's word",
  podcast: ', after a podcast',
  ad: ', from an ad',
  "don't remember": ", and you don't remember why, which is its own kind of answer",
  other: '',
};
export function sourceClause(source?: SourceOrigin): string {
  if (source === undefined) return '';
  if (source === 'doctor' || source === 'blood test')
    throw new Error('Clinician and blood-test sources are Protected');
  if (!Object.hasOwn(sourceClauses, source)) throw new Error('Unknown item source');
  return sourceClauses[source]!;
}
export interface RenderedTemplate {
  readonly templateId: TemplateId;
  readonly templateName: string;
  readonly source: { readonly sheet: string; readonly row: number };
  readonly text: string;
  readonly wordCount: number;
  readonly unverified: boolean;
}
export class VerdictTextError extends Error {
  constructor(
    readonly code: 'MISSING_VALUE' | 'EXTRA_VALUE' | 'INVALID_VALUE' | 'TONE',
    message: string,
  ) {
    super(message);
    this.name = 'VerdictTextError';
  }
}
export function checkedText(text: string, rules: Catalog['toneRules'], gated = false): string {
  if (/[{}]/u.test(text))
    throw new VerdictTextError('INVALID_VALUE', 'Unresolved or nested placeholder');
  const issues = toneLint(text, rules, { gated });
  if (issues.length)
    throw new VerdictTextError(
      'TONE',
      issues.map((issue) => `${issue.code}: ${issue.detail}`).join('; '),
    );
  return text;
}
export function createVerdictRenderer(source: Pick<Catalog, 'verdictTemplates' | 'toneRules'>) {
  // Capture a private snapshot: a caller cannot alter copy or tone rules after creation.
  const snapshot = immutable(structuredClone(source));
  const templates = new Map(
    Object.entries(templateNames).map(([id, name]) => {
      const matches = snapshot.verdictTemplates.filter((template) => template.name === name);
      if (matches.length !== 1) throw new Error(`Expected one source template: ${name}`);
      return [id, matches[0]!] as const;
    }),
  );
  return {
    render<K extends TemplateId>(
      id: K,
      values: TemplateSlots[K],
      options: { unverified?: boolean } = {},
    ): RenderedTemplate {
      const template = templates.get(id);
      if (!template) throw new Error('Unknown verdict template');
      if (!values || typeof values !== 'object' || Array.isArray(values))
        throw new VerdictTextError('INVALID_VALUE', 'Expected named placeholder values');
      const entries = Object.entries(values);
      for (const [key] of entries)
        if (!template.placeholders.includes(key))
          throw new VerdictTextError('EXTRA_VALUE', `Unexpected value {${key}}`);
      const replacements: Record<string, string> = {};
      for (const key of template.placeholders) {
        const value = Object.hasOwn(values, key)
          ? (values as Record<string, unknown>)[key]
          : undefined;
        if (key === 'source_clause') {
          replacements[key] = sourceClause(value as SourceOrigin | undefined);
          continue;
        }
        if (value === undefined || value === null)
          throw new VerdictTextError('MISSING_VALUE', `Missing value {${key}}`);
        if (typeof value !== 'string' || !value.trim() || /[{}\p{Cc}]/u.test(value))
          throw new VerdictTextError('INVALID_VALUE', `Invalid value {${key}}`);
        replacements[key] = value.trim();
      }
      const text = checkedText(
        template.template.replace(/\{([^{}]+)\}/gu, (_, key: string) => replacements[key]!),
        snapshot.toneRules,
        id === 'gated',
      );
      return immutable({
        templateId: id,
        templateName: template.name,
        source: template.source,
        text,
        wordCount: text.trim().split(/\s+/u).length,
        unverified: options.unverified ?? false,
      });
    },
  };
}
export const verdictRenderer = createVerdictRenderer(catalog as unknown as Catalog);
export const renderTemplate = verdictRenderer.render;
