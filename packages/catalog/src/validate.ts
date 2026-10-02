import { catalogSchema, type Catalog } from './schema.js';

export const PLACEHOLDERS = new Set([
  'item',
  'number',
  'change',
  'swing',
  'months',
  'annual',
  'dose',
  'threshold',
  'other',
  'cost',
  'hook',
  'fraction',
  'source_clause',
  'n_on',
  'did it',
  'better/worse',
  'n_off',
  'what',
  'awake',
  'remaining',
  'evidence',
  'form',
  'goal',
  'weeks',
]);
export function placeholders(template: string): string[] {
  const matches = [...template.matchAll(/\{([^{}]+)\}/g)];
  if (/[{}]/.test(template.replace(/\{[^{}]+\}/g, '')))
    throw new Error('Malformed placeholder braces');
  return [...new Set(matches.map((m) => m[1]!))];
}
function equal(actual: number, expected: number, label: string): void {
  if (actual !== expected)
    throw new Error(`${label}: expected ${expected} from Summary, received ${actual}`);
}
export function validateCatalog(input: unknown): Catalog {
  const c = catalogSchema.parse(input);
  const keys = new Set<string>();
  for (const item of c.items) {
    if (keys.has(item.key)) throw new Error(`Duplicate key: ${item.key}`);
    keys.add(item.key);
    if ((item.tier === 'T2' || item.naturalTier === '2') && !item.dropReason)
      throw new Error(`${item.key}: T2 row has no reason`);
    if (Math.abs(item.annualCost - item.monthlyCost * 12) > 0.005)
      throw new Error(`${item.key}: stale annual cost formula cache`);
  }
  const groups = new Set(c.overlapGroups.map((g) => g.name));
  if (groups.size !== c.overlapGroups.length) throw new Error('Duplicate overlap group');
  for (const group of [
    ...c.overlapGroups,
    ...c.followUpQuestions.map((q) => ({ ...q, name: q.type })),
  ]) {
    for (const key of group.itemKeys)
      if (!keys.has(key)) throw new Error(`${group.name}: unknown item ${key}`);
    if (new Set(group.itemKeys).size !== group.itemKeys.length)
      throw new Error(`${group.name}: duplicate member`);
    equal(group.itemKeys.length, group.declaredCount, `${group.name} membership count`);
  }
  for (const item of c.items)
    for (const group of item.overlapGroups) {
      if (!groups.has(group)) throw new Error(`${item.key}: unknown overlap group ${group}`);
    }
  for (const t of c.verdictTemplates) {
    const found = placeholders(t.template);
    for (const name of found)
      if (!PLACEHOLDERS.has(name)) throw new Error(`${t.name}: unknown placeholder {${name}}`);
    if (JSON.stringify(found) !== JSON.stringify(t.placeholders))
      throw new Error(`${t.name}: placeholder metadata differs from template`);
  }
  const count = (predicate: (item: Catalog['items'][number]) => boolean) =>
    c.items.filter(predicate).length;
  equal(c.items.length, c.summary.total, 'Total items');
  for (const [tier, n] of Object.entries(c.summary.tiers))
    equal(
      count((i) => i.tier === tier),
      n,
      `Tier ${tier}`,
    );
  for (const [tier, n] of Object.entries(c.summary.naturalTiers))
    equal(
      count((i) => i.naturalTier === tier),
      n,
      `Natural tier ${tier}`,
    );
  for (const [reason, n] of Object.entries(c.summary.reasons))
    equal(
      count((i) => i.dropReason === reason),
      n,
      `Reason ${reason}`,
    );
  for (const [grade, n] of Object.entries(c.summary.evidenceGrades))
    equal(
      count((i) => i.evidenceGrade === grade),
      n,
      `Evidence ${grade}`,
    );
  for (const row of c.summary.categories) {
    const items = c.items.filter((i) => i.category === row.name);
    equal(items.length, row.count, `${row.name} count`);
    for (const [field, predicate] of [
      ['naturalT1', (i: Catalog['items'][number]) => i.naturalTier === '1'],
      ['runnableT1', (i: Catalog['items'][number]) => i.tier === 'T1'],
      ['t2', (i: Catalog['items'][number]) => i.naturalTier === '2'],
      ['t3', (i: Catalog['items'][number]) => i.naturalTier === '3'],
      ['protected', (i: Catalog['items'][number]) => i.naturalTier === 'P'],
    ] as const)
      equal(items.filter(predicate).length, row[field], `${row.name} ${field}`);
  }
  equal(
    count((i) => i.unverified),
    c.summary.unverified,
    'Fact-check flags',
  );
  equal(
    count((i) => i.unverified && i.tier === 'T2'),
    c.summary.unverifiedT2,
    'T2 fact-check flags',
  );
  return c;
}
