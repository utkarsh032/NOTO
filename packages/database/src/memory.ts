import { hashContent } from '@noto/core';
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
} from './query';
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
} from './types';

const outboxKey = (kind: SyncEntityKind, id: Id) => `${kind}:${id}`;

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
  private readonly memoryRows = new Map<Id, MemoryItem>();
  private readonly versionRows = new Map<Id, DocumentVersionRecord>();
  private readonly outboxRows = new Map<string, OutboxEntry>();
  private readonly stateRows = new Map<string, unknown>();
  private outboxSeq = 0;

  /**
   * Every local save goes through here: the version moves on by one and the
   * outbox learns about it. Storage owns both, so no caller can forget either.
   */
  private save<T extends Entity>(kind: SyncEntityKind, rows: Map<Id, T>, entity: T): void {
    const existing = rows.get(entity.id);
    rows.set(entity.id, { ...entity, version: (existing?.version ?? 0) + 1 });

    const key = outboxKey(kind, entity.id);
    this.outboxSeq += 1;
    this.outboxRows.set(key, {
      entityKind: kind,
      entityId: entity.id,
      operation: nextOutboxOperation(
        this.outboxRows.get(key)?.operation,
        existing !== undefined,
        entity.deletedAt !== null,
      ),
      seq: this.outboxSeq,
      queuedAt: new Date().toISOString(),
    });
  }

  readonly workspaces: WorkspaceRepository = {
    get: async (id) => this.workspaceRows.get(id) ?? null,

    list: async (options) => {
      const rows = applyDeletedFilter([...this.workspaceRows.values()], options);
      rows.sort(byUpdatedAtDesc);
      return applyPagination(rows, options);
    },

    put: async (workspace) => {
      this.save('workspace', this.workspaceRows, workspace);
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
      this.save('folder', this.folderRows, folder);
    },

    putMany: async (folders) => {
      for (const folder of folders) this.save('folder', this.folderRows, folder);
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
      this.save('document', this.documentRows, {
        ...document,
        contentHash: hashContent(document.content),
      });
    },

    putMany: async (documents) => {
      for (const document of documents) await this.documents.put(document);
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

    listTags: async (workspaceId) => countTags(this.documentsIn(workspaceId)),
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
      this.save('file', this.fileRows, file);
    },

    purge: async (id) => {
      this.fileRows.delete(id);
    },
  };

  readonly memory: MemoryRepository = {
    get: async (id) => this.memoryRows.get(id) ?? null,

    listByWorkspace: async (workspaceId, options) => {
      const rows = filterMemory(applyDeletedFilter(this.memoryIn(workspaceId), options), options);
      rows.sort(byUpdatedAtDesc);
      return applyPagination(rows, options);
    },

    put: async (item) => {
      this.save('memory', this.memoryRows, item);
    },

    putMany: async (items) => {
      for (const item of items) this.save('memory', this.memoryRows, item);
    },

    purge: async (id) => {
      this.memoryRows.delete(id);
    },

    search: async (workspaceId, query, options) => {
      const needle = normalizeSearchQuery(query);
      const rows = filterMemory(
        applyDeletedFilter(this.memoryIn(workspaceId), options),
        options,
      ).filter((row) => matchesMemorySearch(row, needle));

      rows.sort(byUpdatedAtDesc);
      return applyPagination(rows, options);
    },
  };

  readonly versions: VersionRepository = {
    get: async (id) => this.versionRows.get(id) ?? null,

    listByDocument: async (documentId, options) => {
      const rows = this.versionsOf(documentId);
      return options?.limit === undefined ? rows : rows.slice(0, options.limit);
    },

    add: async (version) => {
      this.versionRows.set(version.id, version);
    },

    prune: async (documentId, keep) => {
      for (const version of this.versionsOf(documentId).slice(Math.max(0, keep))) {
        this.versionRows.delete(version.id);
      }
    },

    purgeByDocument: async (documentId) => {
      for (const version of this.versionsOf(documentId)) this.versionRows.delete(version.id);
    },
  };

  readonly outbox: OutboxRepository = {
    list: async (limit) => {
      const rows = [...this.outboxRows.values()].sort((a, b) => a.seq - b.seq);
      return limit === undefined ? rows : rows.slice(0, limit);
    },

    count: async () => this.outboxRows.size,

    acknowledge: async (entries) => {
      for (const entry of entries) {
        const key = outboxKey(entry.entityKind, entry.entityId);
        if (this.outboxRows.get(key)?.seq === entry.seq) this.outboxRows.delete(key);
      }
    },

    clear: async () => {
      this.outboxRows.clear();
    },
  };

  readonly localState: LocalStateRepository = {
    get: async <T>(key: string) =>
      this.stateRows.has(key) ? (structuredClone(this.stateRows.get(key)) as T) : null,

    set: async (key, value) => {
      this.stateRows.set(key, structuredClone(value));
    },

    delete: async (key) => {
      this.stateRows.delete(key);
    },

    keys: async (prefix) => [...this.stateRows.keys()].filter((key) => key.startsWith(prefix)),
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
    this.memoryRows.clear();
    this.versionRows.clear();
    this.outboxRows.clear();
    this.stateRows.clear();
  }

  private documentsIn(workspaceId: Id): NotoDocument[] {
    return [...this.documentRows.values()].filter((row) => row.workspaceId === workspaceId);
  }

  private memoryIn(workspaceId: Id): MemoryItem[] {
    return [...this.memoryRows.values()].filter((row) => row.workspaceId === workspaceId);
  }

  /** Newest first; ties broken by id so the order is stable. */
  private versionsOf(documentId: Id): DocumentVersionRecord[] {
    return [...this.versionRows.values()]
      .filter((row) => row.documentId === documentId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  }
}

/** Convenience factory mirroring the platform adapters' `create*Database()` shape. */
export function createInMemoryDatabase(): NotoDatabase {
  return new InMemoryDatabase();
}
