import type { Metadata } from 'next';
import { supabaseConfigured } from '../../../lib/env';
import { Invitation } from './invitation';

export const metadata: Metadata = { title: 'A private invitation' };

export default function InvitationPage() {
  return <Invitation accounts={supabaseConfigured} />;
}
