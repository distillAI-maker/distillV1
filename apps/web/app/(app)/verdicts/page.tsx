import type { Metadata } from 'next';
import { VerdictsList } from './verdicts-list';

export const metadata: Metadata = { title: 'Verdicts' };

export default function VerdictsPage() {
  return <VerdictsList />;
}
