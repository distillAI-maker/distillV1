import type { Metadata } from 'next';
import { ConnectForm } from './connect-form';

export const metadata: Metadata = { title: 'Connect' };

export default function ConnectPage() {
  return <ConnectForm />;
}
