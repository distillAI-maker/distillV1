import type { Metadata } from 'next';
import { catalog } from '../../../lib/catalog/server';
import { buildIndex } from '../../../lib/search/index';
import { YoursForm } from './yours-form';

export const metadata: Metadata = { title: 'What makes you, you' };

export default function YoursPage() {
  // Just the names, so their list reads as they know it.
  const names = Object.fromEntries(buildIndex(catalog).map((e) => [e.key, e.name]));
  return <YoursForm names={names} />;
}
