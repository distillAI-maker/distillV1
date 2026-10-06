'use server';

import { getService } from '../../../src/server/service';
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
  try {
    await getService().deleteAccount({ id: user.id, email: user.email });
  } catch {
    return { status: 'failed' };
  }
  await client.auth.signOut();
  return { status: 'deleted' };
}
