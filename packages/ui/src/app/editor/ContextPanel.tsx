import type { NotoDocument } from '@noto/types';

import { SparklesIcon } from '../../components/icons';
import { cn } from '../../utils/cn';
import { useDocumentOperations } from '../documents/use-document-operations';
import { AIAssistantPanel } from '../overlays/AIAssistantPanel';
import { DocumentInfoCard } from './DocumentInfoCard';
import { InfoTab } from './InfoTab';
import { OutlineTab } from './OutlineTab';
import { VersionsTab } from './VersionsTab';

export type ContextTab = 'outline' | 'info' | 'versions' | 'ai';

export interface ContextPanelProps {
  document: NotoDocument;
  tab: ContextTab;
  onTab(tab: ContextTab): void;
  /** Where the document lives, phrased for a person. */
  location: string;
}

const TABS: { id: ContextTab; label: string }[] = [
  { id: 'outline', label: 'Outline' },
  { id: 'info', label: 'Info' },
  { id: 'versions', label: 'Versions' },
  { id: 'ai', label: 'AI Assistant' },
];

/**
 * The column beside the document: what is in it, what is known about it, what
 * it used to be, and the assistant.
 *
 * Two cards rather than one. The upper card holds views a writer chooses
 * between — outline, history, assistant — because only one of them is usable at
 * 320px. The lower card holds the document's own facts, which stay true
 * whichever view is open, so they stay on screen instead of having to be
 * navigated back to.
 */
export function ContextPanel({ document, tab, onTab, location }: ContextPanelProps) {
  const operations = useDocumentOperations();

  return (
    <aside
      aria-label="Document details"
      className="noto-print-hidden border-default bg-background w-context-panel hidden shrink-0 flex-col gap-4 overflow-y-auto border-l p-4 lg:flex"
    >
      <section className="border-default bg-surface flex min-h-0 flex-1 flex-col rounded-xl border">
        <div
          role="tablist"
          aria-label="Document details"
          className="border-default flex shrink-0 items-center gap-3 border-b px-4"
        >
          {TABS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={tab === entry.id}
              onClick={() => onTab(entry.id)}
              className={cn(
                'text-body-sm focus-visible:outline-brand -mb-px flex shrink-0 items-center gap-1 border-b-2 py-3 font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2',
                tab === entry.id
                  ? entry.id === 'ai'
                    ? 'border-ai text-ai'
                    : 'border-brand text-brand-strong'
                  : 'text-tertiary hover:text-primary border-transparent',
              )}
            >
              {entry.label}
              {/* The assistant is the one thing here Noto writes rather than
                  reads, and the mark is how that is said everywhere in Noto. */}
              {entry.id === 'ai' ? (
                <SparklesIcon
                  className={cn('h-3.5 w-3.5', tab === 'ai' ? 'text-ai' : 'text-ai/60')}
                  aria-hidden="true"
                />
              ) : null}
            </button>
          ))}
        </div>

        <div className="noto-scroll-y min-h-0 flex-1 overflow-y-auto p-3">
          {tab === 'outline' ? <OutlineTab document={document} /> : null}
          {tab === 'info' ? <InfoTab document={document} location={location} /> : null}
          {tab === 'versions' ? <VersionsTab document={document} /> : null}
          {tab === 'ai' ? (
            <AIAssistantPanel documentTitle={document.title} className="h-full" />
          ) : null}
        </div>
      </section>

      {/* The facts move up into the card when Info is the view being read,
          rather than being printed twice on the same screen. */}
      {tab === 'info' ? null : (
        <DocumentInfoCard document={document} location={location} operations={operations} />
      )}

      {operations.dialogs}
    </aside>
  );
}
