import { build } from 'esbuild';

/**
 * Bundles the server into dist/index.js.
 *
 * The workspace packages (`@noto/*`) export TypeScript source, which Node will
 * not run from node_modules, so they are bundled in. npm dependencies stay
 * external and are installed on the host: `@node-rs/argon2` is a native
 * module and cannot be bundled at all.
 */
await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  sourcemap: true,
  logLevel: 'info',
  plugins: [
    {
      name: 'external-npm',
      setup(pluginBuild) {
        pluginBuild.onResolve({ filter: /^[^./]/ }, (args) =>
          args.path.startsWith('@noto/') ? undefined : { path: args.path, external: true },
        );
      },
    },
  ],
});
