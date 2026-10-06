import type { Metadata } from 'next';
import { TheNumber } from './the-number';

export const metadata: Metadata = { title: 'Your number' };

export default function NumberPage() {
  return <TheNumber />;
}
