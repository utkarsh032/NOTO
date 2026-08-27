import { formatShortcut } from '@noto/core';
import {
  clearSearch,
  findNextMatch,
  findPreviousMatch,
  replaceAllMatches,
  replaceNextMatch,
  setSearchCriteria,
} from '@noto/editor';
import { type Editor, useSearchStatus } from '@noto/editor/react';
import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '../components/Button';
import { fieldClasses } from '../components/field-styles';
import { ChevronDownIcon, ChevronUpIcon, CloseIcon } from '../components/icons';
import { cn } from '../utils/cn';
import { detectShortcutPlatform } from './use-command-shortcuts';

export interface FindReplaceBarProps {
  editor: Editor | null;
  /** Opens with the replace row showing. */
  showReplace: boolean;
  onToggleReplace(show: boolean): void;
  onClose(): void;
  className?: string;
}

/**
 * Find and replace within the open document.
 *
 * The query lives in the editor's own state, not here — that is what keeps
 * highlights correct while the document is edited underneath them. This
 * component owns the text in the fields and pushes it down; everything about
 * where the matches are comes back up from the editor.
 */
export function FindReplaceBar({
  editor,
  showReplace,
  onToggleReplace,
  onClose,
  className,
}: FindReplaceBarProps) {
  const [term, setTerm] = useState('');
  const [replacement, setReplacement] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);

  const status = useSearchStatus(editor);
  const platform = useMemo(() => detectShortcutPlatform(), []);
  const findRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    findRef.current?.select();
  }, []);

  /*
   * The query is pushed on every change rather than debounced: it is a
   * decoration pass over the visible document, and a find bar that lags behind
   * what has been typed feels broken in a way a saved keystroke cannot repay.
   */
  useEffect(() => {
    setSearchCriteria(editor, { term, replace: replacement, caseSensitive });
  }, [editor, term, replacement, caseSensitive]);

  /* Leaving the bar open with its highlights still on would be a lie. */
  useEffect(() => () => clearSearch(editor), [editor]);

  const hasTerm = term !== '';
  const noMatches = hasTerm && status.total === 0;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    findNextMatch(editor);
  };

  /*
   * Before anything is stepped to, the caret is wherever it was left and no
   * match is selected. Saying "1 of 3" then would point at a match the eye
   * cannot find, so the tally reports the total until there is a current one.
   */
  const more = status.capped ? '+' : '';
  const count = !hasTerm
    ? ''
    : status.total === 0
      ? 'No results'
      : status.current === 0
        ? `${status.total}${more} ${status.total === 1 ? 'match' : 'matches'}`
        : `${status.current} of ${status.total}${more}`;

  return (
    <div
      className={cn('border-default bg-surface-secondary border-b px-4 py-2 sm:px-6', className)}
      role="search"
      aria-label="Find in document"
    >
      <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
        <div className="relative flex min-w-56 flex-1 items-center">
          <input
            ref={findRef}
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;
              // Shift+Enter walks backwards, the convention everywhere else.
              if (!event.shiftKey) return;
              event.preventDefault();
              findPreviousMatch(editor);
            }}
            type="text"
            placeholder="Find"
            aria-label="Find"
            aria-invalid={noMatches || undefined}
            className={cn(fieldClasses('sm', noMatches), 'pr-24')}
          />
          <span
            className="text-tertiary text-caption pointer-events-none absolute right-3 tabular-nums"
            aria-live="polite"
          >
            {count}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <IconButton
            label="Find previous"
            hint={formatShortcut('CmdOrCtrl+Shift+G', platform)}
            disabled={!hasTerm}
            onClick={() => findPreviousMatch(editor)}
          >
            <ChevronUpIcon className="h-4 w-4" />
          </IconButton>
          <IconButton
            label="Find next"
            hint={formatShortcut('CmdOrCtrl+G', platform)}
            disabled={!hasTerm}
            onClick={() => findNextMatch(editor)}
          >
            <ChevronDownIcon className="h-4 w-4" />
          </IconButton>
        </div>

        <label className="text-secondary text-body-sm flex shrink-0 items-center gap-1.5">
          <input
            checked={caseSensitive}
            onChange={(event) => setCaseSensitive(event.target.checked)}
            type="checkbox"
            className="accent-brand h-4 w-4"
          />
          Match case
        </label>

        <Button
          size="sm"
          variant="ghost"
          onClick={() => onToggleReplace(!showReplace)}
          aria-expanded={showReplace}
        >
          {showReplace ? 'Hide replace' : 'Replace…'}
        </Button>

        <IconButton label="Close find" onClick={onClose}>
          <CloseIcon className="h-4 w-4" />
        </IconButton>
      </form>

      {showReplace ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            value={replacement}
            onChange={(event) => setReplacement(event.target.value)}
            type="text"
            placeholder="Replace with"
            aria-label="Replace with"
            className={cn(fieldClasses('sm'), 'min-w-56 flex-1')}
          />
          <Button
            size="sm"
            variant="secondary"
            disabled={!hasTerm || status.total === 0}
            onClick={() => replaceNextMatch(editor)}
          >
            Replace
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={!hasTerm || status.total === 0}
            onClick={() => replaceAllMatches(editor)}
          >
            Replace all
          </Button>
        </div>
      ) : null}
    </div>
  );
}

interface IconButtonProps {
  label: string;
  hint?: string;
  disabled?: boolean;
  onClick(): void;
  children: ReactNode;
}

function IconButton({ label, hint, disabled = false, onClick, children }: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={hint ? `${label} (${hint})` : label}
      className="text-tertiary hover:bg-surface hover:text-primary focus-visible:outline-brand flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:outline-2 focus-visible:-outline-offset-1 disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </button>
  );
}
