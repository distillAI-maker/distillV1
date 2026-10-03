import type { Metadata } from 'next';
import { GoalsForm } from './goals-form';

export const metadata: Metadata = { title: 'What for' };

export default function GoalsPage() {
  return <GoalsForm />;
}
