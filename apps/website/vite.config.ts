import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Deliberately not 5173: the website and the web application are often run
    // side by side while checking that the download links point somewhere real.
    port: 5174,
    strictPort: false,
  },
  build: {
    outDir: 'dist',
    // The website is a public marketing site; source maps would ship a copy of
    // the sources to every visitor for no benefit.
    sourcemap: false,
  },
  optimizeDeps: {
    // `@noto/config` is consumed as TypeScript source, so pre-bundling it would
    // freeze a stale copy and break hot reload when a release constant changes.
    exclude: ['@noto/config', '@noto/types'],
  },
});
