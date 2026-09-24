import { useEffect, useRef } from 'react';

/** Calls `onVisible` when it scrolls near the viewport. See `useProgressiveList`. */
export function LoadMoreSentinel({ onVisible }: { onVisible(): void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // No observer (an old WebView, a test runner): draw the rest now.
    if (typeof IntersectionObserver === 'undefined') {
      onVisible();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onVisible();
      },
      // A screen ahead, so the next batch is drawn before it is needed.
      { rootMargin: '600px 0px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [onVisible]);

  return <div ref={ref} aria-hidden="true" className="h-px w-full" />;
}
