import type { Catalog, Item } from '@distill/catalog';
import { handAliases } from './aliases';
import { deriveAliases } from './match';
import type { IndexEntry } from './match';

/** The slim index the browser searches: about 25 KB for 210 items. Built on the server. */
export function buildIndex(catalog: Pick<Catalog, 'items'>): IndexEntry[] {
  return catalog.items.map(entryFor);
}

export function entryFor(item: Item): IndexEntry {
  const aliases = new Set<string>([...deriveAliases(item.name), ...(handAliases[item.key] ?? [])]);
  return {
    key: item.key,
    name: item.name,
    category: item.category,
    kind: item.kind,
    cost: item.monthlyCost,
    aliases: [...aliases],
  };
}
