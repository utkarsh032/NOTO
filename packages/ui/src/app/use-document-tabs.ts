import { useTabsStore } from '@noto/core';
import type { Id, NotoDocument } from '@noto/types';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useNotoData } from './data-context';

export interface DocumentTab {
  id: Id;
  title: string;
  /** Has edits the editor has not written to storage yet. */
  isDirty: boolean;
  isActive: boolean;
  /** Pinned to the front of the row, and kept by Close All. */
  isPinned: boolean;
}

export interface DocumentTabs {
  tabs: DocumentTab[];
  /** Previously opened documents that are not open now, most recent first. */
  recent: NotoDocument[];
  /** Ids of open documents with unsaved edits. */
  dirtyIds: Id[];
  open(id: Id): void;
  close(id: Id): void;
  closeAll(): void;
  /** Creates a document and opens it in a new tab. */
  create(): Promise<void>;
  setDirty(id: Id, dirty: boolean): void;
  togglePin(id: Id): void;
  moveBy(id: Id, delta: -1 | 1): void;
  /** Reopens the most recently closed tab. Resolves `false` when there is none. */
  reopenClosed(): boolean;
  /** Copies a document — body, tags and folder — and opens the copy beside it. */
  duplicate(id: Id): Promise<Id | null>;
  /** Whether anything has been closed that Reopen could bring back. */
  canReopen: boolean;
}

/**
 * Which documents are open, and which one the editor is showing.
 *
 * The tab store owns that answer; the data source's own selection is kept in
 * step with it by the one effect below rather than being a second opinion. That
 * ownership is what lets the last tab actually close — while selection lived in
 * the data source it fell back to the newest document, so "close everything"
 * immediately reopened something.
 *
 * The store holds ids and the database holds documents, so tabs are resolved
 * against the document list on every render: a tab whose document has been
 * deleted resolves to nothing and `prune` drops it.
 */
export function useDocumentTabs(): DocumentTabs {
  const { documents, activeDocument, selectDocument, createDocument } = useNotoData();

  const openIds = useTabsStore((state) => state.openIds);
  const activeId = useTabsStore((state) => state.activeId);
  const recentIds = useTabsStore((state) => state.recentIds);
  const dirtyIds = useTabsStore((state) => state.dirtyIds);
  const pinnedIds = useTabsStore((state) => state.pinnedIds);
  const closedIds = useTabsStore((state) => state.closedIds);
  const hydrated = useTabsStore((state) => state.hydrated);

  const openTab = useTabsStore((state) => state.open);
  const closeTab = useTabsStore((state) => state.close);
  const closeAllTabs = useTabsStore((state) => state.closeAll);
  const pruneTabs = useTabsStore((state) => state.prune);
  const setDirty = useTabsStore((state) => state.setDirty);
  const togglePin = useTabsStore((state) => state.togglePin);
  const moveBy = useTabsStore((state) => state.moveBy);
  const reopenClosedTab = useTabsStore((state) => state.reopenClosed);

  /*
   * Deleting a document elsewhere has to take its tab with it. Waits for the
   * document list, because the empty list before the first query resolves would
   * otherwise close every tab that was just restored.
   */
  useEffect(() => {
    if (documents === undefined) return;
    pruneTabs(documents.map((document) => document.id));
  }, [documents, pruneTabs]);

  /* The store decides; the data source follows. */
  useEffect(() => {
    if (documents === undefined) return;
    if ((activeDocument?.id ?? null) === activeId) return;

    selectDocument(activeId);
  }, [activeId, activeDocument, documents, selectDocument]);

  /*
   * Opening at launch, done exactly once.
   *
   * Restores the tab that was in front, or — on a first run with nothing
   * persisted — opens the most recent document, because an empty desk is a poor
   * greeting when there is work to show. Guarded by a ref rather than by
   * checking whether anything is open, so that closing every tab is a state the
   * user can actually stay in.
   */
  const openedOnLaunchRef = useRef(false);
  useEffect(() => {
    if (openedOnLaunchRef.current) return;
    if (!hydrated || documents === undefined) return;

    openedOnLaunchRef.current = true;

    if (activeId && documents.some((document) => document.id === activeId)) return;
    if (openIds.length === 0 && documents.length > 0) openTab(documents[0]!.id);
  }, [hydrated, documents, activeId, openIds, openTab]);

  const byId = useMemo(() => {
    const index = new Map<Id, NotoDocument>();
    for (const document of documents ?? []) index.set(document.id, document);
    return index;
  }, [documents]);

  const tabs = useMemo(
    () =>
      openIds
        .map((id) => {
          const document = byId.get(id);
          if (!document) return null;

          return {
            id,
            title: document.title,
            isDirty: dirtyIds.includes(id),
            isActive: id === activeId,
            isPinned: pinnedIds.includes(id),
          };
        })
        .filter((tab): tab is DocumentTab => tab !== null),
    [openIds, byId, dirtyIds, activeId, pinnedIds],
  );

  /* Recents exist to reopen things, so anything already open is not offered. */
  const recent = useMemo(
    () =>
      recentIds
        .filter((id) => !openIds.includes(id))
        .map((id) => byId.get(id))
        .filter((document): document is NotoDocument => document !== undefined),
    [recentIds, openIds, byId],
  );

  const create = useCallback(async () => {
    const id = await createDocument();
    if (id) openTab(id);
  }, [createDocument, openTab]);

  const duplicate = useCallback(
    async (id: Id) => {
      const original = byId.get(id);
      if (!original) return null;

      const copyId = await createDocument({
        title: `${original.title || 'Untitled'} (copy)`,
        content: original.content,
        tags: original.tags,
        folderId: original.folderId,
      });
      if (!copyId) return null;

      openTab(copyId, { after: id });

      return copyId;
    },
    [byId, createDocument, openTab],
  );

  const reopenClosed = useCallback(() => reopenClosedTab() !== null, [reopenClosedTab]);

  // Only documents that still exist can come back; prune keeps the list honest.
  const canReopen = closedIds.some((id) => byId.has(id));

  return useMemo(
    () => ({
      tabs,
      recent,
      dirtyIds,
      open: openTab,
      close: closeTab,
      closeAll: closeAllTabs,
      create,
      setDirty,
      togglePin,
      moveBy,
      reopenClosed,
      duplicate,
      canReopen,
    }),
    [
      tabs,
      recent,
      dirtyIds,
      openTab,
      closeTab,
      closeAllTabs,
      create,
      setDirty,
      togglePin,
      moveBy,
      reopenClosed,
      duplicate,
      canReopen,
    ],
  );
}
