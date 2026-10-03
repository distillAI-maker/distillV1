import type { Metadata } from 'next';
import { currentUser } from '../../../lib/supabase/server';
import { SettingsView } from './settings-view';

export const metadata: Metadata = { title: 'Settings' };
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const user = await currentUser();
  return <SettingsView email={user?.email ?? null} />;
}
