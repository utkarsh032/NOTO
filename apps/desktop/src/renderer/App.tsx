import { NotoApp, NotoDataContext, useNotoDataSource } from '@noto/ui';
import { useCallback } from 'react';

import { openDesktopDatabase } from './platform/database';

/**
 * Desktop entry point. It supplies SQLite-backed data to the shared Noto shell;
 * the interface itself is the same one the web application renders.
 */
export function App() {
  const open = useCallback(() => openDesktopDatabase(), []);
  const data = useNotoDataSource({ open });

  return (
    <NotoDataContext.Provider value={data}>
      <NotoApp />
    </NotoDataContext.Provider>
  );
}
