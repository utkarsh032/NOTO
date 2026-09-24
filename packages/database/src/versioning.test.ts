import { createDocument, updateDocument } from '@noto/core';
import { beforeEach, describe, expect, it } from 'vitest';

import { InMemoryDatabase } from './memory';
import { recordVersion, snapshotBeforeChange } from './versioning';

const body = (text: string) => ({
  type: 'doc' as const,
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

const at = (iso: string) => () => new Date(iso);

describe('versioning', () => {
  let db: InMemoryDatabase;
  const original = createDocument({ workspaceId: 'w1', title: 'Plan', content: body('First') });

  beforeEach(async () => {
    db = new InMemoryDatabase();
    await db.documents.put(original);
  });

  it('keeps the text a document rested in before it changes', async () => {
    const edited = updateDocument(original, { content: body('Second') });

    const kept = await snapshotBeforeChange(db, original, edited, {
      now: at('2026-09-23T10:00:00Z'),
    });

    expect(kept?.contentHash).toBeDefined();
    expect(kept?.content).toEqual(body('First'));
    expect(kept?.origin).toBe('autosave');
  });

  it('keeps nothing more until the interval has passed', async () => {
    const second = updateDocument(original, { content: body('Second') });
    const third = updateDocument(second, { content: body('Third') });
    const fourth = updateDocument(third, { content: body('Fourth') });

    await snapshotBeforeChange(db, original, second, { now: at('2026-09-23T10:00:00Z') });
    await snapshotBeforeChange(db, second, third, { now: at('2026-09-23T10:05:00Z') });
    expect(await db.versions.listByDocument(original.id)).toHaveLength(1);

    await snapshotBeforeChange(db, third, fourth, { now: at('2026-09-23T10:11:00Z') });
    const versions = await db.versions.listByDocument(original.id);
    expect(versions.map((version) => version.content)).toEqual([body('Third'), body('First')]);
  });

  it('ignores edits that do not touch the body', async () => {
    const renamed = updateDocument(original, { title: 'Renamed' });
    expect(await snapshotBeforeChange(db, original, renamed)).toBeNull();
  });

  it('does not keep an empty document', async () => {
    const empty = createDocument({ workspaceId: 'w1' });
    const typed = updateDocument(empty, { content: body('Hello') });

    expect(await snapshotBeforeChange(db, empty, typed)).toBeNull();
  });

  it('records explicitly, but never the same body twice in a row', async () => {
    expect(await recordVersion(db, original, 'manual')).not.toBeNull();
    expect(await recordVersion(db, original, 'manual')).toBeNull();
  });

  it('prunes to the policy', async () => {
    let document = original;
    for (let index = 0; index < 5; index += 1) {
      document = updateDocument(document, { content: body(`Draft ${index}`) });
      await recordVersion(db, document, 'manual', {
        policy: { intervalMs: 0, keep: 3 },
        now: at(`2026-09-23T10:0${index}:00Z`),
      });
    }

    const kept = await db.versions.listByDocument(original.id);
    expect(kept.map((version) => version.content)).toEqual([
      body('Draft 4'),
      body('Draft 3'),
      body('Draft 2'),
    ]);
  });
});
