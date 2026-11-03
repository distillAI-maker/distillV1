import type { ReactNode } from 'react';
import { AppFolio } from '../../components/app-tabs';
import { DBrand } from '../../components/d-star';
import { TabBar } from '../../components/ds/tab-bar';
import { EngineProvider } from '../../lib/engine/context';
import '../app-screens.css';

/**
 * The older screens (the companion thread, Your Standard, readings, verdicts, the file). None are in
 * the navigation since the four tabs (28 Oct); they stay reachable by address until Veer decides
 * what to delete, and show the four tabs along the bottom.
 */
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
        <TabBar />
      </div>
    </div>
  );
}
