import type { ReactNode } from 'react';
import { AppFolio, AppTabs } from '../../components/app-tabs';
import { DBrand } from '../../components/d-star';
import { EngineProvider } from '../../lib/engine/context';
import '../app-screens.css';

/** The daily screens, in Figma's frame: the mark, a folio, and four tabs (Today, Distill, Standard, Settings). */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="dapp">
      <div className="d-col">
        <header className="d-app-topbar">
          <DBrand />
        </header>
        <AppFolio />
        <main className="d-app-body">
          <EngineProvider>{children}</EngineProvider>
        </main>
        <AppTabs />
      </div>
    </div>
  );
}
