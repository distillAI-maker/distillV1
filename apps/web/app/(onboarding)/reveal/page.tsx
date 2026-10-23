import type { Metadata } from 'next';
import { Reveal } from './reveal';

export const metadata: Metadata = { title: 'Your Ritual, first draft' };

// Claude's version of the first Ritual can take up to a minute when it's on.
export const maxDuration = 90;

export default function RevealPage() {
  return <Reveal />;
}
