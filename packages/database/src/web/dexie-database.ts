import { hashContent } from '@noto/core';
import { DATABASE_NAME } from '@noto/config';
import type {
  DocumentVersionRecord,
  Entity,
  Folder,
  Id,
  MemoryItem,
  NotoDocument,
  NotoFile,
  OutboxEntry,
  SyncEntityKind,
  Workspace,
} from '@noto/types';
import Dexie, { type Table } from 'dexie';

import {
  applyDeletedFilter,
  applyPagination,
  byUpdatedAtDesc,
  countTags,
  documentComparator,
  filterDocuments,
  filterMemory,
  matchesDocumentSearch,
  matchesMemorySearch,
  nextOutboxOperation,
  normalizeSearchQuery,
} from '../query';
import type {
  DocumentRepository,
  FileRepository,
  FolderRepository,
  LocalStateRepository,
  MemoryRepository,
  NotoDatabase,
  OutboxRepository,
  VersionRepository,
  WorkspaceRepository,
} from '../types';

/** A row in the key-value table. */
interface LocalStateRow {
  key: string;
  value: unknown;
  updatedAt: string;
}

/**
 * The IndexedDB schema.
 *
 * `deletedAt` is deliberately not indexed: IndexedDB does not index `null`, so
 * an index on it would miss exactly the live rows most queries want. Rows are
 * narrowed by `workspaceId` in the index and filtered for tombstones in memory.
 *
 * Every version is declared, oldest first, because that is how Dexie knows
 * what to change on a device that last opened an older one.
 */
export class NotoDexie extends Dexie {
  declare workspaces: Table<Workspace, Id>;
  declare folders: Table<Folder, Id>;
  declare documents: Table<NotoDocument, Id>;
  declare files: Table<NotoFile, Id>;
  declare memoryItems: Table<MemoryItem, Id>;
  declare documentVersions: Table<DocumentVersionRecord, Id>;
  declare outbox: Table<OutboxEntry, [SyncEntityKind, Id]>;
  declare localState: Table<LocalStateRow, string>;

  constructor(name: string = DATABASE_NAME) {
    super(name);

    this.version(1).stores({
      workspaces: 'id, updatedAt',
      folders: 'id, workspaceId, parentId, updatedAt, [workspaceId+parentId]',
      documents:
        'id, workspaceId, folderId, status, updatedAt, createdAt, [workspaceId+folderId], [workspaceId+status]',
      files: 'id, workspaceId, documentId, updatedAt',
    });

    /*
     * Version 2 — local schema v2. Memory, versions, the outbox and the
     * key-value table are new; documents gain a multi-entry index on `tags`.
     * Existing rows need no rewrite: a missing `version` reads as "never
     * counted" and the next save makes it 1.
     */
    this.version(2).stores({
      documents:
        'id, workspaceId, folderId, status, updatedAt, createdAt, *tags, [workspaceId+folderId], [workspaceId+status]',
      memoryItems: 'id, workspaceId, kind, updatedAt, [workspaceId+kind]',
      documentVersions: 'id, documentId, [documentId+createdAt]',
      outbox: '[entityKind+entityId], seq',
      localState: 'key',
    });
  }
}

/** IndexedDB-backed storage for the Noto web application. */
export class DexieDatabase implements NotoDatabase {
  private readonly db: NotoDexie;

  constructor(name: string = DATABASE_NAME) {
    this.db = new NotoDexie(name);
  }

  /**
   * Every local save: the row with its version moved on by one, and its
   * outbox entry, in one transaction so they cannot disagree.
   */
  private async save<T extends Entity>(
    kind: SyncEntityKind,
    table: Table<T, Id>,
    entity: T,
  ): Promise<void> {
    await this.db.transaction('rw', [table, this.db.outbox], async () => {
      const existing = await table.get(entity.id);
      const queued = await this.db.outbox.get([kind, entity.id]);
      const last = await this.db.outbox.orderBy('seq').last();

      await table.put({ ...entity, version: (existing?.version ?? 0) + 1 });
      await this.db.outbox.put({
        entityKind: kind,
        entityId: entity.id,
        operation: nextOutboxOperation(
          queued?.operation,
          existing !== undefined,
          entity.deletedAt !== null,
        ),
        seq: (last?.seq ?? 0) + 1,
        queuedAt: new Date().toISOString(),
      });
    });
  }

  readonly workspaces: WorkspaceRepository = {
    get: async (id) => (await this.db.workspaces.get(id)) ?? null,

    list: async (options) => {
      const rows = applyDeletedFilter(await this.db.workspaces.toArray(), options);
      rows.sort(byUpdatedAtDesc);
      return applyPagination(rows, options);
    },

    put: async (workspace) => {
      await this.save('workspace', this.db.workspaces, workspace);
    },

    purge: async (id) => {
      await this.db.workspaces.delete(id);
    },
  };

  readonly folders: FolderRepository = {
    get: async (id) => (await this.db.folders.get(id)) ?? null,

    listByWorkspace: async (workspaceId, options) => {
      const rows = applyDeletedFilter(
        await this.db.folders.where('workspaceId').equals(workspaceId).toArray(),
        options,
      );
      rows.sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
      return applyPagination(rows, options);
    },

    put: async (folder) => {
      await this.save('folder', this.db.folders, folder);
    },

    putMany: async (folders) => {
      await this.db.transaction('rw', [this.db.folders, this.db.outbox], async () => {
        for (const folder of folders) await this.save('folder', this.db.folders, folder);
      });
    },

    purge: async (id) => {
      await this.db.folders.delete(id);
    },
  };

  readonly documents: DocumentRepository = {
    get: async (id) => (await this.db.documents.get(id)) ?? null,

    listByWorkspace: async (workspaceId, options) => {
      const rows = applyDeletedFilter(await this.documentsIn(workspaceId), options);
      const filtered = filterDocuments(rows, options);
      filtered.sort(documentComparator(options?.orderBy));

      return applyPagination(filtered, options);
    },

    put: async (document) => {
      await this.save('document', this.db.documents, {
        ...document,
        contentHash: hashContent(document.content),
      });
    },

    putMany: async (documents) => {
      await this.db.transaction('rw', [this.db.documents, this.db.outbox], async () => {
        for (const document of documents) await this.documents.put(document);
      });
    },

    purge: async (id) => {
      await this.db.documents.delete(id);
    },

    search: async (workspaceId, query, options) => {
      const needle = normalizeSearchQuery(query);
      const matches = applyDeletedFilter(await this.documentsIn(workspaceId), options).filter(
        (row) => matchesDocumentSearch(row, needle),
      );

      matches.sort(byUpdatedAtDesc);
      return applyPagination(matches, options);
    },

    countByWorkspace: async (workspaceId) => {
      const rows = await this.documentsIn(workspaceId);
      return rows.filter((row) => row.deletedAt === null).length;
    },

    listTags: async (workspaceId) => countTags(await this.documentsIn(workspaceId)),
  };

  readonly files: FileRepository = {
    get: async (id) => (await this.db.files.get(id)) ?? null,

    listByDocument: async (documentId, options) => {
      const rows = applyDeletedFilter(
        await this.db.files.where('documentId').equals(documentId).toArray(),
        options,
      );
      rows.sort(byUpdatedAtDesc);
      return applyPagination(rows, options);
    },

    put: async (file) => {
      await this.save('file', this.db.files, file);
    },

    purge: async (id) => {
      await this.db.files.delete(id);
    },
  };

  readonly memory: MemoryRepository = {
    get: async (id) => (await this.db.memoryItems.get(id)) ?? null,

    listByWorkspace: async (workspaceId, options) => {
      const rows = filterMemory(
        applyDeletedFilter(await this.memoryIn(workspaceId), options),
        options,
      );
      rows.sort(byUpdatedAtDesc);
      return applyPagination(rows, options);
    },

    put: async (item) => {
      await this.save('memory', this.db.memoryItems, item);
    },

    putMany: async (items) => {
      await this.db.transaction('rw', [this.db.memoryItems, this.db.outbox], async () => {
        for (const item of items) await this.save('memory', this.db.memoryItems, item);
      });
    },

    purge: async (id) => {
      await this.db.memoryItems.delete(id);
    },

    search: async (workspaceId, query, options) => {
      const needle = normalizeSearchQuery(query);
      const rows = filterMemory(
        applyDeletedFilter(await this.memoryIn(workspaceId), options),
        options,
      ).filter((row) => matchesMemorySearch(row, needle));

      rows.sort(byUpdatedAtDesc);
      return applyPagination(rows, options);
    },
  };

  readonly versions: VersionRepository = {
    get: async (id) => (await this.db.documentVersions.get(id)) ?? null,

    listByDocument: async (documentId, options) => {
      const rows = await this.versionsOf(documentId);
      return options?.limit === undefined ? rows : rows.slice(0, options.limit);
    },

    add: async (version) => {
      await this.db.documentVersions.add(version);
    },

    prune: async (documentId, keep) => {
      const stale = (await this.versionsOf(documentId)).slice(Math.max(0, keep));
      await this.db.documentVersions.bulkDelete(stale.map((version) => version.id));
    },

    purgeByDocument: async (documentId) => {
      await this.db.documentVersions.where('documentId').equals(documentId).delete();
    },
  };

  readonly outbox: OutboxRepository = {
    list: async (limit) => {
      const ordered = this.db.outbox.orderBy('seq');
      return limit === undefined ? ordered.toArray() : ordered.limit(limit).toArray();
    },

    count: async () => this.db.outbox.count(),

    acknowledge: async (entries) => {
      await this.db.transaction('rw', this.db.outbox, async () => {
        for (const entry of entries) {
          const current = await this.db.outbox.get([entry.entityKind, entry.entityId]);
          if (current?.seq === entry.seq) {
            await this.db.outbox.delete([entry.entityKind, entry.entityId]);
          }
        }
      });
    },

    clear: async () => {
      await this.db.outbox.clear();
    },
  };

  readonly localState: LocalStateRepository = {
    get: async <T>(key: string) => {
      const row = await this.db.localState.get(key);
      return row ? (row.value as T) : null;
    },

    set: async (key, value) => {
      await this.db.localState.put({ key, value, updatedAt: new Date().toISOString() });
    },

    delete: async (key) => {
      await this.db.localState.delete(key);
    },

    keys: async (prefix) =>
      (await this.db.localState.where('key').startsWith(prefix).primaryKeys()).map(String),
  };

  async open(): Promise<void> {
    await this.db.open();
  }

  async close(): Promise<void> {
    this.db.close();
  }

  async clear(): Promise<void> {
    await this.db.transaction('rw', this.db.tables, async () => {
      await Promise.all(this.db.tables.map((table) => table.clear()));
    });
  }

  /** Escape hatch for `dexie-react-hooks`' `useLiveQuery`, which needs the raw tables. */
  get raw(): NotoDexie {
    return this.db;
  }

  private documentsIn(workspaceId: Id): Promise<NotoDocument[]> {
    return this.db.documents.where('workspaceId').equals(workspaceId).toArray();
  }

  private memoryIn(workspaceId: Id): Promise<MemoryItem[]> {
    return this.db.memoryItems.where('workspaceId').equals(workspaceId).toArray();
  }

  /** Newest first; ties broken by id so the order is stable. */
  private async versionsOf(documentId: Id): Promise<DocumentVersionRecord[]> {
    const rows = await this.db.documentVersions.where('documentId').equals(documentId).toArray();
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  }
}

export function createWebDatabase(name: string = DATABASE_NAME): DexieDatabase {
  return new DexieDatabase(name);
}
