import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readCatalog } from './ingest.js';
import { readCatalogV4 } from './ingest-v4.js';
import { coverageLine } from './validate-v4.js';

const file = (p: string) => fileURLToPath(new URL(`../../../${p}`, import.meta.url));
const check = process.argv.includes('--check');

/** Writes generated JSON, or with --check fails when the committed file is stale. */
function emit(path: string, data: unknown, rebuild: string): void {
  const json = JSON.stringify(data, null, 2) + '\n';
  if (check) {
    if (!existsSync(path) || readFileSync(path, 'utf8') !== json)
      throw new Error(`${path.split('/').slice(-2).join('/')} is stale. Run ${rebuild} and commit the result.`);
  } else writeFileSync(path, json);
}

// V3: the original table, still read by the old experiment code and as the fallback for V4.
// Paths are relative to this file, never the caller's working directory.
const catalog = readCatalog(file('data/Routing-Table_V3.xlsx'));
emit(file('data/catalog.json'), catalog, 'pnpm catalog:build');
console.log(
  `Catalog validated: ${catalog.items.length} items, ${catalog.overlapGroups.length} overlap groups, ${catalog.items.filter((i) => i.unverified).length} unverified rows.`,
);

// V4: the rebuilt table (docs/ROUTING-V4.md). Only reviewed rows can go live.
const v4Path = file('data/Routing-Table_V4.xlsx');
if (existsSync(v4Path)) {
  const v4 = readCatalogV4(v4Path);
  emit(file('data/catalog-v4.json'), v4, 'pnpm catalog:build');
  console.log(coverageLine(v4, catalog.items.length));
}
