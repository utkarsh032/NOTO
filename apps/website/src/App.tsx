import { useEffect, type ReactElement } from 'react';

import { Layout } from './components/Layout';
import { About } from './pages/About';
import { Changelog } from './pages/Changelog';
import { Documentation } from './pages/Documentation';
import { Download } from './pages/Download';
import { Faq } from './pages/Faq';
import { Features } from './pages/Features';
import { Home } from './pages/Home';
import { NotFound } from './pages/NotFound';
import { ReleaseNotes } from './pages/ReleaseNotes';
import { SystemRequirements } from './pages/SystemRequirements';
import { useRouter } from './router-context';

interface Route {
  element: ReactElement;
  /** Appended to the site name in the browser tab. */
  title: string;
}

const ROUTES: Record<string, Route> = {
  '/': { element: <Home />, title: 'Your notes. Your workspace.' },
  '/download': { element: <Download />, title: 'Download' },
  '/features': { element: <Features />, title: 'Features' },
  '/docs': { element: <Documentation />, title: 'Documentation' },
  '/requirements': { element: <SystemRequirements />, title: 'System requirements' },
  '/changelog': { element: <Changelog />, title: 'Changelog' },
  '/releases': { element: <ReleaseNotes />, title: 'Release notes' },
  '/faq': { element: <Faq />, title: 'FAQ' },
  '/about': { element: <About />, title: 'About' },
};

export function App() {
  const { path } = useRouter();
  const route = ROUTES[path];

  // The router never reloads the document, so the title is updated here rather
  // than by the browser.
  useEffect(() => {
    document.title = route ? `Noto — ${route.title}` : 'Noto — Page not found';
  }, [route]);

  return <Layout>{route ? route.element : <NotFound />}</Layout>;
}
