import type { Metadata } from 'next';
import { QuestionsFlow } from './questions-flow';

export const metadata: Metadata = { title: 'A few questions' };

export default function QuestionsPage() {
  return <QuestionsFlow />;
}
