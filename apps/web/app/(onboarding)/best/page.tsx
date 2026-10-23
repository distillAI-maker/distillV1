import type { Metadata } from 'next';
import { BestForm } from './best-form';

export const metadata: Metadata = { title: 'You, at your best' };

export default function BestPage() {
  return <BestForm />;
}
