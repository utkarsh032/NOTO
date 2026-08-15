import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import './index.css';
import { Router } from './router';

const container = document.getElementById('root');
if (!container) throw new Error('The Noto website could not find its root element.');

createRoot(container).render(
  <StrictMode>
    <Router>
      <App />
    </Router>
  </StrictMode>,
);
