import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';

/**
 * The origins the renderer may call, written into the CSP in `index.html`.
 *
 * Without a `connect-src`, the policy fell back to `default-src 'self'` — and a
 * packaged renderer's `file://` document has an opaque origin, so every call to
 * the backend was blocked. The cloud's origins are known at build time, so
 * they are named exactly, rather than opening the policy to all of `https:`.
 */
function connectSrc(mode: string): Plugin {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const origins = [env.VITE_NOTO_API_URL, env.VITE_SUPABASE_URL]
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => {
      try {
        const origin = new URL(value).origin;
        // Supabase's realtime client speaks WebSocket to the same host.
        return [origin, origin.replace(/^http/, 'ws')];
      } catch {
        return [];
      }
    });

  return {
    name: 'noto-connect-src',
    transformIndexHtml: (html) => html.replace('%NOTO_CONNECT_SRC%', origins.join(' ')),
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), connectSrc(mode)],
  build: {
    /*
     * A packaged renderer is loaded over `file://`, where the document has an
     * opaque origin — so the `img-src 'self'` in index.html matches nothing and
     * an emitted asset URL is blocked. The brand marks are small enough to ride
     * along as `data:` URIs, which that same policy already allows, and that is
     * a narrower grant than adding `file:` to it.
     */
    assetsInlineLimit: 96 * 1024,
  },
  optimizeDeps: {
    // Workspace packages are consumed as TypeScript source; pre-bundling them
    // would freeze a stale copy and break hot reload when a package changes.
    exclude: [
      '@noto/config',
      '@noto/core',
      '@noto/database',
      '@noto/editor',
      '@noto/sync',
      '@noto/types',
      '@noto/ui',
    ],
    // Because those packages are excluded, Vite's scanner never walks their
    // imports, so their third-party dependencies are not discovered. The CJS
    // ones then fail in dev with "does not provide an export named ...", and
    // must be listed for pre-bundling explicitly.
    include: [
      'zustand',
      'use-sync-external-store/shim',
      'clsx',
      'tailwind-merge',
      '@tiptap/core',
      '@tiptap/react',
      '@tiptap/starter-kit',
    ],
  },
}));
