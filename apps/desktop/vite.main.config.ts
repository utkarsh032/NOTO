import { builtinModules } from 'node:module';

import { defineConfig } from 'vite';

/**
 * Experimental built-ins that `builtinModules` does not list.
 *
 * `node:sqlite` is loadable at runtime but omitted from `builtinModules`, which
 * only enumerates stable modules. Deriving the external list from that array
 * alone therefore left `node:sqlite` looking like an ordinary dependency:
 * Rollup could not resolve it, substituted an empty module, and the packaged
 * app died on startup with `DatabaseSync is not a constructor` - after the
 * build had reported success. `openConnection` runs before `createWindow`, so
 * the window never appeared and the process exited with status 0.
 *
 * Anything added here must be a module Electron's Node actually provides.
 */
const EXPERIMENTAL_BUILTINS = ['sqlite'];

const NODE_BUILTINS = [...builtinModules, ...EXPERIMENTAL_BUILTINS];

/**
 * Electron main process. Electron and every Node built-in stay external —
 * the runtime provides them, and bundling them would break native bindings
 * such as `node:sqlite`.
 */
export default defineConfig({
  build: {
    rollupOptions: {
      external: ['electron', ...NODE_BUILTINS, ...NODE_BUILTINS.map((name) => `node:${name}`)],

      // Rollup resolves an unmatched import to an empty module and carries on
      // with only a warning, which is how the missing external above became a
      // runtime crash instead of a build failure. Promote it: a main-process
      // import that cannot be resolved should stop the build.
      onwarn(warning, warn) {
        if (warning.code === 'UNRESOLVED_IMPORT') {
          throw new Error(
            `Unresolved import in the main process: ${warning.exporter}. ` +
              'If it is a Node built-in, add it to EXPERIMENTAL_BUILTINS in vite.main.config.ts.',
          );
        }
        warn(warning);
      },
    },
  },
});
