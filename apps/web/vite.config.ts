import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // 5173 is Vite's default and is usually already taken by something else on
    // this machine; a second dev server then drifts to 5174, 5175 and so on.
    port: 5000,
    strictPort: false,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
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
      'dexie',
      'dexie-react-hooks',
      'clsx',
      'tailwind-merge',
      '@tiptap/core',
      '@tiptap/react',
      '@tiptap/starter-kit',
    ],
  },
});
