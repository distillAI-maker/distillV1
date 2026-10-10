import type { Metadata } from 'next';
import { NameForm } from './name-form';

export const metadata: Metadata = { title: 'Your name' };

export default function NamePage() {
  return <NameForm />;
}
