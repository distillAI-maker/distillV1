import type { Metadata } from 'next';
import { catalog } from '../../../lib/catalog/server';
import { buildIndex } from '../../../lib/search/index';
import { StackForm } from './stack-form';

export const metadata: Metadata = { title: 'Your stack' };

export default function StackPage() {
  // Built once at render; about 25 KB of names, categories, costs and aliases.
  const index = buildIndex(catalog);
  return <StackForm index={index} />;
}
