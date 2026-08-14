/**
 * Light/dark preference for the website.
 *
 * The website is deployed separately from the application and shares no storage
 * with it, so it keeps its own key. The initial value is applied by the inline
 * script in index.html before first paint; this hook only has to stay in step
 * with what that script decided.
 */

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'noto.website.theme';

export type Theme = 'light' | 'dark';

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(currentTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    const onChange = (event: MediaQueryListEvent) => {
      // Only follow the system while the visitor has not chosen for themselves.
      if (localStorage.getItem(STORAGE_KEY)) return;
      setTheme(event.matches ? 'dark' : 'light');
    };

    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const toggle = useCallback(() => {
    setTheme((current) => {
      const next = current === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Private browsing can refuse writes; the theme still applies for the
        // rest of this visit.
      }
      return next;
    });
  }, []);

  return { theme, toggle };
}
