import type { ToneRules } from '@distill/catalog';
import { toneLint } from '../tone.js';

/**
 * What a line may never say. Runs on every string a person reads, from any step; a failing line is
 * dropped, never shown, and the fallback speaks instead.
 */

export interface LineIssue {
  readonly code:
    | 'TONE'
    | 'RITUAL_WORD'
    | 'NUMBER'
    | 'HEALTH_NUMBER'
    | 'CLAIM'
    | 'NAME'
    | 'EMOJI'
    | 'EMPTY';
  readonly detail: string;
}

export interface LineContext {
  readonly toneRules: Pick<ToneRules, 'bannedPhrases' | 'maxWordsExclusive' | 'gatedMaxWords'>;
  /** Numbers that appear in their own input: times, money, distances they told us. */
  readonly allowedNumbers: readonly string[];
  /** Names of people and places in their life, and their own words for things. */
  readonly names: readonly string[];
  /** Word limit for this kind of line. */
  readonly maxWords?: number;
}

/** "a ritual", "one ritual", "rituals": the Ritual is the whole system, never one habit. */
export const RITUAL_WORD = /\b(a|one) ritual\b|\brituals\b/i;
const CLAIMS =
  /\b(cures?|cured|treats?|treated|treatment|prevents?|prevented|clinically|proven|reduces? (?:the )?risk|diagnos\w*|heals?|disease|disorder)\b/i;
const HEALTH_WORDS =
  /\b(sleep|slept|hrv|heart rate|bpm|score|readiness|percent|%|study|studies|research|trial|swing|deep|rem|recovery|calories|kcal|mg|mcg|iu)\b/i;
const EMOJI = /\p{Extended_Pictographic}/u;

/** A number standing on its own: "10", "7:30", "$90", "3.5", never the 1 in "AG1". */
const NUMBER = /(?<![\p{L}\d])\$?\d+(?:[.:]\d+)?(?!\p{L})/gu;

/** Every number in a text, as written. */
export function numbersIn(text: string): string[] {
  return [...text.matchAll(NUMBER)].map((m) => m[0]);
}

/** Numbers the person used, so a reply may repeat them ("see you at 10", "$90 a month back"). */
export function allowedNumbersFrom(...texts: readonly string[]): string[] {
  const out = new Set<string>();
  for (const t of texts)
    for (const n of numbersIn(t)) {
      out.add(n);
      out.add(n.replace(/^\$/, ''));
      const clock = /^(\d{1,2}):(\d{2})$/.exec(n);
      if (clock) out.add(String(Number(clock[1])));
    }
  return [...out];
}

const STOP_NAMES = new Set([
  'Distill',
  'Ritual',
  'Saturday',
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
  'Tonight',
  'Today',
  'Tomorrow',
]);

export function checkLine(text: string, ctx: LineContext): LineIssue[] {
  const issues: LineIssue[] = [];
  const line = text.trim();
  if (!line) return [{ code: 'EMPTY', detail: 'Nothing to say' }];
  const maxWords = ctx.maxWords ?? ctx.toneRules.maxWordsExclusive - 1;
  for (const issue of toneLint(line, ctx.toneRules))
    if (issue.code !== 'WORD_LIMIT') issues.push({ code: 'TONE', detail: `${issue.code}: ${issue.detail}` });
  const words = line.split(/\s+/u).filter(Boolean).length;
  if (words > maxWords) issues.push({ code: 'TONE', detail: `WORD_LIMIT: ${words} words; maximum ${maxWords}` });
  if (RITUAL_WORD.test(line)) issues.push({ code: 'RITUAL_WORD', detail: 'Say "your Ritual" or the habit by name' });
  if (CLAIMS.test(line)) issues.push({ code: 'CLAIM', detail: (CLAIMS.exec(line) ?? [''])[0] });
  if (EMOJI.test(line)) issues.push({ code: 'EMOJI', detail: 'No emoji' });
  // Numbers in their own words, and in the names of things in their life ("SPF 30"), are theirs.
  const allowed = new Set([...ctx.allowedNumbers, ...allowedNumbersFrom(...ctx.names)]);
  for (const m of line.matchAll(NUMBER)) {
    const n = m[0];
    const around = line.slice(Math.max(0, m.index! - 24), m.index! + n.length + 24);
    if (HEALTH_WORDS.test(around)) issues.push({ code: 'HEALTH_NUMBER', detail: `${n} next to a health word` });
    else if (!allowed.has(n) && !allowed.has(n.replace(/^\$/, '')))
      issues.push({ code: 'NUMBER', detail: `${n} isn't one of theirs` });
  }
  // Someone named after "with", "and", "for", "call" or "text" must be someone in their life.
  const known = new Set(ctx.names.flatMap((n) => n.split(/\s+/)).map((n) => n.toLowerCase()));
  for (const m of line.matchAll(/\b(?:with|and|for|call|text|see|meet)\s+([A-Z][\p{L}'-]+)/gu)) {
    const name = m[1]!;
    if (STOP_NAMES.has(name) || known.has(name.toLowerCase())) continue;
    issues.push({ code: 'NAME', detail: `${name} isn't someone they told us about` });
  }
  return issues;
}

export const fits = (text: string, ctx: LineContext) => checkLine(text, ctx).length === 0;
