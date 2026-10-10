import type { ReactNode } from 'react';
import { AppTabs } from '../../components/app-tabs';
import { Footer, Wordmark } from '../../components/ui';

/** The daily screens: Your Standard (home), Today, Readings, Settings. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="page app">
      <header className="obar">
        <div className="wrap app">
          <Wordmark href="/home" />
          <AppTabs variant="bar" />
        </div>
      </header>
      <main className="main wrap">{children}</main>
      <Footer />
      <AppTabs variant="bottom" />
    </div>
  );
}
