import { readFile, writeFile } from 'node:fs/promises';
import catalog from '../data/catalog.json' with { type: 'json' };
import report from '../data/power-results.json' with { type: 'json' };
import { metricFields } from '../packages/engine/src/experiment/baseline.js';
import { powerGuidance, simulationReferenceProtocol } from '@distill/sim/guidance';

const args = process.argv.slice(2);
if (args.some((arg) => arg !== '--check') || args.length > 1)
  throw new Error('Use --check or no arguments');
const items = catalog.items.map((item) => {
  const metric = metricFields[item.metricText ?? ''];
  const applicable =
    item.speed === 'fast' && item.onDays === 'assign' && metric && item.expectedEffect !== null;
  return {
    key: item.key,
    sourceRow: item.source.row,
    unverified: item.unverified,
    sourceChance: item.chance,
    sourceExpectedEffect: item.expectedEffect,
    original14DayLabel: applicable ? 'low' : null,
    original14DayReason: applicable
      ? 'assignment_resolution_prevents_a_decisive_verdict'
      : 'not_a_supported_randomized_outcome',
    reference42Day: applicable
      ? powerGuidance(item.expectedEffect!, simulationReferenceProtocol, { metric })
      : {
          status: 'unavailable',
          label: null,
          reason: 'requires_a_resolved_fast_randomized_metric_and_effect',
        },
  };
});
const output =
  JSON.stringify(
    {
      version: 1,
      powerSourceHash: report.metadata.sourceHash,
      purpose:
        'Review overlay for source labels; conditional synthetic power, not clinical evidence or a personal forecast',
      routingGate: 0.8,
      referenceProtocol: simulationReferenceProtocol,
      items,
    },
    null,
    2,
  ) + '\n';
if (args.includes('--check')) {
  if ((await readFile('data/power-labels.json', 'utf8')) !== output)
    throw new Error('Power labels are stale; run pnpm sim:labels');
  console.log('Power label overlay is current');
} else {
  await writeFile('data/power-labels.json', output);
  console.log(
    `Wrote ${items.length} source-row comparisons; ${items.filter((item) => item.reference42Day.status === 'estimated').length} scoped empirical labels.`,
  );
}
