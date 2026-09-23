import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

import { originsOf, securityHeaders } from '../../tooling/vite/security-headers.mts';

const TURNSTILE = 'https://challenges.cloudflare.com';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  return {
    plugins: [
      react(),
      tailwindcss(),
      securityHeaders({
        csp: {
          'default-src': ["'self'"],
          'script-src': ["'self'", TURNSTILE],
          // TipTap writes alignment and table widths as style attributes.
          'style-src': ["'self'", "'unsafe-inline'"],
          // Documents may show images inserted by URL.
          'img-src': ["'self'", 'data:', 'blob:', 'https:'],
          'font-src': ["'self'", 'data:'],
          'connect-src': ["'self'", ...originsOf(env.VITE_NOTO_API_URL, env.VITE_SUPABASE_URL)],
          'frame-src': [TURNSTILE],
          'worker-src': ["'self'", 'blob:'],
          'manifest-src': ["'self'"],
          'object-src': ["'none'"],
          'base-uri': ["'none'"],
          'form-action': ["'self'"],
          'frame-ancestors': ["'none'"],
          'upgrade-insecure-requests': [],
        },
        extra: [
          '# Vite fingerprints these filenames, so they can be cached indefinitely.',
          '/assets/*',
          '  Cache-Control: public, max-age=31536000, immutable',
        ].join('\n'),
      }),
    ],
    server: {
      // 5173 is Vite's default and is usually already taken by something else on
      // this machine; a second dev server then drifts to 5174, 5175 and so on.
      port: 5000,
      strictPort: false,
    },
    build: {
      outDir: 'dist',
      /*
       * Built, but not deployed: `public/.assetsignore` keeps `*.map` out of the
       * Worker's assets, and 'hidden' drops the comment that would point a
       * browser at them. They stay in `dist/` for error tracking to upload.
       */
      sourcemap: 'hidden',
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
  };
});
