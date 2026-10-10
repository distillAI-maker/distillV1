import type { Metadata } from 'next';
import { StandardHome } from './standard-home';

export const metadata: Metadata = { title: 'Your Standard' };

export default function HomePage() {
  return <StandardHome />;
}
