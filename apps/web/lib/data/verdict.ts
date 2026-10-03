import type { VerdictTemplate } from '@distill/catalog';
import type { Origin } from '../progress/types';

/**
 * Fills a Verdict Templates sheet template with values. Placeholder substitution only; no prose
 * is written here. Rounding follows SPEC section 10: minutes and ms as integers.
 */

/** The "where it came from" clauses (Verdict Templates, final row), keyed by the app's origin chips. */
export const sourceClauses: Record<Origin, string> = {
  online: ', from something you saw online',
  friend: ", on a friend's word",
  podcast: ', after a podcast',
  other: '',
  doctor: '',
  'blood test': '',
};

export interface FillValues {
  [key: string]: string | number | undefined;
}

export function fillTemplate(template: VerdictTemplate, values: FillValues): string {
  let text = template.template;
  // A $0 item: the template's own example (training after 7pm) omits the money clause.
  // OPEN_QUESTIONS: ZERO_COST_DROPPED.
  if (values.cost === '$0' || values.cost === 0) text = text.replace(/, and \{cost\} a month back/, '');
  for (const p of template.placeholders) {
    const v = values[p];
    if (v === undefined) throw new Error(`Missing placeholder {${p}} for ${template.name}`);
    text = text.split(`{${p}}`).join(String(v));
  }
  if (/\{[^}]+\}/.test(text)) throw new Error(`Unfilled placeholder in ${template.name}: ${text}`);
  return text;
}

export function minutes(n: number): string {
  const v = Math.abs(Math.round(n));
  return `${v} ${v === 1 ? 'minute' : 'minutes'}`;
}

export function dollars(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}
