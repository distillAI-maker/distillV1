import data from '../data/catalog.json' with { type: 'json' };
import { catalogSchema } from '../packages/catalog/src/index.js';
import { assertWorkedExample } from '../packages/engine/src/route/worked-example.js';

try {
  const stack = assertWorkedExample(catalogSchema.parse(data));
  console.log(JSON.stringify(stack.summary, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Worked Example acceptance failed');
  process.exitCode = 1;
}
