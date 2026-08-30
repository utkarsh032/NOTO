import { useMemo } from 'react';

import { parseRoute, useRouteHash, type Route } from './router';

/**
 * Where the application is.
 *
 * Memoised on the hash string so that the object identity only changes when the
 * route actually does — screens receive it as a prop and several of them key
 * effects off it.
 */
export function useRoute(): Route {
  const hash = useRouteHash();
  return useMemo(() => parseRoute(hash), [hash]);
}
