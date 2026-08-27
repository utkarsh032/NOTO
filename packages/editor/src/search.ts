import { type Editor, Extension } from '@tiptap/core';
import {
  SearchQuery,
  findNext,
  findPrev,
  getSearchState,
  replaceAll,
  replaceCurrent,
  replaceNext,
  search,
  setSearchState,
} from 'prosemirror-search';

/**
 * Find and replace, on top of ProseMirror's own search plugin.
 *
 * The plugin holds the query in editor state and decorates the matches, which
 * is the part worth not reimplementing: highlights survive editing, and the
 * positions stay correct as the document changes underneath them. Everything
 * here is the layer above — turning a query into editor state, stepping through
 * matches, and counting them for the "3 of 12" the find bar shows.
 *
 * Matches are decorated with `ProseMirror-search-match`, and the one the caret
 * is on with `ProseMirror-active-search-match`; both are styled in the app
 * stylesheet alongside the rest of the prose.
 */

/** Stops counting runaway match sets. A find bar cannot show ten thousand. */
export const MATCH_COUNT_LIMIT = 500;

export interface SearchCriteria {
  term: string;
  replace?: string;
  caseSensitive?: boolean;
}

export interface SearchStatus {
  term: string;
  /** Matches in the document, capped at `MATCH_COUNT_LIMIT`. */
  total: number;
  /** 1-based position of the match the selection is on, or 0 when on none. */
  current: number;
  /** `true` when counting stopped at the cap and there are more. */
  capped: boolean;
}

export const EMPTY_SEARCH_STATUS: SearchStatus = {
  term: '',
  total: 0,
  current: 0,
  capped: false,
};

/** Registers the search plugin. The editor carries the query in its own state. */
export const NotoSearch = Extension.create({
  name: 'notoSearch',

  addProseMirrorPlugins() {
    return [search()];
  },
});

function buildQuery({ term, replace = '', caseSensitive = false }: SearchCriteria): SearchQuery {
  return new SearchQuery({
    search: term,
    replace,
    caseSensitive,
    /*
     * Literal, so a term is matched exactly as typed. Without it `\n` in the
     * find field would become a newline and `(` would still be a paren but a
     * user typing a regular expression would get a surprise either way — Noto
     * offers plain-text find, so it should behave like one.
     */
    literal: true,
  });
}

/**
 * Puts `criteria` into the editor's search state.
 *
 * Dispatched without touching the selection or the document, so typing in the
 * find field re-highlights without moving the caret or entering the undo
 * history.
 */
export function setSearchCriteria(editor: Editor | null, criteria: SearchCriteria): void {
  if (!editor) return;

  const { state, view } = editor;
  view.dispatch(setSearchState(state.tr, buildQuery(criteria)));
}

/** Clears the query, removing every highlight. */
export function clearSearch(editor: Editor | null): void {
  if (!editor) return;

  const { state, view } = editor;
  view.dispatch(setSearchState(state.tr, new SearchQuery({ search: '' })));
}

/** Runs one of the plugin's commands against the editor. */
function run(editor: Editor | null, command: typeof findNext): boolean {
  if (!editor) return false;
  return command(editor.state, editor.view.dispatch, editor.view);
}

export const findNextMatch = (editor: Editor | null): boolean => run(editor, findNext);
export const findPreviousMatch = (editor: Editor | null): boolean => run(editor, findPrev);

/**
 * Replaces the match under the caret and moves to the next one.
 *
 * ProseMirror's `replaceNext` only replaces a match that is already selected,
 * and merely selects one when none is. That makes the first press of a Replace
 * button do nothing visible, which reads as a broken button — so a match is
 * landed on first when the caret is not already on one.
 */
export function replaceNextMatch(editor: Editor | null): boolean {
  if (!editor) return false;

  if (readSearchStatus(editor).current === 0) findNext(editor.state, editor.view.dispatch);
  return run(editor, replaceNext);
}

/** Replaces the match under the caret and stays on it. */
export const replaceCurrentMatch = (editor: Editor | null): boolean => run(editor, replaceCurrent);

export const replaceAllMatches = (editor: Editor | null): boolean => run(editor, replaceAll);

/**
 * Counts the matches, and works out which one the selection is sitting on.
 *
 * ProseMirror's plugin decorates matches but does not tally them, so this walks
 * the document with the same query. Each step starts after the previous match
 * ended — and at least one position further on, so a query that can match an
 * empty range cannot spin.
 */
export function readSearchStatus(editor: Editor | null): SearchStatus {
  if (!editor) return EMPTY_SEARCH_STATUS;

  const searchState = getSearchState(editor.state);
  const query = searchState?.query;
  if (!query || !query.valid) return EMPTY_SEARCH_STATUS;

  const { selection } = editor.state;

  let total = 0;
  let current = 0;
  let capped = false;
  let position = 0;

  for (;;) {
    const match = query.findNext(editor.state, position);
    if (!match) break;

    total += 1;
    if (match.from === selection.from && match.to === selection.to) current = total;

    if (total >= MATCH_COUNT_LIMIT) {
      capped = query.findNext(editor.state, Math.max(match.to, match.from + 1)) !== null;
      break;
    }

    position = Math.max(match.to, match.from + 1);
  }

  return { term: query.search, total, current, capped };
}
