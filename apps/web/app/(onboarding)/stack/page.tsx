import type { Metadata } from 'next';
import { copy } from '../../../lib/copy';

export const metadata: Metadata = { title: 'Your stack' };

// Placeholder until the stack screen lands (docs/ONBOARDING.md, pull request 2).
export default function StackPage() {
  return (
    <section className="stack">
      <h1>{copy.stack.title}</h1>
      <p className="lede">{copy.stack.line}</p>
    </section>
  );
}
