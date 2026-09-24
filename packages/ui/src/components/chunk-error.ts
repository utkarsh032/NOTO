/**
 * Whether an error is a lazy chunk that failed to load.
 *
 * The usual cause is a deployment: the page was loaded before it, and the
 * chunk it asks for has since been replaced. Trying again cannot help — only
 * reloading the page, which fetches the new names, can.
 */
export function isChunkLoadError(error: Error): boolean {
  return (
    error.name === 'ChunkLoadError' ||
    /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i.test(
      error.message,
    )
  );
}
