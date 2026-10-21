import { describe, expect, it } from 'vitest';
import { personTextProblems } from '@distill/catalog';
import { catalog } from '../catalog/server';
import { exploreBank } from './bank';

describe('the explore bank', () => {
  it('parses, with unique ids and a page for every idea', () => {
    const ids = exploreBank.ideas.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const i of exploreBank.ideas) expect(i.url).toMatch(/^https:\/\//);
  });
  it('speaks to the person in the same voice as everything else', () => {
    for (const i of exploreBank.ideas)
      expect(personTextProblems(i.line, catalog.toneRules.bannedPhrases, 40), i.id).toEqual([]);
  });
  it('shows nothing until the founder certifies it', () => {
    // Drafted ideas start uncertified; flip `certified` only after checking the place yourself.
    expect(exploreBank.ideas.filter((i) => i.certified).every((i) => i.verifiedOn)).toBe(true);
  });
});
