import type { Metadata } from 'next';
import { Invitation } from './invitation';

export const metadata: Metadata = { title: 'A private invitation' };

export default function InvitationPage() {
  return <Invitation />;
}
