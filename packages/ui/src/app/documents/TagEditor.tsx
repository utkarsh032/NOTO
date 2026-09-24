import type { NotoDocument } from '@noto/types';
import { useId, useMemo, useState } from 'react';

import { CloseIcon } from '../../components/icons';
import { useNotoData } from '../data-context';
import { addTags } from './tags';

/**
 * A document's tags, editable where they are shown.
 *
 * Enter or a comma adds what was typed; the cross on a tag removes it. Tags
 * already used elsewhere in the workspace are offered as the field is typed
 * into, so "project" does not become "projects" by accident.
 */
export function TagEditor({ document }: { document: NotoDocument }) {
  const { documents, updateDocument } = useNotoData();
  const [draft, setDraft] = useState('');
  const listId = useId();

  const suggestions = useMemo(() => {
    const own = new Set(document.tags.map((tag) => tag.toLowerCase()));
    const all = new Set<string>();
    for (const other of documents ?? []) {
      for (const tag of other.tags) if (!own.has(tag.toLowerCase())) all.add(tag);
    }
    return [...all].sort((a, b) => a.localeCompare(b));
  }, [documents, document.tags]);

  const commit = () => {
    const next = addTags(document.tags, draft);
    setDraft('');
    if (next.length !== document.tags.length) void updateDocument(document.id, { tags: next });
  };

  const remove = (tag: string) =>
    void updateDocument(document.id, { tags: document.tags.filter((other) => other !== tag) });

  return (
    <div>
      {document.tags.length > 0 ? (
        <ul className="mb-2 flex flex-wrap gap-1.5" aria-label="Tags">
          {document.tags.map((tag) => (
            <li
              key={tag}
              className="bg-surface-tertiary text-secondary text-caption flex items-center gap-1 rounded-full py-0.5 pr-1 pl-2.5 font-medium"
            >
              {tag}
              <button
                type="button"
                onClick={() => remove(tag)}
                aria-label={`Remove tag ${tag}`}
                className="text-tertiary hover:bg-surface hover:text-primary focus-visible:outline-brand flex h-4 w-4 items-center justify-center rounded-full focus-visible:outline-2"
              >
                <CloseIcon className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault();
            commit();
          }
          if (event.key === 'Backspace' && draft === '' && document.tags.length > 0) {
            remove(document.tags[document.tags.length - 1]!);
          }
        }}
        onBlur={() => {
          if (draft.trim() !== '') commit();
        }}
        list={listId}
        aria-label="Add a tag"
        placeholder={document.tags.length === 0 ? 'Add a tag…' : 'Add another…'}
        className="border-default bg-surface text-primary text-body-sm placeholder:text-disabled focus-visible:outline-brand w-full rounded-md border px-2.5 py-1.5 focus-visible:outline-2 focus-visible:-outline-offset-1"
      />
      <datalist id={listId}>
        {suggestions.map((tag) => (
          <option key={tag} value={tag} />
        ))}
      </datalist>
    </div>
  );
}
