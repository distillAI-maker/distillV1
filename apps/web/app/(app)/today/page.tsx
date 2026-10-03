import type { Metadata } from 'next';
import { Today } from './today';

export const metadata: Metadata = { title: 'Today' };

export default function TodayPage() {
  return <Today />;
}
