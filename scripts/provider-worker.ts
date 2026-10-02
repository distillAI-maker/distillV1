import { getService } from '../apps/web/src/server/service.js';

// Run with Node's --env-file or process environment. Each invocation drains durable work
// for four minutes; rerun to resume. No personal data or credentials are logged.
const result = await getService().worker.run();
console.log(`Completed ${result.units} provider work units.`);
