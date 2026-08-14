import type { ResolvedTheme } from '@noto/config';
import type { ThemeMode } from '@noto/types';
import { useEffect, useState } from 'react';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function systemTheme(): ResolvedTheme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

/**
 * Turns the user's three-way preference into the two-way value the UI renders.
 *
 * Only the OS preference is held in state — an explicit light/dark choice is
 * derived on read, so switching theme never costs an extra render pass.
 */
export function useResolvedTheme(mode: ThemeMode): ResolvedTheme {
  const [systemResolved, setSystemResolved] = useState<ResolvedTheme>(systemTheme);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const query = window.matchMedia(DARK_QUERY);
    const onChange = (event: MediaQueryListEvent) => {
      setSystemResolved(event.matches ? 'dark' : 'light');
    };

    query.addEventListener('change', onChange);
    return () => {
      query.removeEventListener('change', onChange);
    };
  }, []);

  return mode === 'system' ? systemResolved : mode;
}
