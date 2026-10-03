import { toneLint } from '@distill/engine';
import { describe, expect, it } from 'vitest';
import { catalog } from './catalog/server';
import { allStrings } from './copy';

describe('app copy', () => {
  const strings = allStrings();
  it('has strings to check', () => {
    expect(strings.length).toBeGreaterThan(20);
  });
  it.each(strings)('%s passes toneLint', (_path, text) => {
    expect(toneLint(text, catalog.toneRules)).toEqual([]);
  });
  it('never uses an exclamation mark or a score about the person', () => {
    for (const [, text] of strings) {
      expect(text).not.toMatch(/!/);
      expect(text.toLowerCase()).not.toMatch(/\b(score|failed|fail)\b/);
    }
  });
});
