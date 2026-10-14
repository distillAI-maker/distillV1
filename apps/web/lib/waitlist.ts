import { env } from './env';

/**
 * The Founding 100 waitlist, shared with the landing page (public/assets/js/join.js): the same
 * Supabase `signups` table, which only allows inserts for the publishable key. That key is meant to
 * be public; the app's own Supabase settings win when they are set.
 */
const WAITLIST = {
  url: env.supabaseUrl || 'https://hzwiikkttligpmkvondy.supabase.co',
  key: env.supabaseAnonKey || 'sb_publishable_LnnDGCp21cdBGXzoBx-yZQ_MDoWAubE',
};

/** Adds an email to the waitlist, tagged `app` or `app-<src>`. True when it's on the list. */
export async function joinWaitlist(email: string): Promise<boolean> {
  let source = 'app';
  try {
    const src = localStorage.getItem('distill.source');
    if (src) source = `app-${src}`;
  } catch {
    // No storage: the plain tag will do.
  }
  try {
    const res = await fetch(`${WAITLIST.url}/rest/v1/signups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: WAITLIST.key, Prefer: 'return=minimal' },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        wearable: null,
        source,
        user_agent: navigator.userAgent.slice(0, 400),
      }),
    });
    // 409: already on the list.
    return res.ok || res.status === 409;
  } catch {
    return false;
  }
}
