import type { Metadata } from 'next';
import { RitualPreview } from '../ritual-today';

export const metadata: Metadata = { title: 'Your Ritual' };

export default function PreviewPage() {
  return <RitualPreview />;
}
