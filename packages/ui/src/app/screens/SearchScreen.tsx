import { useEffect, useMemo, useState } from 'react';

import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { IconButton } from '../../components/IconButton';
import { SearchInput } from '../../components/SearchInput';
import { Tabs } from '../../components/Tabs';
import { showToast } from '../../components/toast-store';
import { CopyIcon, ExternalLinkIcon, SparklesIcon } from '../../components/icons';
import { SearchIllustration } from '../../components/illustrations';
import { cn } from '../../utils/cn';
import { PageContainer } from '../PageContainer';
import { useMemory } from '../memory/use-memory';
import { SearchResultRow } from '../search/SearchResultRow';
import { matchesScope, useSearch, type SearchScope } from '../search/use-search';
import { replaceRoute } from '../router';
import { useDebouncedValue } from '../use-debounced-value';
import { useNotoActions } from '../use-noto-actions';

export interface SearchScreenProps {
  /** The query carried in the address, so a search can be linked to. */
  query?: string;
  onAskAI(): void;
}

const SCOPES: { value: SearchScope; label: string }[] = [
  { value: 'all', label: 'All Results' },
  { value: 'documents', label: 'Documents' },
  { value: 'memory', label: 'Noto Memory' },
  { value: 'clipboard', label: 'Clipboard' },
  { value: 'image', label: 'Images' },
  { value: 'link', label: 'Links' },
  { value: 'file', label: 'Files' },
];

/**
 * Search.
 *
 * One field over everything Noto holds, with the best few results lifted out of
 * the list. The sections below are the same results grouped by where they live,
 * so the answer to "was that a note or a document" is on the screen rather than
 * something to go and check.
 */
export function SearchScreen({ query: routeQuery, onAskAI }: SearchScreenProps) {
  const [text, setText] = useState(routeQuery ?? '');
  const [scope, setScope] = useState<SearchScope>('all');

  const actions = useNotoActions();
  const memory = useMemory();

  /* The list is filtered on the settled value; the field never waits. */
  const query = useDebouncedValue(text);
  const results = useSearch(query, memory.items);

  /* The address carries the query so a search can be shared or reloaded. */
  useEffect(() => {
    if (query.trim() === '') return;
    replaceRoute({ name: 'search', param: query });
  }, [query]);

  const visible = useMemo(
    () => results.hits.filter((hit) => matchesScope(hit, scope)),
    [results.hits, scope],
  );

  const top = scope === 'all' ? results.top : [];
  const rest = scope === 'all' ? visible.slice(top.length) : visible;

  const openHit = (hitId: string) => {
    const hit = results.hits.find((candidate) => candidate.id === hitId);
    if (!hit) return;

    if (hit.document) {
      actions.openDocument(hit.document.id);
      return;
    }

    if (hit.item?.url) {
      window.open(hit.item.url, '_blank', 'noopener,noreferrer');
      return;
    }

    void navigator.clipboard
      ?.writeText(hit.body)
      .then(() => showToast('Copied to clipboard', { tone: 'success' }));
  };

  return (
    <PageContainer
      title="Search"
      subtitle="Everything you have written and captured, in one place."
      asideLabel="Search filters and summary"
      aside={
        <div className="flex flex-col gap-6">
          <AISummary query={query} count={results.hits.length} onAsk={onAskAI} />

          <section>
            <h2 className="text-tertiary text-caption mb-2 px-1 tracking-wide uppercase">Type</h2>
            <div className="flex flex-col gap-0.5">
              {SCOPES.map((entry) => (
                <button
                  key={entry.value}
                  type="button"
                  onClick={() => setScope(entry.value)}
                  aria-pressed={scope === entry.value}
                  className={cn(
                    'text-body-sm flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors',
                    'focus-visible:outline-brand focus-visible:outline-2',
                    scope === entry.value
                      ? 'bg-brand-soft text-brand-strong font-medium'
                      : 'text-secondary hover:bg-surface-secondary hover:text-primary',
                  )}
                >
                  <span className="min-w-0 flex-1 truncate text-left">{entry.label}</span>
                  <span className="text-tertiary text-caption tabular-nums">
                    {results.countsByScope[entry.value]}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-tertiary text-caption mb-2 px-1 tracking-wide uppercase">Tags</h2>
            <TagCloud tags={results.hits.flatMap((hit) => hit.tags)} onSelect={setText} />
          </section>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <SearchInput
          autoFocus
          value={text}
          onValueChange={setText}
          label="Search notes, docs, memory"
          placeholder="Search notes, docs, memory…"
          inputSize="lg"
        />

        <Tabs
          label="Filter results"
          value={scope}
          onChange={setScope}
          items={SCOPES.map((entry) => ({
            value: entry.value,
            label: entry.label,
            count: query.trim() === '' ? undefined : results.countsByScope[entry.value],
          }))}
        />

        {query.trim() === '' ? (
          <EmptyState
            title="What are you looking for?"
            description="Search across your documents, quick notes, clipboard history, links and files at once."
            illustration={<SearchIllustration />}
            className="border-default bg-surface rounded-xl border py-16"
          />
        ) : visible.length === 0 ? (
          <EmptyState
            title={`No results for “${query}”`}
            description="Check the spelling, or try a single distinctive word — Noto matches text exactly."
            illustration={<SearchIllustration />}
            className="border-default bg-surface rounded-xl border py-16"
          />
        ) : (
          <>
            {top.length > 0 ? (
              <section aria-labelledby="noto-search-top">
                <h2
                  id="noto-search-top"
                  className="text-tertiary text-caption mb-2 tracking-wide uppercase"
                >
                  Top matches
                </h2>
                <div className="flex flex-col gap-2">
                  {top.map((hit) => (
                    <SearchResultRow
                      key={hit.id}
                      emphasised
                      hit={hit}
                      query={query}
                      onOpen={() => openHit(hit.id)}
                      actions={<HitActions hit={hit} />}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            {rest.length > 0 ? (
              <section aria-labelledby="noto-search-rest">
                <h2
                  id="noto-search-rest"
                  className="text-tertiary text-caption mb-2 tracking-wide uppercase"
                >
                  {scope === 'all'
                    ? 'All results'
                    : SCOPES.find((entry) => entry.value === scope)?.label}
                </h2>
                <div className="flex flex-col gap-2">
                  {rest.map((hit) => (
                    <SearchResultRow
                      key={hit.id}
                      hit={hit}
                      query={query}
                      onOpen={() => openHit(hit.id)}
                      actions={<HitActions hit={hit} />}
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>
    </PageContainer>
  );
}

function HitActions({ hit }: { hit: { body: string; item?: { url: string | null } } }) {
  return (
    <div className="flex items-center gap-0.5 opacity-0 transition group-hover/hit:opacity-100 focus-within:opacity-100">
      <IconButton
        label="Copy text"
        size="sm"
        icon={<CopyIcon className="h-4 w-4" />}
        onClick={() =>
          void navigator.clipboard
            ?.writeText(hit.body)
            .then(() => showToast('Copied to clipboard', { tone: 'success' }))
        }
      />
      {hit.item?.url ? (
        <IconButton
          label="Open link"
          size="sm"
          icon={<ExternalLinkIcon className="h-4 w-4" />}
          onClick={() => window.open(hit.item!.url!, '_blank', 'noopener,noreferrer')}
        />
      ) : null}
    </div>
  );
}

interface AISummaryProps {
  query: string;
  count: number;
  onAsk(): void;
}

/**
 * The AI summary card.
 *
 * Deliberately below the results in importance and above them in nothing: it
 * reports what the search actually found rather than inventing prose about it,
 * and says plainly that no model is connected. An assistant that made up a
 * summary of your own notes would be the least trustworthy thing in Noto.
 */
function AISummary({ query, count, onAsk }: AISummaryProps) {
  return (
    <section className="border-ai/20 bg-ai-soft rounded-xl border p-4">
      <div className="flex items-center gap-2">
        <SparklesIcon className="text-ai h-4 w-4" />
        <h2 className="text-primary text-body-sm font-semibold">AI Summary</h2>
        <Badge tone="ai" className="ml-auto">
          Preview
        </Badge>
      </div>

      {query.trim() === '' ? (
        <p className="text-secondary text-caption mt-2">
          Search for something and Noto will summarise what it found across your notes and
          documents.
        </p>
      ) : (
        <>
          <p className="text-secondary text-caption mt-2">
            {count === 0
              ? `Nothing in this workspace mentions “${query}”.`
              : `“${query}” appears in ${count} ${count === 1 ? 'place' : 'places'} across your documents and memory.`}
          </p>
          <ul className="text-secondary text-caption mt-2 list-disc space-y-1 pl-4">
            <li>Results are ranked by where the words appear, titles first.</li>
            <li>Nothing has been sent anywhere — this ran on your device.</li>
          </ul>
        </>
      )}

      <Button
        variant="secondary"
        size="sm"
        onClick={onAsk}
        leading={<SparklesIcon className="h-4 w-4" />}
        className="border-ai/30 text-ai hover:bg-ai/5 mt-3 w-full"
      >
        Ask AI Assistant
      </Button>
    </section>
  );
}

function TagCloud({ tags, onSelect }: { tags: string[]; onSelect(tag: string): void }) {
  const unique = useMemo(() => [...new Set(tags)].slice(0, 12), [tags]);

  if (unique.length === 0) {
    return <p className="text-tertiary text-caption px-1">Tags on your results appear here.</p>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {unique.map((tag) => (
        <button
          key={tag}
          type="button"
          onClick={() => onSelect(tag)}
          className="border-default text-secondary hover:border-brand hover:text-brand-strong text-caption focus-visible:outline-brand rounded-full border px-2.5 py-1 transition-colors focus-visible:outline-2"
        >
          #{tag}
        </button>
      ))}
    </div>
  );
}
