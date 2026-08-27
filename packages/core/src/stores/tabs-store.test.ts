import { beforeEach, describe, expect, it } from 'vitest';

import { EMPTY_TABS_STATE, toPersistedTabs, useTabsStore } from './tabs-store';

const state = () => useTabsStore.getState();
const openIds = () => state().openIds;

/* The store is a module singleton, so each test starts it empty again. */
beforeEach(() => {
  useTabsStore.setState({ ...EMPTY_TABS_STATE, dirtyIds: [], hydrated: false });
});

describe('open', () => {
  it('adds a tab and brings it to the front', () => {
    state().open('a');
    state().open('b');

    expect(openIds()).toEqual(['a', 'b']);
    expect(state().activeId).toBe('b');
  });

  it('does not open the same document twice', () => {
    state().open('a');
    state().open('b');
    state().open('a');

    expect(openIds()).toEqual(['a', 'b']);
    expect(state().activeId).toBe('a');
  });

  it('remembers what has been opened, most recent first', () => {
    state().open('a');
    state().open('b');
    state().open('a');

    expect(state().recentIds).toEqual(['a', 'b']);
  });
});

describe('close', () => {
  it('hands the front to the tab on the right', () => {
    state().open('a');
    state().open('b');
    state().open('c');
    state().activate('b');

    state().close('b');

    expect(openIds()).toEqual(['a', 'c']);
    expect(state().activeId).toBe('c');
  });

  it('falls back to the left when the closed tab was last', () => {
    state().open('a');
    state().open('b');

    state().close('b');

    expect(state().activeId).toBe('a');
  });

  it('leaves the front alone when some other tab is closed', () => {
    state().open('a');
    state().open('b');
    state().activate('a');

    state().close('b');

    expect(state().activeId).toBe('a');
  });

  it('closes the last tab rather than reopening something', () => {
    state().open('a');
    state().close('a');

    expect(openIds()).toEqual([]);
    expect(state().activeId).toBeNull();
  });

  it('keeps the document in recents — closing is how it gets there', () => {
    state().open('a');
    state().close('a');

    expect(state().recentIds).toEqual(['a']);
  });

  it('ignores a document that is not open', () => {
    state().open('a');
    state().close('b');

    expect(openIds()).toEqual(['a']);
  });
});

describe('prune', () => {
  it('drops tabs for documents that no longer exist', () => {
    state().open('a');
    state().open('b');

    state().prune(['a']);

    expect(openIds()).toEqual(['a']);
    expect(state().activeId).toBe('a');
  });

  it('forgets deleted documents in recents too', () => {
    state().open('a');
    state().open('b');
    state().close('b');

    state().prune(['a']);

    expect(state().recentIds).toEqual(['a']);
  });

  it('leaves everything alone when nothing has gone', () => {
    state().open('a');
    const before = openIds();

    state().prune(['a', 'b']);

    // Same array, so a subscriber does not re-render for a no-op.
    expect(openIds()).toBe(before);
  });
});

describe('dirty state', () => {
  it('tracks which documents have unwritten work', () => {
    state().setDirty('a', true);
    expect(state().dirtyIds).toEqual(['a']);

    state().setDirty('a', false);
    expect(state().dirtyIds).toEqual([]);
  });

  it('does not record the same document twice', () => {
    state().setDirty('a', true);
    const before = state().dirtyIds;

    state().setDirty('a', true);

    expect(state().dirtyIds).toBe(before);
  });

  it('forgets a closed tab was dirty', () => {
    state().open('a');
    state().setDirty('a', true);

    state().close('a');

    expect(state().dirtyIds).toEqual([]);
  });
});

describe('closeAll', () => {
  it('leaves nothing open', () => {
    state().open('a');
    state().open('b');
    state().setDirty('a', true);

    state().closeAll();

    expect(openIds()).toEqual([]);
    expect(state().activeId).toBeNull();
    expect(state().dirtyIds).toEqual([]);
  });
});

describe('replace', () => {
  it('restores a persisted session', () => {
    state().replace({ openIds: ['a', 'b'], activeId: 'b', recentIds: ['b', 'a'] });

    expect(openIds()).toEqual(['a', 'b']);
    expect(state().activeId).toBe('b');
    expect(state().hydrated).toBe(true);
  });

  it('refuses an active id that is not open', () => {
    // Otherwise the tab bar renders with nothing selected.
    state().replace({ openIds: ['a'], activeId: 'gone', recentIds: [] });

    expect(state().activeId).toBeNull();
  });
});

describe('toPersistedTabs', () => {
  it('keeps only what is worth writing back', () => {
    state().open('a');
    state().setDirty('a', true);

    expect(toPersistedTabs(state())).toEqual({
      openIds: ['a'],
      activeId: 'a',
      recentIds: ['a'],
    });
  });
});
