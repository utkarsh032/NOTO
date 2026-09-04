import type { NotoDocument } from '@noto/types';
import { useMemo, useRef, useState } from 'react';

import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { IconButton } from '../../components/IconButton';
import { LoadingState } from '../../components/LoadingState';
import { SegmentedControl } from '../../components/SegmentedControl';
import {
  ArrowRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardIcon,
  DocumentIcon,
  FolderOpenIcon,
  GridIcon,
  ListIcon,
  PencilIcon,
  PlusIcon,
} from '../../components/icons';
import { HomeHeroIllustration, WritingIllustration } from '../../components/illustrations';
import { WRITING_TEMPLATES } from '../../mock/templates';
import { greetingFor } from '../../utils/format';
import { DocumentCard } from '../documents/DocumentCard';
import { DocumentMenu } from '../documents/DocumentMenu';
import { DocumentRow } from '../documents/DocumentRow';
import { useDocumentOperations } from '../documents/use-document-operations';
import { QuickActionCard } from '../home/QuickActionCard';
import { TemplateCard } from '../home/TemplateCard';
import { useNotoData } from '../data-context';
import { navigate } from '../router';
import { firstNameOf, useAccount } from '../use-account';
import { useNotoActions } from '../use-noto-actions';

export interface HomeScreenProps {
  onQuickNote(): void;
  onQuickPaste(): void;
}

/** How many documents the Recent list shows before "View all" is the answer. */
const RECENT_LIMIT = 5;

/**
 * Home.
 *
 * The first thing Noto shows, and the one screen whose job is not to hold
 * information but to get out of the way: a greeting, four things you might do,
 * the documents you were last in, and four ways to start a new one. Everything
 * on it leads somewhere; nothing on it needs reading twice.
 */
export function HomeScreen({ onQuickNote, onQuickPaste }: HomeScreenProps) {
  const { documents, workspace } = useNotoData();
  const { user } = useAccount();
  const actions = useNotoActions();
  const operations = useDocumentOperations();

  const [templateView, setTemplateView] = useState<'grid' | 'list'>('grid');
  const railRef = useRef<HTMLDivElement>(null);

  /* Newest first. The store returns them that way; sorting here keeps Home
     right even if a platform ever supplies a different order. */
  const recent = useMemo(
    () =>
      [...(documents ?? [])].sort(
        (left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
      ),
    [documents],
  );

  const isLoading = documents === undefined;
  const isEmpty = !isLoading && recent.length === 0;

  const scrollRail = (direction: 1 | -1) => {
    railRef.current?.scrollBy({ left: direction * 320, behavior: 'smooth' });
  };

  const menuFor = (document: NotoDocument) => (
    <DocumentMenu
      revealOnHover
      document={document}
      onOpen={() => operations.open(document.id)}
      onRename={() => operations.rename(document)}
      onDuplicate={() => operations.duplicate(document)}
      onTogglePin={() => operations.togglePin(document)}
      onArchive={() => operations.archive(document)}
      onExport={() => operations.exportDocument(document)}
      onDelete={() => operations.remove(document)}
    />
  );

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <div className="noto-scroll min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full px-5 py-6 sm:px-8 sm:py-8">
          {/* Greeting. The illustration is decoration and says so, so a screen
              reader hears the greeting and moves straight on. */}
          <section className="flex items-center justify-between gap-6">
            <div className="min-w-0">
              <h1 className="text-primary text-display">
                {user ? `${greetingFor()}, ${firstNameOf(user)}!` : `${greetingFor()}!`}{' '}
                <span aria-hidden="true" className="inline-block">
                  👋
                </span>
              </h1>
              <p className="text-secondary text-body-lg mt-2">
                Start writing or pick up where you left off.
              </p>
            </div>

            <HomeHeroIllustration className="-my-2 hidden h-32 w-52 shrink-0 lg:block xl:h-36 xl:w-60" />
          </section>

          {/* Four things you might be here to do. */}
          <section
            aria-label="Quick actions"
            className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          >
            <QuickActionCard
              tone="brand"
              title="New Document"
              description="Start writing a new document"
              icon={<DocumentIcon className="h-6 w-6" />}
              onSelect={() => void actions.newDocument()}
            />
            <QuickActionCard
              tone="info"
              title="Open Document"
              description="Open an existing document"
              icon={<FolderOpenIcon className="h-6 w-6" />}
              onSelect={() => navigate('documents')}
            />
            <QuickActionCard
              tone="warning"
              title="Quick Note"
              description="Write a quick note in a floating window"
              icon={<PencilIcon className="h-6 w-6" />}
              onSelect={onQuickNote}
            />
            <QuickActionCard
              tone="ai"
              title="Quick Paste"
              description="Paste from clipboard instantly"
              icon={<ClipboardIcon className="h-6 w-6" />}
              onSelect={onQuickPaste}
            />
          </section>

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            {/* Recent Documents. */}
            <section
              aria-labelledby="noto-home-recent"
              className="border-default bg-surface rounded-xl border p-5 shadow-sm sm:p-6"
            >
              <div className="flex items-center justify-between gap-4">
                <h2 id="noto-home-recent" className="text-primary text-h3">
                  Recent Documents
                </h2>
                <button
                  type="button"
                  onClick={() => navigate('documents')}
                  className="text-brand-strong text-body-sm hover:text-brand focus-visible:outline-brand rounded-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  View all
                </button>
              </div>

              <div className="mt-4">
                {isLoading ? (
                  <LoadingState label="Loading documents" rows={5} />
                ) : isEmpty ? (
                  <EmptyState
                    title="Nothing written yet"
                    description="Your recent documents will appear here once you start one."
                    illustration={<WritingIllustration className="h-14 w-14" />}
                    action={
                      <Button
                        variant="primary"
                        leading={<PlusIcon className="h-5 w-5" />}
                        onClick={() => void actions.newDocument()}
                      >
                        New document
                      </Button>
                    }
                    className="py-8"
                  />
                ) : (
                  <ul className="-mx-1.5 flex flex-col">
                    {recent.slice(0, RECENT_LIMIT).map((document) => (
                      <li key={document.id}>
                        <DocumentRow
                          document={document}
                          location={workspace?.name}
                          onOpen={() => operations.open(document.id)}
                          actions={menuFor(document)}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            {/* Start Writing. */}
            <section
              aria-labelledby="noto-home-templates"
              className="border-default bg-surface rounded-xl border p-5 shadow-sm sm:p-6"
            >
              <div className="flex items-center justify-between gap-4">
                <h2 id="noto-home-templates" className="text-primary text-h3">
                  Start Writing
                </h2>
                <SegmentedControl
                  size="sm"
                  label="Template view"
                  value={templateView}
                  onChange={setTemplateView}
                  options={[
                    { value: 'list', label: 'List view', icon: <ListIcon className="h-4 w-4" /> },
                    { value: 'grid', label: 'Grid view', icon: <GridIcon className="h-4 w-4" /> },
                  ]}
                />
              </div>

              <div
                className={
                  templateView === 'grid'
                    ? 'mt-4 grid grid-cols-2 gap-4 xl:grid-cols-4'
                    : 'mt-4 flex flex-col gap-2'
                }
              >
                {WRITING_TEMPLATES.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    view={templateView}
                    onSelect={() => void actions.newFromTemplate(template)}
                  />
                ))}
              </div>
            </section>
          </div>

          {/* Continue Writing — the same documents, but as somewhere to return
              to rather than a list to manage. Hidden until there are any. */}
          {recent.length > 0 ? (
            <section
              aria-labelledby="noto-home-continue"
              className="border-default bg-surface mt-6 rounded-xl border p-5 shadow-sm sm:p-6"
            >
              <div className="flex items-center justify-between gap-4">
                <h2 id="noto-home-continue" className="text-primary text-h3">
                  Continue Writing
                </h2>
                <div className="flex items-center gap-1">
                  <IconButton
                    label="Scroll left"
                    variant="surface"
                    icon={<ChevronLeftIcon className="h-4 w-4" />}
                    onClick={() => scrollRail(-1)}
                  />
                  <IconButton
                    label="Scroll right"
                    variant="surface"
                    icon={<ChevronRightIcon className="h-4 w-4" />}
                    onClick={() => scrollRail(1)}
                  />
                </div>
              </div>

              {/*
               * A rail rather than a grid: these are the last few documents, in
               * order, and wrapping them into rows would turn "where was I" into
               * something to read left-to-right-and-down.
               */}
              <div
                ref={railRef}
                className="noto-scroll-x -mx-1 mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2"
              >
                {recent.slice(0, 10).map((document) => (
                  <DocumentCard
                    key={document.id}
                    document={document}
                    onOpen={() => operations.open(document.id)}
                    actions={menuFor(document)}
                    className="w-60 shrink-0 snap-start"
                  />
                ))}

                <button
                  type="button"
                  onClick={() => navigate('documents')}
                  className="border-default text-tertiary hover:border-brand hover:text-brand-strong focus-visible:outline-brand flex w-40 shrink-0 snap-start flex-col items-center justify-center gap-2 rounded-lg border border-dashed transition-colors focus-visible:outline-2"
                >
                  <ArrowRightIcon className="h-5 w-5" />
                  <span className="text-body-sm font-medium">All documents</span>
                </button>
              </div>
            </section>
          ) : null}
        </div>
      </div>

      {operations.dialogs}
    </main>
  );
}
