import { NotoApp, NotoDataContext } from '@noto/ui';

import { useWebNotoData } from './platform/use-web-noto-data';

/**
 * Web entry point. It supplies IndexedDB-backed data to the shared Noto shell
 * and adds nothing else — the interface itself lives in `@noto/ui`.
 */
export function App() {
  const data = useWebNotoData();

  return (
    <NotoDataContext.Provider value={data}>
      <NotoApp />
    </NotoDataContext.Provider>
  );
}
