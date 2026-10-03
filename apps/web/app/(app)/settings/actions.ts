'use server';

import { createClient } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';
import { supabaseConfigured } from '../../../lib/env';
import { supabaseServer } from '../../../lib/supabase/server';

export async function signOut() {
  const client = await supabaseServer();
  if (client) await client.auth.signOut();
  redirect('/');
}

/**
 * Deletes the signed-in person's account and every Phase 8 row (the tables cascade from
 * auth.users). Phase 2's DELETE /api/account also clears Storage; once merged, call that
 * instead (OPEN_QUESTIONS: DELETE_PATH). Without a configured project there is nothing on a
 * server to delete; the browser clears its own copy.
 */
export async function deleteEverything(): Promise<{ status: 'deleted' | 'nothing' | 'failed' }> {
  if (!supabaseConfigured) return { status: 'nothing' };
  const client = await supabaseServer();
  const user = client ? (await client.auth.getUser()).data.user : null;
  if (!client || !user) return { status: 'nothing' };
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { status: 'failed' };
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await admin.auth.admin.deleteUser(user.id, false);
  if (error) return { status: 'failed' };
  await client.auth.signOut();
  return { status: 'deleted' };
}
