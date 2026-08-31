import { NotoApp, NotoDataContext, useNotoDataSource } from '@noto/ui';
import { useCallback, useEffect } from 'react';

import { openMobileDatabase } from './platform/database';
import {
  installNativeHandlers,
  installSafeAreaInsets,
  setPrintableDocument,
} from './platform/native';

/**
 * Android entry point. It supplies SQLite-backed data to the shared Noto shell
 * — reached across the bridge, because the connection lives on the native side
 * — and the interface itself is the same one the web application renders.
 */
export function App() {
  const open = useCallback(() => openMobileDatabase(), []);
  const data = useNotoDataSource({ open });

  useEffect(() => installNativeHandlers(), []);
  useEffect(() => installSafeAreaInsets(), []);

  // Printing is registered once and takes no arguments, so the open document is
  // published to it whenever it changes.
  useEffect(() => {
    setPrintableDocument(data.activeDocument ?? null);
  }, [data.activeDocument]);

  return (
    <NotoDataContext.Provider value={data}>
      <NotoApp />
    </NotoDataContext.Provider>
  );
}
