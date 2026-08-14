import type { Folder, Id, NotoDocument, NotoFile, Workspace } from '@noto/types';

import {
  applyDeletedFilter,
  applyPagination,
  byUpdatedAtDesc,
  documentComparator,
  filterDocuments,
  matchesDocumentSearch,
  normalizeSearchQuery,
} from './query';
import type {
  DocumentRepository,
  FileRepository,
  FolderRepository,
  NotoDatabase,
  WorkspaceRepository,
} from './types';

/**
 * An in-memory implementation of the storage contract.
 *
 * It is the reference implementation the platform adapters are tested against,
 * and the store the apps fall back to when no persistent engine is available
 * (unit tests, or a browser with IndexedDB blocked).
 */
export class InMemoryDatabase implements NotoDatabase {
  private readonly workspaceRows = new Map<Id, Workspace>();
  private readonly folderRows = new Map<Id, Folder>();
  private readonly documentRows = new Map<Id, NotoDocument>();
  private readonly fileRows = new Map<Id, NotoFile>();

  readonly workspaces: WorkspaceRepository = {
    get: async (id) => this.workspaceRows.get(id) ?? null,

    list: async (options) => {
      const rows = applyDeletedFilter([...this.workspaceRows.values()], options);
      rows.sort(byUpdatedAtDesc);
      return applyPagination(rows, options);
    },

    put: async (workspace) => {
      this.workspaceRows.set(workspace.id, workspace);
    },

    purge: async (id) => {
      this.workspaceRows.delete(id);
    },
  };

  readonly folders: FolderRepository = {
    get: async (id) => this.folderRows.get(id) ?? null,

    listByWorkspace: async (workspaceId, options) => {
      const rows = applyDeletedFilter(
        [...this.folderRows.values()].filter((row) => row.workspaceId === workspaceId),
        options,
      );
      rows.sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
      return applyPagination(rows, options);
    },

    put: async (folder) => {
      this.folderRows.set(folder.id, folder);
    },

    putMany: async (folders) => {
      for (const folder of folders) this.folderRows.set(folder.id, folder);
    },

    purge: async (id) => {
      this.folderRows.delete(id);
    },
  };

  readonly documents: DocumentRepository = {
    get: async (id) => this.documentRows.get(id) ?? null,

    listByWorkspace: async (workspaceId, options) => {
      const rows = applyDeletedFilter(this.documentsIn(workspaceId), options);
      const filtered = filterDocuments(rows, options);
      filtered.sort(documentComparator(options?.orderBy));

      return applyPagination(filtered, options);
    },

    put: async (document) => {
      this.documentRows.set(document.id, document);
    },

    putMany: async (documents) => {
      for (const document of documents) this.documentRows.set(document.id, document);
    },

    purge: async (id) => {
      this.documentRows.delete(id);
    },

    search: async (workspaceId, query, options) => {
      const needle = normalizeSearchQuery(query);
      const matches = applyDeletedFilter(this.documentsIn(workspaceId), options).filter((row) =>
        matchesDocumentSearch(row, needle),
      );

      matches.sort(byUpdatedAtDesc);
      return applyPagination(matches, options);
    },

    countByWorkspace: async (workspaceId) =>
      this.documentsIn(workspaceId).filter((row) => row.deletedAt === null).length,
  };

  readonly files: FileRepository = {
    get: async (id) => this.fileRows.get(id) ?? null,

    listByDocument: async (documentId, options) => {
      const rows = applyDeletedFilter(
        [...this.fileRows.values()].filter((row) => row.documentId === documentId),
        options,
      );
      rows.sort(byUpdatedAtDesc);
      return applyPagination(rows, options);
    },

    put: async (file) => {
      this.fileRows.set(file.id, file);
    },

    purge: async (id) => {
      this.fileRows.delete(id);
    },
  };

  async open(): Promise<void> {
    // Nothing to open; the maps live for as long as the instance does.
  }

  async close(): Promise<void> {
    // Nothing to close.
  }

  async clear(): Promise<void> {
    this.workspaceRows.clear();
    this.folderRows.clear();
    this.documentRows.clear();
    this.fileRows.clear();
  }

  private documentsIn(workspaceId: Id): NotoDocument[] {
    return [...this.documentRows.values()].filter((row) => row.workspaceId === workspaceId);
  }
}

/** Convenience factory mirroring the platform adapters' `create*Database()` shape. */
export function createInMemoryDatabase(): NotoDatabase {
  return new InMemoryDatabase();
}
