import type { Metadata } from 'next';
import { Sorted } from './sorted';

export const metadata: Metadata = { title: 'Your real stack' };

export default function SortedPage() {
  return <Sorted />;
}
