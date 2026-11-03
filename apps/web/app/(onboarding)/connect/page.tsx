import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { RITUAL_HOME, wearablesOn } from '../../../lib/steps';
import { ConnectForm } from './connect-form';

export const metadata: Metadata = { title: 'Connect' };

export default function ConnectPage() {
  // Kept for when wearables can connect; until then nobody lands here.
  if (!wearablesOn()) redirect(RITUAL_HOME);
  return <ConnectForm />;
}
