'use client';

import { createBrowserClient } from '@supabase/ssr';
import { env, supabaseConfigured } from '../env';

let client: ReturnType<typeof createBrowserClient> | null = null;

/** The browser client, created once. Null when the project is not configured. */
export function supabaseBrowser() {
  if (!supabaseConfigured) return null;
  client ??= createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
  return client;
}
