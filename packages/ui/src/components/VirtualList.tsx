import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

import { cn } from '../utils/cn';

export interface VirtualListProps<T> {
  items: readonly T[];
  /** Fixed row height in pixels. Rows must all be this tall for the maths to hold. */
  itemHeight: number;
  /** Rows drawn above and below the viewport, so scrolling never shows a gap. */
  overscan?: number;
  renderItem(item: T, index: number): ReactNode;
  /** Stable identity for a row, so React can move rows rather than rebuild them. */
  keyOf(item: T, index: number): string;
  /** The accessible name of the list. */
  label: string;
  className?: string;
  /** Shown in place of the list when `items` is empty. */
  empty?: ReactNode;
}

/**
 * A list that renders only what is on screen.
 *
 * Noto Memory is specified to hold tens of thousands of items, and a DOM node
 * per item stops being viable long before that. Rows are absolutely positioned
 * inside a spacer of the full height, so the scrollbar reports the real size of
 * the collection and the scroll position means what it says.
 *
 * Rows must be a fixed height. That is the trade: measuring each row would let
 * them vary, but it also reintroduces the layout pass this exists to avoid.
 */
export function VirtualList<T>({
  items,
  itemHeight,
  overscan = 6,
  renderItem,
  keyOf,
  label,
  className,
  empty,
}: VirtualListProps<T>) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(0);

  /* The viewport's height decides how many rows exist; it has to be measured. */
  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      if (entry) setHeight(entry.contentRect.height);
    });

    observer.observe(element);
    setHeight(element.clientHeight);

    return () => observer.disconnect();
  }, []);

  const onScroll = useCallback(() => {
    const element = viewportRef.current;
    if (element) setScrollTop(element.scrollTop);
  }, []);

  const total = items.length;
  const first = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const visibleCount = Math.ceil((height || 600) / itemHeight) + overscan * 2;
  const last = Math.min(total, first + visibleCount);

  if (total === 0 && empty) {
    return <div className={cn('min-h-0 flex-1', className)}>{empty}</div>;
  }

  return (
    <div
      ref={viewportRef}
      onScroll={onScroll}
      className={cn('noto-scroll min-h-0 flex-1 overflow-y-auto', className)}
    >
      {/*
       * `aria-setsize` and `aria-posinset` on the rows are what let a screen
       * reader say "item 40 of 50,000" when only twenty of them exist in the
       * document. Without them a virtual list lies about its own length.
       */}
      <div
        role="list"
        aria-label={label}
        style={{ height: total * itemHeight }}
        className="relative w-full"
      >
        {items.slice(first, last).map((item, offset) => {
          const index = first + offset;

          return (
            <div
              key={keyOf(item, index)}
              role="listitem"
              aria-setsize={total}
              aria-posinset={index + 1}
              style={{
                position: 'absolute',
                top: index * itemHeight,
                height: itemHeight,
                left: 0,
                right: 0,
              }}
            >
              {renderItem(item, index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
