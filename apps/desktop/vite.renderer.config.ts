import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
});
