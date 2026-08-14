import { describe, expect, it } from 'vitest';

import { fixedClock } from './clock';
import {
  EMPTY_DOCUMENT_CONTENT,
  archiveDocument,
  createDocument,
  deleteDocument,
  isDeleted,
  updateDocument,
} from './documents';

const CREATED_AT = '2026-08-13T10:00:00.000Z';
const UPDATED_AT = '2026-08-13T11:30:00.000Z';

let counter = 0;
const deps = {
  clock: fixedClock(CREATED_AT),
  generateId: () => `id-${(counter += 1)}`,
};

const doc = (text: string) => ({
  type: 'doc' as const,
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

describe('createDocument', () => {
  it('starts as an untitled draft with empty content', () => {
    const document = createDocument({ workspaceId: 'ws-1' }, deps);

    expect(document.title).toBe('Untitled');
    expect(document.status).toBe('draft');
    expect(document.content).toEqual(EMPTY_DOCUMENT_CONTENT);
    expect(document.folderId).toBeNull();
    expect(document.wordCount).toBe(0);
    expect(document.excerpt).toBe('');
    expect(document.createdAt).toBe(CREATED_AT);
    expect(document.updatedAt).toBe(CREATED_AT);
    expect(document.deletedAt).toBeNull();
  });

  it('derives excerpt and word count from supplied content', () => {
    const document = createDocument({ workspaceId: 'ws-1', content: doc('one two three') }, deps);

    expect(document.wordCount).toBe(3);
    expect(document.excerpt).toBe('one two three');
  });

  it('trims a blank title back to the untitled placeholder', () => {
    expect(createDocument({ workspaceId: 'ws-1', title: '   ' }, deps).title).toBe('Untitled');
  });
});

describe('updateDocument', () => {
  it('recomputes derived fields and the update timestamp', () => {
    const document = createDocument({ workspaceId: 'ws-1' }, deps);
    const updated = updateDocument(
      document,
      { content: doc('alpha beta') },
      {
        clock: fixedClock(UPDATED_AT),
      },
    );

    expect(updated.wordCount).toBe(2);
    expect(updated.excerpt).toBe('alpha beta');
    expect(updated.updatedAt).toBe(UPDATED_AT);
    expect(updated.createdAt).toBe(CREATED_AT);
  });

  it('promotes a draft to active once it has content', () => {
    const document = createDocument({ workspaceId: 'ws-1' }, deps);
    expect(document.status).toBe('draft');

    expect(updateDocument(document, { content: doc('now it has words') }, deps).status).toBe(
      'active',
    );
  });

  it('leaves an empty draft as a draft', () => {
    const document = createDocument({ workspaceId: 'ws-1' }, deps);
    expect(updateDocument(document, { title: 'Named but empty' }, deps).status).toBe('draft');
  });

  it('does not mutate the original document', () => {
    const document = createDocument({ workspaceId: 'ws-1' }, deps);
    updateDocument(document, { title: 'Changed' }, deps);

    expect(document.title).toBe('Untitled');
  });
});

describe('archiveDocument / deleteDocument', () => {
  it('archives without deleting', () => {
    const document = archiveDocument(createDocument({ workspaceId: 'ws-1' }, deps), deps);

    expect(document.status).toBe('archived');
    expect(isDeleted(document)).toBe(false);
  });

  it('soft-deletes by writing a tombstone rather than dropping the record', () => {
    const document = deleteDocument(createDocument({ workspaceId: 'ws-1' }, deps), {
      clock: fixedClock(UPDATED_AT),
    });

    expect(document.deletedAt).toBe(UPDATED_AT);
    expect(isDeleted(document)).toBe(true);
  });
});
