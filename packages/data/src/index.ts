import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema.js';
export * from './schema.js';
export * from './repository.js';
export * from './experiments.js';
export { sql } from 'drizzle-orm';
export type { SQL } from 'drizzle-orm';
export function database(url: string) {
  const client = postgres(url, { prepare: false, max: 4, connect_timeout: 10, idle_timeout: 20 });
  return { db: drizzle(client, { schema }), close: () => client.end() };
}
