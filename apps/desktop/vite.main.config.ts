import { builtinModules } from 'node:module';

import { defineConfig } from 'vite';

/**
 * Electron main process. Electron and every Node built-in stay external —
 * the runtime provides them, and bundling them would break native bindings
 * such as `node:sqlite`.
 */
export default defineConfig({
  build: {
    rollupOptions: {
      external: ['electron', ...builtinModules, ...builtinModules.map((name) => `node:${name}`)],
    },
  },
});
