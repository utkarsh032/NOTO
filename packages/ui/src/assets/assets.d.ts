/*
 * The applications get these from `vite/client`, but this package is compiled
 * as plain TypeScript source and has no bundler types of its own.
 */
declare module '*.png' {
  const source: string;
  export default source;
}
