import { NotoApp, NotoDataContext, setPrintHandler, useNotoDataSource } from '@noto/ui';
import { useCallback, useEffect } from 'react';

import { openDesktopDatabase } from './platform/database';

/**
 * Desktop entry point. It supplies SQLite-backed data to the shared Noto shell;
 * the interface itself is the same one the web application renders.
 */
export function App() {
  const open = useCallback(() => openDesktopDatabase(), []);
  const data = useNotoDataSource({ open });

  /*
   * Printing goes through the main process rather than `window.print()`:
   * Electron's renderer has no print preview of its own, and the main process
   * can put the job in front of the operating system's dialog properly. The
   * page itself is the same one the browser would print — the print stylesheet
   * in `@noto/ui` decides what appears on it.
   */
  useEffect(() => {
    setPrintHandler(async () => {
      const result = await window.notoShell.print();
      // A dismissed dialog reports `printed: false` with no reason; that is a
      // decision, not a fault, and nothing should be said about it.
      if (!result.printed && result.reason) {
        console.error(`Noto could not print the document: ${result.reason}`);
      }
    });

    return () => setPrintHandler(null);
  }, []);

  return (
    <NotoDataContext.Provider value={data}>
      <NotoApp />
    </NotoDataContext.Provider>
  );
}
