import { useSyncExternalStore } from 'react';

/**
 * Noto's routes.
 *
 * Ten screens, and nothing else. The command palette, Quick Paste, version
 * history, import and export are still overlays over whichever of these is
 * open, because a dialog that took the workspace away from you would not be a
 * dialog.
 *
 * Quick Note is the one that graduated. It stays an overlay you can summon
 * over anything — that is the whole point of it — but the notes it captured
 * had nowhere to be read, so `quick-note` is where they live: the composer,
 * and everything jotted down before it. `login` and `plans` are about the
 * account rather than about the work, and `login` is the single exception to
 * how Noto renders a route: it fills the window with no shell around it,
 * because a sidebar of documents behind a sign-in form belongs to someone who
 * is, by definition, not signed in.
 */
export type RouteName =
  | 'home'
  | 'workspace'
  | 'documents'
  | 'quick-note'
  | 'memory'
  | 'search'
  | 'settings'
  | 'account'
  | 'plans'
  | 'login';

export interface Route {
  name: RouteName;
  /**
   * The segment after the screen name: a document id on `workspace`, a memory
   * type on `memory`, a query on `search`, a category on `settings`.
   */
  param?: string;
}

const ROUTE_NAMES: readonly RouteName[] = [
  'home',
  'workspace',
  'documents',
  'quick-note',
  'memory',
  'search',
  'settings',
  'account',
  'plans',
  'login',
];

const DEFAULT_ROUTE: Route = { name: 'home' };

/**
 * Routing is on the hash rather than the path.
 *
 * The desktop application is the same bundle loaded from `file://`, where there
 * is no server to answer a deep link and `history.pushState` has no origin to
 * push against. One scheme for both platforms is worth more here than pretty
 * URLs in the browser — and the shell is a single window, so the address bar is
 * a bookmark, not a navigation control.
 */
export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#\/?/, '');
  if (path === '') return DEFAULT_ROUTE;

  const [head, ...rest] = path.split('/');
  const name = ROUTE_NAMES.find((candidate) => candidate === head);
  if (!name) return DEFAULT_ROUTE;

  const param = rest.join('/');
  return param === '' ? { name } : { name, param: decodeURIComponent(param) };
}

export function routeToHash(route: Route): string {
  return route.param ? `#/${route.name}/${encodeURIComponent(route.param)}` : `#/${route.name}`;
}

function currentHash(): string {
  return typeof window === 'undefined' ? '' : window.location.hash;
}

/*
 * The hash itself is the store. Keeping a copy in React state would mean two
 * answers to "where am I", and the browser's Back button only updates one of
 * them.
 */
function subscribe(listener: () => void): () => void {
  window.addEventListener('hashchange', listener);
  return () => window.removeEventListener('hashchange', listener);
}

/*
 * `useSyncExternalStore` compares snapshots by identity, so the raw hash string
 * is the snapshot and the parsed route is derived from it. Returning a fresh
 * object here would re-render every subscriber on every unrelated update.
 */
export function useRouteHash(): string {
  return useSyncExternalStore(subscribe, currentHash, () => '');
}

export function navigate(route: Route | RouteName): void {
  const next = typeof route === 'string' ? { name: route } : route;
  const hash = routeToHash(next);

  if (window.location.hash === hash) return;
  window.location.hash = hash;
}

/** Replaces the current entry instead of adding one — for redirects. */
export function replaceRoute(route: Route | RouteName): void {
  const next = typeof route === 'string' ? { name: route } : route;
  window.location.replace(
    `${window.location.pathname}${window.location.search}${routeToHash(next)}`,
  );
}
