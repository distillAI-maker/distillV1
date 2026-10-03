import type { Metadata } from 'next';
import { FileView } from './file-view';

export const metadata: Metadata = { title: 'Your file' };

export default function FilePage() {
  return <FileView />;
}
