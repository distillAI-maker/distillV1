import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { readCatalog } from '../../catalog/src/ingest.js';
import { toneLint } from './tone.js';

const catalog = readCatalog(
  fileURLToPath(new URL('../../../data/Routing-Table_V3.xlsx', import.meta.url)),
);
const rules = catalog.toneRules;
describe('toneLint', () => {
  it.each(rules.bannedPhrases)('rejects the banned phrase "%s" as a whole phrase', (word) =>
    expect(toneLint(`You ${word}.`, rules).some((i) => i.code === 'BANNED_PHRASE')).toBe(true),
  );
  it('handles case, whitespace, curly apostrophes and punctuation', () =>
    expect(toneLint('Your call. You SHOULD   HAVE KNOWN!', rules).map((i) => i.code)).toContain(
      'EXCLAMATION',
    ));
  it('does not match forbidden substrings inside unrelated words', () =>
    expect(toneLint('Your costume is yours.', rules)).toEqual([]));
  it('enforces under 60 words and the gated 60-word exception', () => {
    const sixty = Array(60).fill('you').join(' ');
    expect(toneLint(sixty, rules).some((i) => i.code === 'WORD_LIMIT')).toBe(true);
    expect(toneLint(sixty, rules, { gated: true })).toEqual([]);
    expect(
      toneLint(sixty + ' you', rules, { gated: true }).some((i) => i.code === 'WORD_LIMIT'),
    ).toBe(true);
  });
  it('rejects switching from the reader to the third person', () =>
    expect(toneLint('The user can see their number.', rules).map((i) => i.code)).toContain(
      'THIRD_PERSON',
    ));
  it.each(catalog.verdictTemplates)('lints the complete source template: $name', (t) => {
    expect(
      toneLint(t.template, rules, {
        template: true,
        gated: t.name.startsWith('Tier 3, effect too small'),
      }),
    ).toEqual([]);
  });
  it('lints filled text again because long substitutions can exceed the word limit', () => {
    const t = catalog.verdictTemplates[0]!;
    const filled = t.template.replace('{item}', Array(60).fill('walking').join(' '));
    expect(toneLint(filled, rules).some((i) => i.code === 'WORD_LIMIT')).toBe(true);
  });
});
