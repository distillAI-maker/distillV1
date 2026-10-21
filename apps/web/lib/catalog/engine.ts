import { buildCatalogView, catalogV4Schema, type CatalogView, type V4Item } from '@distill/catalog';
import raw from '../../../../data/catalog-v4.json';
import { catalog } from './server';

/**
 * The catalog the engine reads: a V4 row once Ishan sets it live, and V3 for everything else, as
 * unknown evidence. An evaluation run sets ENGINE_CATALOG_STATUSES=live,reviewed to also read the
 * rows whose sources Claude checked. Server only.
 */
export const catalogV4 = catalogV4Schema.parse(raw);

const STATUSES: readonly V4Item['status'][] = ['live', 'reviewed', 'draft'];
const views = new Map<string, CatalogView>();

export function engineCatalog(setting = process.env.ENGINE_CATALOG_STATUSES): CatalogView {
  const wanted = (setting ?? 'live')
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is V4Item['status'] => (STATUSES as readonly string[]).includes(s));
  const statuses = wanted.length ? wanted : (['live'] as const);
  const key = [...statuses].sort().join(',');
  let view = views.get(key);
  if (!view) views.set(key, (view = buildCatalogView(catalogV4, catalog, { statuses })));
  return view;
}
