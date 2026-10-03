import type { Catalog, Item } from '@distill/catalog';
import raw from '../../../../data/catalog.json';

/**
 * The generated catalog. Import it from server components, route handlers and tests only. It is about a megabyte with the source cells, so
 * nothing here is sent to the browser as is; screens pick the fields they need.
 */
export const catalog = raw as unknown as Catalog;
if (catalog.schemaVersion !== 1) throw new Error('Unexpected catalog schema version');

const byKey = new Map<string, Item>(catalog.items.map((i) => [i.key, i]));
export function itemByKey(key: string): Item | undefined {
  return byKey.get(key);
}
