import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

/**
 * Builds the interface the Android application runs.
 *
 * This is the same `@noto/ui` shell the web and desktop applications render;
 * only the platform seam underneath it differs, so the phone gets the whole
 * editor — tabs, find, history, formatting, the seven screens — rather than a
 * second, smaller Noto that has to be kept in step by hand.
 *
 * The output is copied into the Android project's asset folder at prebuild by
 * `apps/mobile/plugins/with-android-webapp.cjs` and loaded from
 * `file:///android_asset/webapp/index.html`, which is why `base` is relative:
 * absolute paths do not resolve under a `file://` origin.
 */
/**
 * Emits the entry as a classic script.
 *
 * Vite writes `type="module" crossorigin` whatever the output format is, and
 * both are wrong here: the bundle is already a single IIFE, and a module script
 * would be CORS-checked against a `file://` origin that cannot satisfy it. The
 * tag is rewritten rather than the build reconfigured because this is the only
 * part of Vite's HTML output that assumes it is being served.
 */
function classicEntryScript(): Plugin {
  return {
    name: 'noto-classic-entry-script',
    enforce: 'post',
    transformIndexHtml(html: string) {
      return html.replace(/<script type="module" crossorigin/g, '<script defer');
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), classicEntryScript()],

  // Loaded from the filesystem, never served, so every asset reference has to
  // be relative to the HTML file rather than to a site root that does not exist.
  base: './',

  build: {
    // Written here rather than straight into `apps/mobile`: Turbo only caches
    // outputs inside the package that produced them, and prebuild is what
    // moves the files into the Android project anyway.
    outDir: 'dist',
    emptyOutDir: true,

    /*
     * The bundle ships inside the APK, where it is read from local storage and
     * never downloaded. Source maps would roughly double it for no benefit —
     * nothing can fetch them off a phone — so they are off here even though the
     * web build keeps them.
     */
    sourcemap: false,

    // Android's WebView is updated through the Play Store rather than with the
    // system, so it is current on any device that can install Noto at all.
    // ES2020 leaves room for the ones that are not.
    target: 'es2020',

    /*
     * One classic script rather than ES modules.
     *
     * A module script is always fetched in CORS mode, whatever the markup says,
     * and the page is served from `file://` — an opaque origin, which fails
     * that check. Android can be told to waive it, but relying on a permissive
     * WebView setting for the application to load at all is a poor trade when
     * the alternative is a build flag.
     *
     * A classic script is not CORS-checked, so this removes the question. The
     * cost is that `inlineDynamicImports` folds the lazily-loaded screens back
     * into one file: on the web that would undo real work, but here the bundle
     * is read out of the APK rather than downloaded, so there is nothing left
     * for splitting it to save.
     */
    rollupOptions: {
      output: {
        format: 'iife',
        inlineDynamicImports: true,
      },

      /*
       * Vite's module-preload helper reads `import.meta.url`, which an IIFE
       * cannot answer, so the bundler warns and substitutes an empty object.
       * The helper is unreachable here — preloading is off and there are no
       * chunks left to preload — so the substitution changes nothing, and the
       * warning is the only part of it that survives to the build log.
       *
       * Scoped to that one code, so any other warning still gets through.
       */
      onwarn(warning, warn) {
        if (warning.code === 'EMPTY_IMPORT_META') return;
        warn(warning);
      },
    },

    // There is nothing left to preload once everything is in one file, and the
    // helper Vite injects for it reads `import.meta`, which an IIFE has no
    // answer for. Off, rather than shipped and warned about.
    modulePreload: false,

    // One large chunk is the intended shape here, so the advice to split it is
    // advice already considered and declined. The limit is raised rather than
    // the warning ignored, so a bundle that genuinely runs away still says so.
    chunkSizeWarningLimit: 1_500,
  },

  optimizeDeps: {
    // Workspace packages are consumed as TypeScript source; pre-bundling them
    // would freeze a stale copy and break hot reload when a package changes.
    exclude: [
      '@noto/config',
      '@noto/core',
      '@noto/database',
      '@noto/editor',
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
