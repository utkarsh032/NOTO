import type { ComponentType } from 'react';

import {
  ClipboardIcon,
  DocumentsIcon,
  HomeIcon,
  MemoryIcon,
  QuickNoteIcon,
  SearchIcon,
  type IconProps,
} from '../components/icons';
import type { Route, RouteName } from './router';

export interface NavEntry {
  id: string;
  label: string;
  icon: ComponentType<IconProps>;
  route: Route;
}

/**
 * The navigation, in the order the sidebar lists it.
 *
 * One list, not two. Settings and Account used to sit below a rule at the
 * bottom of this one; they are about the person rather than about the work, the
 * avatar in the sidebar's footer already leads to both, and a destination listed
 * twice is a destination the user has to choose a route to.
 *
 * Quick Notes is a screen of its own — the place a captured thought lands and
 * is turned into something — while Clipboard History is Memory with a type
 * already chosen, because there is nothing to do with a clipboard entry that
 * Memory does not already do.
 */
export const PRIMARY_NAV: NavEntry[] = [
  { id: 'home', label: 'Home', icon: HomeIcon, route: { name: 'home' } },
  { id: 'documents', label: 'All Documents', icon: DocumentsIcon, route: { name: 'documents' } },
  {
    id: 'quick-notes',
    label: 'Quick Notes',
    icon: QuickNoteIcon,
    route: { name: 'quick-note' },
  },
  { id: 'memory', label: 'Noto Memory', icon: MemoryIcon, route: { name: 'memory' } },
  {
    id: 'clipboard',
    label: 'Clipboard History',
    icon: ClipboardIcon,
    route: { name: 'memory', param: 'clipboard' },
  },
  { id: 'search', label: 'Search', icon: SearchIcon, route: { name: 'search' } },
];

/**
 * Whether a navigation entry is the one currently open.
 *
 * An entry with a parameter only matches that exact parameter, so Noto Memory
 * does not light up while Clipboard History is open — but the bare Memory entry
 * does claim any memory route the other entries have not, which is what makes
 * a type filter chosen on the screen itself still look like Memory.
 */
export function isEntryActive(entry: NavEntry, route: Route): boolean {
  if (entry.route.name !== route.name) return false;
  if (entry.route.param) return entry.route.param === route.param;

  if (entry.route.name === 'memory') {
    return !PRIMARY_NAV.some(
      (other) => other.route.name === 'memory' && other.route.param === route.param,
    );
  }

  return true;
}

/**
 * What each screen is called, for the one place that has to name the screen
 * rather than link to it: the header, when no document is open and the tabs
 * have nothing to say.
 *
 * These are the sidebar's own labels wherever the sidebar has one, so the row
 * you clicked and the title you land on are the same words. `workspace` is the
 * rare one: it shows only when every tab has been closed while standing on it,
 * over the "Nothing open" state.
 */
const ROUTE_TITLES: Record<RouteName, string> = {
  home: 'Home',
  workspace: 'Workspace',
  documents: 'All Documents',
  'quick-note': 'Quick Notes',
  memory: 'Noto Memory',
  search: 'Search',
  settings: 'Settings',
  account: 'Account',
  plans: 'Plans & Pricing',
  login: 'Sign in',
};

/** The name of the screen a route opens. */
export function routeTitle(route: Route): string {
  if (route.name === 'memory' && route.param === 'clipboard') return 'Clipboard History';
  return ROUTE_TITLES[route.name];
}
