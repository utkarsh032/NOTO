import { useSettingsStore } from '@noto/core';
import type { ReactNode } from 'react';
import { useEffect } from 'react';

import { useResolvedTheme } from './use-resolved-theme';

export interface ThemeProviderProps {
  children: ReactNode;
}

/**
 * Applies the resolved theme to the document root, which is where the token
 * stylesheet reads it from. Rendering is unaffected — the whole theme switch is
 * one attribute and a CSS variable swap.
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  const mode = useSettingsStore((state) => state.settings.appearance.theme);
  const resolved = useResolvedTheme(mode);

  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
  }, [resolved]);

  return <>{children}</>;
}
