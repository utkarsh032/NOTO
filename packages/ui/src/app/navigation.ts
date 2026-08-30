import type { ComponentType } from 'react';

import {
  ClipboardIcon,
  DocumentsIcon,
  HomeIcon,
  MemoryIcon,
  QuickNoteIcon,
  SearchIcon,
  SettingsIcon,
  UserIcon,
  type IconProps,
} from '../components/icons';
import type { Route } from './router';

export interface NavEntry {
  id: string;
  label: string;
  icon: ComponentType<IconProps>;
  route: Route;
}

/**
 * The primary navigation, in the order the sidebar lists it.
 *
 * Quick Notes and Clipboard History are Memory with a type already chosen, not
 * screens of their own: they are the two things people reach for by name, and
 * giving each its own page would mean three places that list captured items and
 * three sets of filters to keep in step.
 */
export const PRIMARY_NAV: NavEntry[] = [
  { id: 'home', label: 'Home', icon: HomeIcon, route: { name: 'home' } },
  { id: 'documents', label: 'All Documents', icon: DocumentsIcon, route: { name: 'documents' } },
  {
    id: 'quick-notes',
    label: 'Quick Notes',
    icon: QuickNoteIcon,
    route: { name: 'memory', param: 'note' },
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

/** Below the rule: the two screens that are about Noto rather than about work. */
export const SECONDARY_NAV: NavEntry[] = [
  { id: 'settings', label: 'Settings', icon: SettingsIcon, route: { name: 'settings' } },
  { id: 'account', label: 'Account', icon: UserIcon, route: { name: 'account' } },
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
