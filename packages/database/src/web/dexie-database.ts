import { DATABASE_NAME, DATABASE_VERSION } from '@noto/config';
import type { Folder, Id, NotoDocument, NotoFile, Workspace } from '@noto/types';
import Dexie, { type Table } from 'dexie';

import {
  applyDeletedFilter,
  applyPagination,
  byUpdatedAtDesc,
  documentComparator,
  filterDocuments,
  matchesDocumentSearch,
  normalizeSearchQuery,
} from '../query';
import type {
  DocumentRepository,
  FileRepository,
  FolderRepository,
  NotoDatabase,
  WorkspaceRepository,
} from '../types';

/**
 * The IndexedDB schema.
 *
 * `deletedAt` is deliberately not indexed: IndexedDB does not index `null`, so
 * an index on it would miss exactly the live rows most queries want. Rows are
 * narrowed by `workspaceId` in the index and filtered for tombstones in memory.
 */
export class NotoDexie extends Dexie {
  declare workspaces: Table<Workspace, Id>;
  declare folders: Table<Folder, Id>;
  declare documents: Table<NotoDocument, Id>;
  declare files: Table<NotoFile, Id>;

  constructor(name: string = DATABASE_NAME) {
    super(name);

    this.version(DATABASE_VERSION).stores({
      workspaces: 'id, updatedAt',
      folders: 'id, workspaceId, parentId, updatedAt, [workspaceId+parentId]',
      documents:
        'id, workspaceId, folderId, status, updatedAt, createdAt, [workspaceId+folderId], [workspaceId+status]',
      files: 'id, workspaceId, documentId, updatedAt',
    });
  }
}

/** IndexedDB-backed storage for the Noto web application. */
export class DexieDatabase implements NotoDatabase {
  private readonly db: NotoDexie;

  constructor(name: string = DATABASE_NAME) {
    this.db = new NotoDexie(name);
  }

  readonly workspaces: WorkspaceRepository = {
    get: async (id) => (await this.db.workspaces.get(id)) ?? null,

    list: async (options) => {
      const rows = applyDeletedFilter(await this.db.workspaces.toArray(), options);
      rows.sort(byUpdatedAtDesc);
      return applyPagination(rows, options);
    },

    put: async (workspace) => {
      await this.db.workspaces.put(workspace);
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
      await this.db.folders.put(folder);
    },

    putMany: async (folders) => {
      await this.db.folders.bulkPut([...folders]);
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
      await this.db.documents.put(document);
    },

    putMany: async (documents) => {
      await this.db.documents.bulkPut([...documents]);
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
      await this.db.files.put(file);
    },

    purge: async (id) => {
      await this.db.files.delete(id);
    },
  };

  async open(): Promise<void> {
    await this.db.open();
  }

  async close(): Promise<void> {
    this.db.close();
  }

  async clear(): Promise<void> {
    await this.db.transaction(
      'rw',
      [this.db.workspaces, this.db.folders, this.db.documents, this.db.files],
      async () => {
        await Promise.all([
          this.db.workspaces.clear(),
          this.db.folders.clear(),
          this.db.documents.clear(),
          this.db.files.clear(),
        ]);
      },
    );
  }

  /** Escape hatch for `dexie-react-hooks`' `useLiveQuery`, which needs the raw tables. */
  get raw(): NotoDexie {
    return this.db;
  }

  private documentsIn(workspaceId: Id): Promise<NotoDocument[]> {
    return this.db.documents.where('workspaceId').equals(workspaceId).toArray();
  }
}

export function createWebDatabase(name: string = DATABASE_NAME): DexieDatabase {
  return new DexieDatabase(name);
}
