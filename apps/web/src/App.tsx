import { AccountContext, NotoApp, NotoDataContext } from '@noto/ui';

import { useWebAccount } from './platform/use-web-account';
import { useWebNotoData } from './platform/use-web-noto-data';

/**
 * Web entry point. It supplies IndexedDB-backed data and a Supabase-backed
 * account to the shared Noto shell, and adds nothing else — the interface
 * itself lives in `@noto/ui`, and neither provider changes what it renders.
 */
export function App() {
  const data = useWebNotoData();
  const account = useWebAccount();

  return (
    <NotoDataContext.Provider value={data}>
      <AccountContext.Provider value={account}>
        <NotoApp />
      </AccountContext.Provider>
    </NotoDataContext.Provider>
  );
}
