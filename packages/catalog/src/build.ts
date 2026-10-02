import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readCatalog } from './ingest.js';

const workbook = fileURLToPath(new URL('../../../data/Routing-Table_V3.xlsx', import.meta.url));
const output = fileURLToPath(new URL('../../../data/catalog.json', import.meta.url));
// Paths are relative to this file, never the caller's working directory.
const catalog = readCatalog(workbook);
const json = JSON.stringify(catalog, null, 2) + '\n';
if (process.argv.includes('--check')) {
  if (readFileSync(output, 'utf8') !== json)
    throw new Error('data/catalog.json is stale. Run pnpm catalog:build and commit the result.');
} else {
  writeFileSync(output, json);
}
console.log(
  `Catalog validated: ${catalog.items.length} items, ${catalog.overlapGroups.length} overlap groups, ${catalog.items.filter((i) => i.unverified).length} unverified rows.`,
);
