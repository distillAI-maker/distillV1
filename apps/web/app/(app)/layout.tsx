import type { ReactNode } from 'react';
import { AppTabs } from '../../components/app-tabs';
import { Footer, Wordmark } from '../../components/ui';

/** The daily screens: Today, Verdicts, Your file, Settings. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="page app">
      <header className="obar">
        <div className="wrap app">
          <Wordmark href="/today" />
          <AppTabs variant="bar" />
        </div>
      </header>
      <main className="main wrap">{children}</main>
      <Footer />
      <AppTabs variant="bottom" />
    </div>
  );
}
