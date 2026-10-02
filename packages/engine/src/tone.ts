import type { ToneRules } from '@distill/catalog';

export interface ToneIssue {
  code: 'BANNED_PHRASE' | 'EXCLAMATION' | 'WORD_LIMIT' | 'THIRD_PERSON';
  detail: string;
}
/** Mechanical checks only. Active voice, effort-first ordering and medical-claim meaning also require editorial review. */
export function toneLint(
  text: string,
  rules: Pick<ToneRules, 'bannedPhrases' | 'maxWordsExclusive' | 'gatedMaxWords'>,
  options: { gated?: boolean; template?: boolean } = {},
): ToneIssue[] {
  const issues: ToneIssue[] = [];
  const content = options.template ? text.replace(/\{[^{}]+\}/g, 'value') : text;
  const normalized = content
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, ' ');
  for (const phrase of rules.bannedPhrases) {
    const pattern = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`\\b${pattern}\\b`, 'i').test(normalized))
      issues.push({ code: 'BANNED_PHRASE', detail: phrase });
  }
  if (content.includes('!')) issues.push({ code: 'EXCLAMATION', detail: 'Exclamation mark' });
  const words = content.trim().split(/\s+/u).filter(Boolean).length;
  const limit = options.gated ? rules.gatedMaxWords : rules.maxWordsExclusive - 1;
  if (words > limit)
    issues.push({ code: 'WORD_LIMIT', detail: `${words} words; maximum ${limit}` });
  if (/\b(the user|the person|their|they)\b/i.test(normalized))
    issues.push({ code: 'THIRD_PERSON', detail: 'Address the reader directly' });
  return issues;
}
