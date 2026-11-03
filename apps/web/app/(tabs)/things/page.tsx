import type { Metadata } from 'next';
import { ThingsTab } from './things-tab';

export const metadata: Metadata = { title: 'Your things' };

export default function ThingsPage() {
  return <ThingsTab />;
}
