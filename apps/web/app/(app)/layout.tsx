import type { ReactNode } from 'react';
import { Footer, Wordmark } from '../../components/ui';

// The daily screens. Tabs arrive with Today, Verdicts, Your file and Settings.
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="page">
      <header className="obar">
        <div className="wrap" style={{ gridTemplateColumns: '1fr' }}>
          <Wordmark href="/today" />
        </div>
      </header>
      <main className="main wrap">{children}</main>
      <Footer />
    </div>
  );
}
