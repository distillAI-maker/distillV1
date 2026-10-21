import type { Metadata } from 'next';
import { CompanionScreen } from './companion-screen';

export const metadata: Metadata = { title: 'Distill' };

export default function CompanionPage() {
  return <CompanionScreen />;
}
