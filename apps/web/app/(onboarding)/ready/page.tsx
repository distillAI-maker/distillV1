import type { Metadata } from 'next';
import { Ready } from './ready';

export const metadata: Metadata = { title: 'Ready to let go' };

export default function ReadyPage() {
  return <Ready />;
}
