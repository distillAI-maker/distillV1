import type { Metadata } from 'next';
import { YouView } from './you-view';

export const metadata: Metadata = { title: "What we've learned about you" };

export default function YouPage() {
  return <YouView />;
}
