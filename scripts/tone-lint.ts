import { fileURLToPath } from 'node:url';
import { readCatalog } from '../packages/catalog/src/ingest.js';
import { toneLint } from '../packages/engine/src/tone.js';

const catalog = readCatalog(
  fileURLToPath(new URL('../data/Routing-Table_V3.xlsx', import.meta.url)),
);
const errors: string[] = [];
for (const template of catalog.verdictTemplates) {
  const issues = toneLint(template.template, catalog.toneRules, {
    template: true,
    gated: template.name.startsWith('Tier 3, effect too small'),
  });
  for (const issue of issues)
    errors.push(`Verdict Templates!B${template.source.row}: ${issue.code}: ${issue.detail}`);
}
if (errors.length) throw new Error(errors.join('\n'));
console.log(
  `Tone checks passed for all ${catalog.verdictTemplates.length} source templates. Generated verdicts will require the same check in Phase 7.`,
);
