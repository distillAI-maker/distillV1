import type { Metadata } from 'next';
import { RitualView } from './ritual-view';

export const metadata: Metadata = { title: 'Your ritual' };

export default async function RitualPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RitualView id={id} />;
}
