import type { Metadata } from 'next';
import { ExploreTab } from './explore-tab';

export const metadata: Metadata = { title: 'Explore' };

export default function ExplorePage() {
  return <ExploreTab />;
}
