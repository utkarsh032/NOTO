/**
 * Edits still waiting on autosave, and a way to wait for them.
 *
 * Every mounted editor registers the function that writes its queue now.
 * Anything that reads a document back out of storage to hand it on — export,
 * above all — calls `flushPendingWrites` first, so the file holds what is on
 * screen and not what autosave had reached a second ago.
 */

type Flusher = () => Promise<void>;

const flushers = new Set<Flusher>();

export function registerPendingWrites(flusher: Flusher): () => void {
  flushers.add(flusher);
  return () => {
    flushers.delete(flusher);
  };
}

/** Resolves once every editor's queued edits are in storage. */
export async function flushPendingWrites(): Promise<void> {
  await Promise.all([...flushers].map((flush) => flush().catch(() => undefined)));
}
