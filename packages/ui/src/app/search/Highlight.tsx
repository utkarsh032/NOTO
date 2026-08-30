import { useMemo } from 'react';

export interface HighlightProps {
  text: string;
  /** The words to mark. Empty leaves the text alone. */
  query: string;
  /** Trims the text to a window around the first match. */
  snippet?: boolean;
}

/** Characters of context kept either side of a match in a snippet. */
const CONTEXT = 60;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The matched words, marked.
 *
 * `mark` rather than a styled span: it is what the element is for, and it means
 * a screen reader can announce the match as one. The highlight is a warning
 * tint in both themes for the same reason the editor's find uses it — green
 * would read as a status, and this is not one.
 */
export function Highlight({ text, query, snippet = false }: HighlightProps) {
  const terms = useMemo(
    () =>
      query
        .trim()
        .split(/\s+/)
        .filter((term) => term.length > 1)
        .map(escapeRegExp),
    [query],
  );

  const source = useMemo(() => {
    if (!snippet || terms.length === 0) return text;

    /* Start the snippet a little before the first match, not at the top. */
    const first = new RegExp(terms.join('|'), 'i').exec(text);
    if (!first || first.index < CONTEXT) return text;

    return `…${text.slice(Math.max(0, first.index - CONTEXT))}`;
  }, [text, terms, snippet]);

  if (terms.length === 0) return <>{source}</>;

  /* Splitting on a capturing group puts the matches at the odd indices, which
     is what marks them — testing each part again would be a second, stateful
     pass over a global regular expression. */
  const parts = source.split(new RegExp(`(${terms.join('|')})`, 'gi'));

  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <mark key={index} className="bg-warning/25 text-primary rounded-[2px] px-0.5">
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
}
