import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { env, supabaseConfigured } from '../env';

/** A Supabase client bound to the request's cookies. Null when the project is not configured. */
export async function supabaseServer() {
  if (!supabaseConfigured) return null;
  const store = await cookies();
  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) store.set(name, value, options);
        } catch {
          // Server components cannot set cookies; the proxy refreshes the session instead.
        }
      },
    },
  });
}

export async function currentUser() {
  const client = await supabaseServer();
  if (!client) return null;
  const { data } = await client.auth.getUser();
  return data.user ?? null;
}
