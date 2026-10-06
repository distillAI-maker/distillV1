import type { Metadata } from 'next';
import { Heard } from './heard';

export const metadata: Metadata = { title: "Here's what we heard" };

export default function HeardPage() {
  return <Heard />;
}
