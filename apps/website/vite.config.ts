import { readFileSync } from 'node:fs';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

export default defineConfig({
  plugins: [react(), tailwindcss()],

  define: {
    // Taken from the manifest rather than an environment variable, so the
    // version is correct wherever the site is built. Cloudflare's build command
    // is just `pnpm build:website`, with no variables set — relying on one
    // meant every deployment advertised the fallback version instead of the
    // real one. `VITE_NOTO_VERSION` still wins when it is set, which is how the
    // release workflow stamps a tag.
    __NOTO_VERSION__: JSON.stringify(process.env.VITE_NOTO_VERSION || pkg.version),
  },

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
