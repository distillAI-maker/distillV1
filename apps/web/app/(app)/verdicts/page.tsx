import type { Metadata } from 'next';
import { VerdictsList } from './verdicts-list';

export const metadata: Metadata = { title: 'Readings' };

export default function VerdictsPage() {
  return <VerdictsList />;
}
