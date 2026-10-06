'use client';
import { supabaseBrowser } from './supabase/client';

export async function api<T>(
  path: string,
  init: RequestInit = {},
  expectedUserId?: string,
): Promise<T> {
  const client = supabaseBrowser();
  const session = client ? (await client.auth.getSession()).data.session : null;
  if (expectedUserId && session?.user.id !== expectedUserId)
    throw new Error('authentication_changed');
  const token = session?.access_token;
  const headers = new Headers(init.headers);
  if (token) headers.set('authorization', `Bearer ${token}`);
  if (init.body) headers.set('content-type', 'application/json');
  const response = await fetch(path, { ...init, headers, cache: 'no-store' });
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}
