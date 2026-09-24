import type {
  NotoDockBridge,
  NotoFilesBridge,
  NotoLaunchBridge,
  NotoShellBridge,
  NotoSqlBridge,
  NotoUpdatesBridge,
} from '../main/preload';

declare global {
  interface Window {
    /** Exposed by the preload script; see `src/main/preload.ts`. */
    notoSql: NotoSqlBridge;
    notoShell: NotoShellBridge;
    notoFiles: NotoFilesBridge;
    /** Only meaningful in the dock window, but present in both. */
    notoDock: NotoDockBridge;
    notoUpdates: NotoUpdatesBridge;
    notoLaunch: NotoLaunchBridge;
  }
}

export {};
