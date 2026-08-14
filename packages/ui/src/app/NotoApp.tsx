import { nextThemeMode, useSettingsStore, useUiStore } from '@noto/core';
import type { ReactNode } from 'react';

import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { Spinner } from '../components/Spinner';
import { DocumentEditor } from './DocumentEditor';
import { Sidebar } from './Sidebar';
import { useNotoData } from './data-context';

/**
 * The Noto application shell, shared by the web and desktop applications.
 *
 * It reads everything it needs from the surrounding `NotoDataContext`, so the
 * two platforms differ only in how they store documents — not in how Noto looks
 * or behaves.
 */
export function NotoApp() {
  const { status, error, activeDocument, createDocument } = useNotoData();

  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const theme = useSettingsStore((state) => state.settings.appearance.theme);
  const setTheme = useSettingsStore((state) => state.setTheme);

  if (status === 'error') {
    return (
      <main className="flex h-full items-center justify-center">
        <EmptyState
          title="Noto could not open local storage"
          description={error ?? 'Local storage is unavailable.'}
        />
      </main>
    );
  }

  if (status === 'loading') {
    return (
      <main className="flex h-full items-center justify-center">
        <Spinner label="Opening workspace" />
      </main>
    );
  }

  /*
   * `undefined` means the selection is still resolving — a document that was
   * just created is briefly absent from the list. Render nothing in that window
   * rather than flashing the "create a document" prompt after every create.
   */
  let content: ReactNode = null;
  if (activeDocument) {
    // Keyed so switching documents remounts the editor with fresh state.
    content = <DocumentEditor key={activeDocument.id} document={activeDocument} />;
  } else if (activeDocument === null) {
    content = (
      <EmptyState
        title="Nothing open"
        description="Select a document, or create a new one to start writing."
        action={
          <Button variant="primary" onClick={() => void createDocument()}>
            New document
          </Button>
        }
        className="h-full"
      />
    );
  }

  return (
    <div className="flex h-full">
      <Sidebar />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="border-border-subtle flex items-center justify-between border-b px-4 py-2">
          <Button size="sm" variant="ghost" onClick={toggleSidebar}>
            Toggle sidebar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setTheme(nextThemeMode(theme))}>
            Theme: {theme}
          </Button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">{content}</div>
      </main>
    </div>
  );
}
