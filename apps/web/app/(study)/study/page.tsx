import type { Metadata } from 'next';
import { catalog } from '../../../lib/catalog/server';
import { buildIndex } from '../../../lib/search/index';
import { Study } from './study';

export const metadata: Metadata = { title: 'Private study' };

export default function StudyPage() {
  // Just the names, so their list reads as they know it.
  const names = Object.fromEntries(buildIndex(catalog).map((e) => [e.key, e.name]));
  return <Study names={names} />;
}
