/**
 * The router's context and hook, kept apart from the components in
 * `router.tsx` so that file exports components only and stays eligible for
 * React Fast Refresh.
 */

import { createContext, useContext } from 'react';

export interface RouterValue {
  path: string;
  navigate: (to: string) => void;
}

export const RouterContext = createContext<RouterValue | null>(null);

export function useRouter(): RouterValue {
  const value = useContext(RouterContext);
  if (!value) throw new Error('useRouter must be used inside <Router>.');
  return value;
}

/** Treats `/download` and `/download/` as the same route. */
export function normalisePath(path: string): string {
  if (path.length > 1 && path.endsWith('/')) return path.slice(0, -1);
  return path;
}
