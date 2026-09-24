import { lazy } from 'react';

/*
 * Every screen but Home is a chunk of its own.
 *
 * Home is what Noto opens on, so it is part of the shell; the workspace brings
 * the whole editor with it, and settings, memory, search and the account screen
 * are each a page most sessions never visit. Loading them on the click that
 * asks for them is the difference between a fast start and a bundle that grows
 * every time a screen is added.
 */
export const WorkspaceScreen = lazy(() =>
  import('../screens/WorkspaceScreen').then((module) => ({ default: module.WorkspaceScreen })),
);
export const DocumentsScreen = lazy(() =>
  import('../screens/DocumentsScreen').then((module) => ({ default: module.DocumentsScreen })),
);
export const QuickNoteScreen = lazy(() =>
  import('../screens/QuickNoteScreen').then((module) => ({ default: module.QuickNoteScreen })),
);
export const MemoryScreen = lazy(() =>
  import('../screens/MemoryScreen').then((module) => ({ default: module.MemoryScreen })),
);
export const SearchScreen = lazy(() =>
  import('../screens/SearchScreen').then((module) => ({ default: module.SearchScreen })),
);
export const SettingsScreen = lazy(() =>
  import('../screens/SettingsScreen').then((module) => ({ default: module.SettingsScreen })),
);
export const AccountScreen = lazy(() =>
  import('../screens/AccountScreen').then((module) => ({ default: module.AccountScreen })),
);
export const PlansScreen = lazy(() =>
  import('../screens/PlansScreen').then((module) => ({ default: module.PlansScreen })),
);
export const LoginScreen = lazy(() =>
  import('../screens/LoginScreen').then((module) => ({ default: module.LoginScreen })),
);

/** Which overlay is up. Only one of the modal ones can be at a time. */
