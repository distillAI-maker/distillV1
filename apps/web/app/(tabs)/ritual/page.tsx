import type { Metadata } from 'next';
import { RitualScreen } from './ritual-screen';

export const metadata: Metadata = { title: 'Your Ritual' };

export default function RitualPage() {
  return <RitualScreen />;
}
