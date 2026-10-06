import type { Metadata } from 'next';
import { LifeForm } from './life-form';

export const metadata: Metadata = { title: 'Your life' };

export default function LifePage() {
  return <LifeForm />;
}
