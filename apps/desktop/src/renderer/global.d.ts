import type { NotoShellBridge, NotoSqlBridge, NotoUpdatesBridge } from '../main/preload';

declare global {
  interface Window {
    /** Exposed by the preload script; see `src/main/preload.ts`. */
    notoSql: NotoSqlBridge;
    notoShell: NotoShellBridge;
    notoUpdates: NotoUpdatesBridge;
  }
}

export {};
