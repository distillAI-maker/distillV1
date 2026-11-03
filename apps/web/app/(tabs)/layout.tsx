import type { ReactNode } from 'react';
import { TabBar } from '../../components/ds/tab-bar';
import { EngineProvider } from '../../lib/engine/context';

/** The app: four tabs (Ritual, Your things, Explore, Settings) over the engine. */
export default function TabsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="ds">
      <div className="ds-col">
        <EngineProvider>{children}</EngineProvider>
        <TabBar />
      </div>
    </div>
  );
}
