import type { Metadata } from 'next';
import { Reveal } from './reveal';

export const metadata: Metadata = { title: 'Your Ritual' };

export default function RevealPage() {
  return <Reveal />;
}
