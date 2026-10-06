import type { TemplateId, TemplateSlots } from './templates.js';
/** Editorial fixtures for lint/snapshots, not observed user histories or new evidence claims. */
type Example = { [K in TemplateId]: { id: K; values: TemplateSlots[K] } }[TemplateId];
export const verdictExamples: readonly Example[] = [
  {
    id: 'kept',
    values: { item: 'Morning walk', number: 'your overnight HRV', change: '6 ms', swing: '3%' },
  },
  {
    id: 'dropped',
    values: {
      item: 'Late training',
      number: 'your total sleep',
      change: '41 minutes',
      swing: '30 minutes',
      months: '14',
      source_clause: 'friend',
      cost: '$25',
    },
  },
  {
    id: 'inconclusive',
    values: {
      item: 'Melatonin',
      number: 'your time to fall asleep',
      change: '3 minutes less',
      swing: '10 minutes',
      cost: '$10',
    },
  },
  {
    id: 'hypothesis',
    values: {
      item: 'Late training',
      n_on: '22',
      n_off: '140',
      months: '6',
      'did it': 'trained late',
      number: 'your total sleep',
      change: '34 minutes',
      'better/worse': 'worse',
    },
  },
  {
    id: 'observe',
    values: { what: 'drinking', number: 'Your HRV', change: '19 ms', awake: '34', remaining: '12' },
  },
  {
    id: 'slow',
    values: {
      item: 'Ashwagandha',
      evidence: 'people reported less stress after six to eight weeks',
    },
  },
  { id: 'gated', values: { hook: 'Magnesium glycinate.', fraction: 'a third' } },
  {
    id: 'dose',
    values: {
      item: 'Magnesium',
      dose: '120 mg elemental',
      threshold: '200 mg elemental',
      cost: '$22',
    },
  },
  { id: 'form', values: { item: 'Magnesium', form: 'oxide', cost: '$8' } },
  {
    id: 'noEvidence',
    values: { item: 'Ginkgo', months: '24', source_clause: 'podcast', cost: '$15' },
  },
  { id: 'noMechanism', values: { item: 'Salt lamp', cost: '$12' } },
  { id: 'duplicate', values: { item: 'Oura', other: 'WHOOP', cost: '$30' } },
  {
    id: 'rating',
    values: {
      item: 'Collagen',
      annual: '$420',
      evidence: 'people reported small skin changes after eight weeks',
      goal: 'skin',
      weeks: '8',
    },
  },
  { id: 'keep', values: { item: 'Creatine' } },
  { id: 'noGoal', values: { item: 'Multivitamin', annual: '$180' } },
  { id: 'free', values: { item: 'Gratitude journal' } },
  { id: 'protected', values: { item: 'Iron' } },
];
