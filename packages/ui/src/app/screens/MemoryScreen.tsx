import type { MemoryItem, MemoryKind } from '@noto/types';
import { useEffect, useMemo } from 'react';

import { EmptyState } from '../../components/EmptyState';
import { SearchInput } from '../../components/SearchInput';
import { Tabs } from '../../components/Tabs';
import { showToast } from '../../components/toast-store';
import { PinIcon } from '../../components/icons';
import { SearchIllustration } from '../../components/illustrations';
import { memoryStorageBytes } from '../../mock/memory';
import { cn } from '../../utils/cn';
import { formatBytes, isWithinDays } from '../../utils/format';
import { PageContainer } from '../PageContainer';
import { MemoryCard } from '../memory/MemoryCard';
import { MEMORY_KINDS, MEMORY_KIND_ORDER } from '../memory/memory-kinds';
import { useMemory } from '../memory/use-memory';
import { navigate } from '../router';
import { useNotoActions } from '../use-noto-actions';

export interface MemoryScreenProps {
  /** The kind named by the route — Quick Notes and Clipboard History arrive here. */
  kind?: string;
}

/** The date filter's options, as spans rather than as moments. */
const DATE_FILTERS: { label: string; days: number | null }[] = [
  { label: 'Any time', days: null },
  { label: 'Today', days: 1 },
  { label: 'This week', days: 7 },
  { label: 'This month', days: 30 },
];

function asKind(value: string | undefined): MemoryKind | 'all' {
  if (!value) return 'all';
  return MEMORY_KIND_ORDER.includes(value as MemoryKind) ? (value as MemoryKind) : 'all';
}

/**
 * Noto Memory.
 *
 * Everything Noto has captured, in one list, filtered by kind rather than split
 * across screens. The title changes with the filter, because arriving here from
 * "Clipboard History" and being told you are in "Noto Memory" is a small lie
 * about where the click went.
 */
export function MemoryScreen({ kind }: MemoryScreenProps) {
  const routeKind = asKind(kind);
  const memory = useMemory(routeKind);
  const actions = useNotoActions();

  /*
   * The address is the filter: arriving from Clipboard History in the sidebar
   * sets the type here. Depends on `setQuery` rather than on `memory`, which is
   * rebuilt whenever the list changes — including by this very effect.
   */
  const { setQuery } = memory;
  useEffect(() => {
    setQuery({ kind: routeKind });
  }, [routeKind, setQuery]);

  const active = memory.query.kind;

  const title =
    active === 'note'
      ? 'Quick Notes'
      : active === 'clipboard'
        ? 'Clipboard History'
        : 'Noto Memory';

  const subtitle =
    active === 'note'
      ? 'Every note you jotted down without opening a document.'
      : active === 'clipboard'
        ? 'What you have copied, kept for when you need it back.'
        : "All the things you've captured and saved across Noto.";

  const pinned = useMemo(() => memory.items.filter((item) => item.isPinned), [memory.items]);
  const thisWeek = useMemo(
    () => memory.items.filter((item) => isWithinDays(item.updatedAt, 7)),
    [memory.items],
  );

  const copy = (item: MemoryItem) => {
    void navigator.clipboard
      ?.writeText(item.content)
      .then(() => showToast('Copied to clipboard', { tone: 'success' }))
      .catch(() => showToast('Noto could not reach the clipboard.', { tone: 'error' }));
  };

  return (
    <PageContainer
      title={title}
      subtitle={subtitle}
      asideLabel="Memory filters"
      aside={
        <div className="flex flex-col gap-6">
          <section>
            <h2 className="text-tertiary text-caption mb-2 px-1 tracking-wide uppercase">Date</h2>
            <div className="flex flex-col gap-0.5">
              {DATE_FILTERS.map((option) => {
                const isActive = (memory.query.sinceDays ?? null) === option.days;

                return (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => memory.setQuery({ sinceDays: option.days })}
                    aria-pressed={isActive}
                    className={cn(
                      'text-body-sm focus-visible:outline-brand rounded-md px-2 py-1.5 text-left transition-colors focus-visible:outline-2',
                      isActive
                        ? 'bg-brand-soft text-brand-strong font-medium'
                        : 'text-secondary hover:bg-surface-secondary hover:text-primary',
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <h2 className="text-tertiary text-caption mb-2 px-1 tracking-wide uppercase">Type</h2>
            <div className="flex flex-col gap-0.5">
              {MEMORY_KIND_ORDER.map((entry) => {
                const info = MEMORY_KINDS[entry];
                const isActive = active === entry;

                return (
                  <button
                    key={entry}
                    type="button"
                    onClick={() =>
                      navigate({ name: 'memory', param: isActive ? undefined : entry })
                    }
                    aria-pressed={isActive}
                    className={cn(
                      'text-body-sm flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors',
                      'focus-visible:outline-brand focus-visible:outline-2',
                      isActive
                        ? 'bg-brand-soft text-brand-strong font-medium'
                        : 'text-secondary hover:bg-surface-secondary hover:text-primary',
                    )}
                  >
                    <span className="text-tertiary shrink-0">{info.icon('h-4 w-4')}</span>
                    <span className="min-w-0 flex-1 truncate text-left">{info.plural}</span>
                    <span className="text-tertiary text-caption tabular-nums">
                      {memory.countsByKind[entry]}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <h2 className="text-tertiary text-caption mb-2 px-1 tracking-wide uppercase">
              Memory summary
            </h2>
            <dl className="border-default bg-surface flex flex-col gap-2.5 rounded-xl border p-4">
              <SummaryRow label="Total items" value={memory.items.length.toLocaleString()} />
              <SummaryRow label="Pinned" value={pinned.length.toLocaleString()} />
              <SummaryRow label="This week" value={thisWeek.length.toLocaleString()} />
              <SummaryRow
                label="Storage used"
                value={formatBytes(memoryStorageBytes(memory.items))}
              />
            </dl>
          </section>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <SearchInput
          value={memory.query.text}
          onValueChange={(text) => memory.setQuery({ text })}
          label="Search your memory"
          placeholder="Search your memory anything…"
          inputSize="lg"
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs
            label="Filter memory by type"
            value={active}
            onChange={(next) =>
              navigate({ name: 'memory', param: next === 'all' ? undefined : next })
            }
            items={[
              { value: 'all' as const, label: 'All', count: memory.countsByKind.all },
              ...MEMORY_KIND_ORDER.map((entry) => ({
                value: entry,
                label: MEMORY_KINDS[entry].plural,
                count: memory.countsByKind[entry],
              })),
            ]}
            className="min-w-0 flex-1 border-b-0"
          />

          <button
            type="button"
            onClick={() => memory.setQuery({ pinnedOnly: !memory.query.pinnedOnly })}
            aria-pressed={memory.query.pinnedOnly}
            className={cn(
              'text-body-sm focus-visible:outline-brand flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2.5 font-medium transition-colors focus-visible:outline-2',
              memory.query.pinnedOnly
                ? 'border-brand bg-brand-soft text-brand-strong'
                : 'border-default text-secondary hover:border-strong hover:text-primary',
            )}
          >
            <PinIcon className="h-4 w-4" />
            Pinned
          </button>
        </div>

        {memory.results.length === 0 ? (
          <EmptyState
            title={memory.query.text ? 'Nothing matches that' : 'Nothing captured yet'}
            description={
              memory.query.text
                ? 'Try fewer words — Memory searches titles, content, sources and tags.'
                : 'Notes, clipboard entries, screenshots and links you capture will collect here.'
            }
            illustration={<SearchIllustration />}
            className="border-default bg-surface rounded-xl border py-16"
          />
        ) : (
          /*
           * A plain grid at this size. The cards are variable height, which a
           * fixed-row virtual list cannot hold, and the honest answer for tens
           * of thousands of items is paging this list from the repository
           * rather than rendering them all and windowing afterwards — which is
           * why the count is shown: it is the number this screen has, not the
           * number Memory holds.
           */
          <>
            <p className="text-tertiary text-caption" role="status">
              {memory.results.length.toLocaleString()} of {memory.items.length.toLocaleString()}{' '}
              items
            </p>

            <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {memory.results.map((item) => (
                <MemoryCard
                  key={item.id}
                  item={item}
                  onCopy={() => copy(item)}
                  onTogglePin={() => memory.togglePin(item)}
                  onOpenInDocument={() =>
                    void actions
                      .importDocument({
                        title: item.title,
                        content: {
                          type: 'doc',
                          content: item.content
                            .split('\n')
                            .map((line) =>
                              line.trim() === ''
                                ? { type: 'paragraph' }
                                : { type: 'paragraph', content: [{ type: 'text', text: line }] },
                            ),
                        },
                      })
                      .then(() => showToast('Saved as a document', { tone: 'success' }))
                  }
                  onDelete={() => {
                    memory.remove(item.id);
                    showToast('Removed from Memory');
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </PageContainer>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-tertiary text-caption">{label}</dt>
      <dd className="text-primary text-body-sm font-medium tabular-nums">{value}</dd>
    </div>
  );
}
