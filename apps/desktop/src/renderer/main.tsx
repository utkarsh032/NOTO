import { ThemeProvider } from '@noto/ui';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import { DockApp } from './DockApp';
import './index.css';
import { initSettingsPersistence } from './platform/settings-storage';
import { initTabsPersistence } from './platform/tabs-storage';

initSettingsPersistence();
initTabsPersistence();

const container = document.getElementById('root');
if (!container) throw new Error('Noto could not find its root element.');

/*
 * Two windows, one bundle.
 *
 * The Quick Note dock is a separate operating-system window — that is what lets
 * it outlive the application window — but it is the same design system, the
 * same storage and the same components, so the main process loads this same
 * page at `#/dock` and the hash decides which root mounts.
 *
 * A second Vite entry would have meant a second HTML file, a second build and a
 * second copy of the interface in the installer, in order to render a tab and a
 * note field that both already exist.
 *
 * Read once, not through the router: this window is one thing or the other for
 * as long as it lives, and re-mounting the application because a route changed
 * inside the dock is not a case that exists.
 */
const isDock = window.location.hash.startsWith('#/dock');

createRoot(container).render(
  <StrictMode>
    <ThemeProvider>{isDock ? <DockApp /> : <App />}</ThemeProvider>
  </StrictMode>,
);
