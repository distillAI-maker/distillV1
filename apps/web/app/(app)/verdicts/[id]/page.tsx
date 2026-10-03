import type { Metadata } from 'next';
import { VerdictView } from '../verdict-view';

export const metadata: Metadata = { title: 'Verdict' };

export default async function VerdictPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <VerdictView id={id} />;
}
