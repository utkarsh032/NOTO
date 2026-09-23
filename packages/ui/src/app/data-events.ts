import { useSyncExternalStore } from 'react';

/**
 * "Something in storage changed" — for everything that is not a document.
 *
 * Documents have their own live query on each platform. Memory, versions and
 * the rest are read on demand, so a write has to say it happened for anything
 * showing that data to read it again. A topic is a table's name, roughly;
 * listeners re-query rather than receive the change, which keeps this a
 * signal and not a second copy of the database.
 *
 * Other windows hear about it too — another browser tab, or the desktop dock —
 * through a `BroadcastChannel` where there is one, and a focus refresh where
 * there is not.
 */

export type DataTopic = 'memory' | 'versions' | 'folders' | 'tags';

const revisions = new Map<DataTopic, number>();
const listeners = new Set<() => void>();

const channel: BroadcastChannel | null = (() => {
  try {
    return typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('noto:data');
  } catch {
    // An opaque origin (a packaged `file://` renderer) may refuse one.
    return null;
  }
})();

function bump(topic: DataTopic): void {
  revisions.set(topic, (revisions.get(topic) ?? 0) + 1);
  for (const listener of listeners) listener();
}

channel?.addEventListener('message', (event: MessageEvent<unknown>) => {
  const topic = (event.data as { topic?: DataTopic } | null)?.topic;
  if (topic) bump(topic);
});

if (typeof window !== 'undefined') {
  // Coming back to a window is when it is most likely to be out of date.
  window.addEventListener('focus', () => {
    for (const topic of ['memory', 'versions', 'folders', 'tags'] as const) bump(topic);
  });
}

/** Says that `topic` changed, here and in every other open Noto window. */
export function notifyDataChanged(topic: DataTopic): void {
  bump(topic);
  channel?.postMessage({ topic });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** A number that changes whenever `topic` does. Use it as an effect dependency. */
export function useDataRevision(topic: DataTopic): number {
  return useSyncExternalStore(
    subscribe,
    () => revisions.get(topic) ?? 0,
    () => 0,
  );
}
