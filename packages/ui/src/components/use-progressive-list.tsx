import { type ReactNode, useState } from 'react';

import { LoadMoreSentinel } from './LoadMoreSentinel';

export interface ProgressiveList<T> {
  /** The rows to draw now. */
  visible: readonly T[];
  /** Place after the last row: drawing it asks for the next batch. `null` when all are drawn. */
  sentinel: ReactNode;
}

/**
 * Draws a long list a batch at a time, as it is scrolled to.
 *
 * The rows in Noto's lists vary in height — a snippet wraps, a card has tags —
 * so the fixed-height windowing in `VirtualList` does not fit them. This keeps
 * the part that matters: what is rendered grows with how far somebody
 * scrolls, not with how much they have written. A list of forty documents is
 * drawn at once; a list of four thousand is drawn sixty at a time.
 *
 * Changing the list (a new query, a new filter) starts again from the top.
 */
export function useProgressiveList<T>(
  items: readonly T[],
  { batch = 60 }: { batch?: number } = {},
): ProgressiveList<T> {
  const [state, setState] = useState({ items, count: batch });
  const count = state.items === items ? state.count : batch;
  if (state.items !== items) setState({ items, count: batch });

  const done = count >= items.length;

  return {
    visible: done ? items : items.slice(0, count),
    sentinel: done ? null : (
      <LoadMoreSentinel
        key={count}
        onVisible={() => setState((current) => ({ ...current, count: current.count + batch }))}
      />
    ),
  };
}
