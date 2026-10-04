import { fileURLToPath } from 'node:url';
import { readCatalog } from '../packages/catalog/src/ingest.js';
import { toneLint } from '../packages/engine/src/tone.js';
import { renderTemplate } from '../packages/engine/src/verdict/index.js';
import { verdictExamples } from '../packages/engine/src/verdict/examples.js';

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
for (const example of verdictExamples) {
  const rendered = renderTemplate(example.id, example.values);
  const issues = toneLint(rendered.text, catalog.toneRules, { gated: example.id === 'gated' });
  if (issues.length) throw new Error(`${example.id}: ${JSON.stringify(issues)}`);
}
console.log(
  `Tone checks passed for ${catalog.verdictTemplates.length} source templates and ${verdictExamples.length} filled examples. Rendering also checks each final string at runtime.`,
);
