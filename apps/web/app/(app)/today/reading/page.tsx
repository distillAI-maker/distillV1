import type { Metadata } from 'next';
import { Today } from '../today';

export const metadata: Metadata = { title: 'Your readings' };

/** The experiment check-in, for someone running a reading alongside their Ritual. */
export default function ReadingPage() {
  return <Today />;
}
