import { InMemoryDatabase } from '@noto/database';
import { describe, expect, it } from 'vitest';

import { recoveryFor } from './recovery';

const content = (text: string) => ({
  type: 'doc' as const,
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

const snapshot = (savedAt: number, text = 'Unsaved') => ({
  documentId: 'd1',
  title: 'Draft',
  content: content(text),
  savedAt,
});

/** Lets queued writes run. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('recovery', () => {
  it('offers a snapshot newer than what was stored', async () => {
    const store = recoveryFor(new InMemoryDatabase());
    store.write(snapshot(Date.parse('2026-09-23T10:05:00Z')));
    await settle();

    const found = await store.read('d1', '2026-09-23T10:00:00Z');
    expect(found?.content).toEqual(content('Unsaved'));
  });

  it('drops a snapshot that autosave already caught up with', async () => {
    const database = new InMemoryDatabase();
    const store = recoveryFor(database);
    store.write(snapshot(Date.parse('2026-09-23T09:59:00Z')));
    await settle();

    expect(await store.read('d1', '2026-09-23T10:00:00Z')).toBeNull();
    expect(await database.localState.keys('recovery:')).toEqual([]);
  });

  it('keeps only the newest of a burst of writes', async () => {
    const store = recoveryFor(new InMemoryDatabase());
    for (let second = 1; second <= 20; second += 1) {
      store.write(
        snapshot(Date.parse(`2026-09-23T10:00:${String(second).padStart(2, '0')}Z`), `v${second}`),
      );
    }
    await settle();
    await settle();

    const found = await store.read('d1', '2026-09-23T09:00:00Z');
    expect(found?.content).toEqual(content('v20'));
  });

  it('forgets a snapshot on clear, including one still waiting to be written', async () => {
    const store = recoveryFor(new InMemoryDatabase());
    store.write(snapshot(Date.parse('2026-09-23T10:05:00Z')));
    await store.clear('d1');
    await settle();

    expect(await store.read('d1', '2026-09-23T10:00:00Z')).toBeNull();
  });

  it('shares one store per database', () => {
    const database = new InMemoryDatabase();
    expect(recoveryFor(database)).toBe(recoveryFor(database));
  });
});
