import type { Metadata } from 'next';
import { currentUser } from '../../../lib/supabase/server';
import { SettingsTab } from './settings-tab';

export const metadata: Metadata = { title: 'Settings' };
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const user = await currentUser();
  return <SettingsTab email={user?.email ?? null} />;
}
