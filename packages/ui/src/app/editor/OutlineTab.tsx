import type { NotoDocument } from '@noto/types';
import { useMemo, useState } from 'react';

import { Dropdown } from '../../components/Dropdown';
import { IconButton } from '../../components/IconButton';
import { SearchInput } from '../../components/SearchInput';
import { ChevronDownIcon, ChevronRightIcon, FilterIcon } from '../../components/icons';
import { cn } from '../../utils/cn';
import {
  type OutlineNode,
  buildOutline,
  buildOutlineTree,
  scrollToHeading,
  useActiveHeading,
} from './outline';

/* -------------------------------------------------------------------------- */
/* Outline                                                                    */
/* -------------------------------------------------------------------------- */

/** How deep the outline goes. Anything deeper is folded out of the tree. */
const DEPTHS = [
  { id: '3', label: 'All levels' },
  { id: '2', label: 'Heading 1 and 2' },
  { id: '1', label: 'Heading 1 only' },
];

export function OutlineTab({ document }: { document: NotoDocument }) {
  const [query, setQuery] = useState('');
  const [depth, setDepth] = useState(3);
  const [collapsed, setCollapsed] = useState<ReadonlySet<number>>(() => new Set());

  const active = useActiveHeading(document.id);

  const entries = useMemo(() => buildOutline(document.content), [document.content]);

  /*
   * Searching flattens the tree deliberately. A match three levels down is
   * still a match, and hiding it behind a parent that does not match is the
   * one thing a search in a panel this size must not do.
   */
  const needle = query.trim().toLowerCase();
  const matches = useMemo(
    () =>
      needle === '' ? null : entries.filter((entry) => entry.text.toLowerCase().includes(needle)),
    [entries, needle],
  );

  const tree = useMemo(
    () => buildOutlineTree(entries.filter((entry) => entry.level <= depth)),
    [entries, depth],
  );

  const toggle = (index: number) =>
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (!next.delete(index)) next.add(index);
      return next;
    });

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1.5 px-1">
        <SearchInput
          value={query}
          onValueChange={setQuery}
          label="Search in document"
          inputSize="sm"
          className="min-w-0 flex-1"
        />
        <Dropdown
          label="Outline depth"
          items={DEPTHS.map((option) => ({
            id: option.id,
            label: option.label,
            trailing: String(depth) === option.id ? '✓' : undefined,
            onSelect: () => setDepth(Number(option.id)),
          }))}
          trigger={(triggerProps) => (
            <IconButton
              {...triggerProps}
              label="Outline depth"
              variant="surface"
              icon={<FilterIcon className="h-4 w-4" />}
              isActive={depth < 3}
            />
          )}
        />
      </div>

      {entries.length === 0 ? (
        <p className="text-tertiary text-body-sm px-1 pt-4">
          Headings you add appear here, as a way to move around a long document.
        </p>
      ) : (
        <nav aria-label="Document outline" className="mt-3 min-w-0">
          {/* The title is the root of the map, not an entry in it: it is what
              the headings below are headings of. */}
          <p className="text-primary text-body-sm flex items-center gap-1 truncate px-1 pb-1 font-semibold">
            <ChevronDownIcon className="text-tertiary h-4 w-4 shrink-0" aria-hidden="true" />
            {document.title || 'Untitled'}
          </p>

          {matches ? (
            matches.length === 0 ? (
              <p className="text-tertiary text-body-sm px-2 py-2">No heading matches “{query}”.</p>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {matches.map((entry) => (
                  <li key={entry.index}>
                    <OutlineRow entry={entry} depth={0} isActive={entry.index === active} />
                  </li>
                ))}
              </ul>
            )
          ) : (
            <OutlineBranch
              nodes={tree}
              depth={0}
              active={active}
              collapsed={collapsed}
              onToggle={toggle}
            />
          )}
        </nav>
      )}
    </div>
  );
}

interface OutlineBranchProps {
  nodes: OutlineNode[];
  depth: number;
  active: number;
  collapsed: ReadonlySet<number>;
  onToggle(index: number): void;
}

function OutlineBranch({ nodes, depth, active, collapsed, onToggle }: OutlineBranchProps) {
  return (
    <ul className="flex flex-col gap-0.5">
      {nodes.map((node) => {
        const isCollapsed = collapsed.has(node.index);

        return (
          <li key={node.index}>
            <OutlineRow
              entry={node}
              depth={depth}
              isActive={node.index === active}
              hasChildren={node.children.length > 0}
              isCollapsed={isCollapsed}
              onToggle={() => onToggle(node.index)}
            />

            {node.children.length > 0 && !isCollapsed ? (
              <OutlineBranch
                nodes={node.children}
                depth={depth + 1}
                active={active}
                collapsed={collapsed}
                onToggle={onToggle}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

interface OutlineRowProps {
  entry: { index: number; text: string };
  depth: number;
  isActive: boolean;
  hasChildren?: boolean;
  isCollapsed?: boolean;
  onToggle?(): void;
}

function OutlineRow({
  entry,
  depth,
  isActive,
  hasChildren = false,
  isCollapsed = false,
  onToggle,
}: OutlineRowProps) {
  return (
    <div
      className={cn(
        'group/row flex items-center rounded-md transition-colors',
        isActive ? 'bg-brand-soft' : 'hover:bg-surface-secondary',
      )}
      style={{ paddingLeft: `${depth * 12}px` }}
    >
      {/* The twisty is a control of its own, so folding a section does not also
          scroll the document to it. */}
      {hasChildren ? (
        <button
          type="button"
          onClick={onToggle}
          aria-label={isCollapsed ? `Expand ${entry.text}` : `Collapse ${entry.text}`}
          aria-expanded={!isCollapsed}
          className="text-tertiary hover:text-primary focus-visible:outline-brand flex h-7 w-5 shrink-0 items-center justify-center rounded-sm focus-visible:outline-2 focus-visible:-outline-offset-1"
        >
          {isCollapsed ? (
            <ChevronRightIcon className="h-4 w-4" />
          ) : (
            <ChevronDownIcon className="h-4 w-4" />
          )}
        </button>
      ) : (
        <span className="w-5 shrink-0" aria-hidden="true" />
      )}

      <button
        type="button"
        onClick={() => scrollToHeading(entry.index)}
        aria-current={isActive ? 'true' : undefined}
        title={entry.text}
        className={cn(
          'text-body-sm focus-visible:outline-brand min-w-0 flex-1 truncate py-1.5 pr-2 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2',
          isActive
            ? 'text-brand-strong font-medium'
            : 'text-secondary group-hover/row:text-primary',
        )}
      >
        {entry.text}
      </button>
    </div>
  );
}
