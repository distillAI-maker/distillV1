import { mkdir, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { createDemoUsers, demoView } from '@distill/sim';
import { seedDemoDatabase } from '@distill/sim/local';
const args = process.argv.slice(2);
if (
  args.some((arg) => !/^--as-of=\d{4}-\d{2}-\d{2}$|^--seed=\d+$/.test(arg)) ||
  new Set(args.map((arg) => arg.split('=')[0])).size !== args.length
)
  throw new Error('Use --as-of=YYYY-MM-DD and/or --seed=UINT32');
const asOf =
  args.find((arg) => arg.startsWith('--as-of='))?.slice(8) ??
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
const seed = Number(args.find((arg) => arg.startsWith('--seed='))?.slice(7) ?? 20261003);
const users = createDemoUsers(asOf, seed);
await mkdir('.local', { recursive: true });
const pg = new PGlite(resolve('.local/demo-db'));
try {
  const counts = await seedDemoDatabase(pg, users);
  const file = resolve('.local/demo-users.json'),
    temporary = `${file}.tmp`;
  await writeFile(
    temporary,
    JSON.stringify(
      { version: 1, synthetic: true, asOf, seed, users: users.map(demoView) },
      null,
      2,
    ) + '\n',
  );
  await rename(temporary, file);
  console.log(
    `Seeded ${counts.users} local demo users and ${counts.nights} nights in .local/demo-db; API fixtures in .local/demo-users.json.`,
  );
  for (const user of users)
    console.log(
      `${user.name} (${user.userId}): ${user.analysis.verdict}; ${user.person.history.length} nights`,
    );
} finally {
  await pg.close();
}
