import { ThemeProvider } from '@noto/ui';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import './index.css';
import { installAppLockControl } from './platform/native';
import { initSettingsPersistence } from './platform/settings-storage';
import { initTabsPersistence } from './platform/tabs-storage';

initSettingsPersistence();
initTabsPersistence();
installAppLockControl();

const container = document.getElementById('root');
if (!container) throw new Error('Noto could not find its root element.');

createRoot(container).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
);
