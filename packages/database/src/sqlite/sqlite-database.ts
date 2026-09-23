import { hashContent } from '@noto/core';
import type { Id, SyncEntityKind, SyncOperation } from '@noto/types';

import { nextOutboxOperation, normalizeSearchQuery } from '../query';
import type {
  DocumentRepository,
  FileRepository,
  FolderRepository,
  ListDocumentsOptions,
  ListMemoryOptions,
  ListOptions,
  LocalStateRepository,
  MemoryRepository,
  NotoDatabase,
  OutboxRepository,
  VersionRepository,
  WorkspaceRepository,
} from '../types';
import type { SqlDriver, SqlValue } from './driver';
import {
  type DocumentRow,
  type FileRow,
  type FolderRow,
  type MemoryRow,
  type OutboxRow,
  type VersionRow,
  type WorkspaceRow,
  fromDocument,
  fromFile,
  fromFolder,
  fromMemoryItem,
  fromVersion,
  fromWorkspace,
  toDocument,
  toFile,
  toFolder,
  toMemoryItem,
  toOutboxEntry,
  toVersion,
  toWorkspace,
} from './rows';
import { TABLES_IN_DELETE_ORDER, migrate } from './schema';

/*
 * Column lists, in the order the `from*` mappers produce values. `version` is
 * not among them: storage computes it, so it is appended by `saveEntity`.
 */
const WORKSPACE_FIELDS = [
  'id',
  'name',
  'owner_id',
  'is_local',
  'icon',
  'created_at',
  'updated_at',
  'deleted_at',
];
const FOLDER_FIELDS = [
  'id',
  'workspace_id',
  'parent_id',
  'name',
  'position',
  'color',
  'icon',
  'created_at',
  'updated_at',
  'deleted_at',
];
const DOCUMENT_FIELDS = [
  'id',
  'workspace_id',
  'folder_id',
  'title',
  'content',
  'status',
  'excerpt',
  'word_count',
  'is_favorite',
  'tags',
  'created_at',
  'updated_at',
  'deleted_at',
];
const FILE_FIELDS = [
  'id',
  'workspace_id',
  'document_id',
  'name',
  'mime_type',
  'size',
  'local_path',
  'remote_url',
  'checksum',
  'created_at',
  'updated_at',
  'deleted_at',
];
const MEMORY_FIELDS = [
  'id',
  'workspace_id',
  'kind',
  'title',
  'content',
  'source',
  'url',
  'tags',
  'is_pinned',
  'size_bytes',
  'created_at',
  'updated_at',
  'deleted_at',
];
const VERSION_FIELDS = [
  'id',
  'document_id',
  'workspace_id',
  'title',
  'content',
  'word_count',
  'content_hash',
  'origin',
  'summary',
  'created_at',
];

const WORKSPACE_COLUMNS = [...WORKSPACE_FIELDS, 'version'].join(', ');
const FOLDER_COLUMNS = [...FOLDER_FIELDS, 'version'].join(', ');
const DOCUMENT_COLUMNS = [...DOCUMENT_FIELDS, 'version', 'content_hash'].join(', ');
const FILE_COLUMNS = [...FILE_FIELDS, 'version'].join(', ');
const MEMORY_COLUMNS = [...MEMORY_FIELDS, 'version'].join(', ');
const VERSION_COLUMNS = VERSION_FIELDS.join(', ');

type EntityTable = 'workspaces' | 'folders' | 'documents' | 'files' | 'memory_items';

function placeholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(', ');
}

/**
 * An upsert, not `INSERT OR REPLACE`.
 *
 * With foreign keys on, REPLACE resolves a conflict by deleting the old row
 * first — and that delete cascades. Saving a document would quietly take its
 * files, versions and tag index with it.
 */
function upsertSql(table: string, columns: readonly string[]): string {
  const updates = columns
    .filter((column) => column !== 'id')
    .map((column) => `${column} = excluded.${column}`)
    .join(', ');

  return (
    `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders(columns.length)})` +
    ` ON CONFLICT(id) DO UPDATE SET ${updates}`
  );
}

/** Appends `LIMIT`/`OFFSET` only when asked, so unbounded queries stay unbounded. */
function paginationClause(options: ListOptions | undefined): { sql: string; params: SqlValue[] } {
  const limit = options?.limit;
  const offset = options?.offset ?? 0;

  if (limit === undefined) {
    return offset > 0 ? { sql: ' LIMIT -1 OFFSET ?', params: [offset] } : { sql: '', params: [] };
  }

  return { sql: ' LIMIT ? OFFSET ?', params: [limit, offset] };
}

function liveClause(options: ListOptions | undefined): string {
  return options?.includeDeleted ? '' : ' AND deleted_at IS NULL';
}

function documentOrderClause(orderBy: ListDocumentsOptions['orderBy']): string {
  switch (orderBy) {
    case 'createdAt':
      return ' ORDER BY created_at DESC, id ASC';
    case 'title':
      return ' ORDER BY title COLLATE NOCASE ASC, id ASC';
    default:
      return ' ORDER BY updated_at DESC, id ASC';
  }
}

/** A LIKE pattern for a normalised needle, with its own wildcards escaped. */
function likePattern(needle: string): string {
  return `%${needle.replace(/[%_\\]/gu, (match) => `\\${match}`)}%`;
}

function memoryConditions(
  workspaceId: Id,
  options: ListMemoryOptions | undefined,
): { where: string; params: SqlValue[] } {
  const conditions = ['workspace_id = ?'];
  const params: SqlValue[] = [workspaceId];

  if (options?.kind !== undefined) {
    conditions.push('kind = ?');
    params.push(options.kind);
  }
  if (options?.pinnedOnly) conditions.push('is_pinned = 1');
  if (!options?.includeDeleted) conditions.push('deleted_at IS NULL');

  return { where: conditions.join(' AND '), params };
}

/**
 * SQLite-backed storage for the desktop and mobile applications.
 *
 * The queries live here; the engine does not. Electron and Expo each pass in a
 * `SqlDriver`, which is the only thing that differs between the two platforms.
 */
export class SqliteDatabase implements NotoDatabase {
  constructor(private readonly driver: SqlDriver) {}

  /**
   * Every local save of a syncable entity: the row, its version, and its
   * outbox entry, in one transaction so they cannot disagree.
   */
  private async saveEntity(
    kind: SyncEntityKind,
    table: EntityTable,
    fields: readonly string[],
    values: SqlValue[],
    deleted: boolean,
    extra: { columns: readonly string[]; values: SqlValue[] } = { columns: [], values: [] },
  ): Promise<void> {
    const id = values[0] as string;

    await this.driver.transaction(async () => {
      const [state] = await this.driver.select<{
        version: number | null;
        operation: SyncOperation | null;
      }>(
        `SELECT (SELECT version FROM ${table} WHERE id = ?) AS version,` +
          ` (SELECT operation FROM outbox WHERE entity_kind = ? AND entity_id = ?) AS operation`,
        [id, kind, id],
      );

      const previousVersion = state?.version ?? null;

      await this.driver.execute(upsertSql(table, [...fields, 'version', ...extra.columns]), [
        ...values,
        (previousVersion ?? 0) + 1,
        ...extra.values,
      ]);

      await this.driver.execute(
        `INSERT INTO outbox (entity_kind, entity_id, operation, seq, queued_at)` +
          ` VALUES (?, ?, ?, (SELECT COALESCE(MAX(seq), 0) + 1 FROM outbox), ?)` +
          ` ON CONFLICT(entity_kind, entity_id) DO UPDATE SET` +
          ` operation = excluded.operation, seq = excluded.seq, queued_at = excluded.queued_at`,
        [
          kind,
          id,
          nextOutboxOperation(state?.operation ?? undefined, previousVersion !== null, deleted),
          new Date().toISOString(),
        ],
      );
    });
  }

  readonly workspaces: WorkspaceRepository = {
    get: async (id) => {
      const rows = await this.driver.select<WorkspaceRow>(
        `SELECT ${WORKSPACE_COLUMNS} FROM workspaces WHERE id = ?`,
        [id],
      );
      const row = rows[0];
      return row ? toWorkspace(row) : null;
    },

    list: async (options) => {
      const page = paginationClause(options);
      const where = options?.includeDeleted ? '' : ' WHERE deleted_at IS NULL';
      const rows = await this.driver.select<WorkspaceRow>(
        `SELECT ${WORKSPACE_COLUMNS} FROM workspaces${where} ORDER BY updated_at DESC, id ASC${page.sql}`,
        page.params,
      );
      return rows.map(toWorkspace);
    },

    put: async (workspace) => {
      await this.saveEntity(
        'workspace',
        'workspaces',
        WORKSPACE_FIELDS,
        fromWorkspace(workspace),
        workspace.deletedAt !== null,
      );
    },

    purge: async (id) => {
      await this.driver.execute('DELETE FROM workspaces WHERE id = ?', [id]);
    },
  };

  readonly folders: FolderRepository = {
    get: async (id) => {
      const rows = await this.driver.select<FolderRow>(
        `SELECT ${FOLDER_COLUMNS} FROM folders WHERE id = ?`,
        [id],
      );
      const row = rows[0];
      return row ? toFolder(row) : null;
    },

    listByWorkspace: async (workspaceId, options) => {
      const page = paginationClause(options);
      const rows = await this.driver.select<FolderRow>(
        `SELECT ${FOLDER_COLUMNS} FROM folders WHERE workspace_id = ?${liveClause(options)}` +
          ` ORDER BY position ASC, name COLLATE NOCASE ASC${page.sql}`,
        [workspaceId, ...page.params],
      );
      return rows.map(toFolder);
    },

    put: async (folder) => {
      await this.saveEntity(
        'folder',
        'folders',
        FOLDER_FIELDS,
        fromFolder(folder),
        folder.deletedAt !== null,
      );
    },

    putMany: async (folders) => {
      await this.driver.transaction(async () => {
        for (const folder of folders) {
          await this.folders.put(folder);
        }
      });
    },

    purge: async (id) => {
      await this.driver.execute('DELETE FROM folders WHERE id = ?', [id]);
    },
  };

  readonly documents: DocumentRepository = {
    get: async (id) => {
      const rows = await this.driver.select<DocumentRow>(
        `SELECT ${DOCUMENT_COLUMNS} FROM documents WHERE id = ?`,
        [id],
      );
      const row = rows[0];
      return row ? toDocument(row) : null;
    },

    listByWorkspace: async (workspaceId, options) => {
      const conditions: string[] = ['workspace_id = ?'];
      const params: SqlValue[] = [workspaceId];

      if (options?.folderId !== undefined) {
        if (options.folderId === null) {
          conditions.push('folder_id IS NULL');
        } else {
          conditions.push('folder_id = ?');
          params.push(options.folderId);
        }
      }
      if (options?.status !== undefined) {
        conditions.push('status = ?');
        params.push(options.status);
      }
      if (options?.favoritesOnly) {
        conditions.push('is_favorite = 1');
      }
      if (options?.tag !== undefined) {
        conditions.push('id IN (SELECT document_id FROM document_tags WHERE tag = ?)');
        params.push(options.tag);
      }
      if (!options?.includeDeleted) {
        conditions.push('deleted_at IS NULL');
      }

      const page = paginationClause(options);
      const rows = await this.driver.select<DocumentRow>(
        `SELECT ${DOCUMENT_COLUMNS} FROM documents WHERE ${conditions.join(' AND ')}` +
          `${documentOrderClause(options?.orderBy)}${page.sql}`,
        [...params, ...page.params],
      );

      return rows.map(toDocument);
    },

    put: async (document) => {
      await this.driver.transaction(async () => {
        await this.saveEntity(
          'document',
          'documents',
          DOCUMENT_FIELDS,
          fromDocument(document),
          document.deletedAt !== null,
          { columns: ['content_hash'], values: [hashContent(document.content)] },
        );

        // The tag index follows the row. Rebuilt rather than diffed: a
        // document has a handful of tags, and rebuilding cannot drift.
        await this.driver.execute('DELETE FROM document_tags WHERE document_id = ?', [document.id]);
        for (const tag of new Set(document.tags)) {
          await this.driver.execute('INSERT INTO document_tags (document_id, tag) VALUES (?, ?)', [
            document.id,
            tag,
          ]);
        }
      });
    },

    putMany: async (documents) => {
      await this.driver.transaction(async () => {
        for (const document of documents) {
          await this.documents.put(document);
        }
      });
    },

    purge: async (id) => {
      await this.driver.execute('DELETE FROM documents WHERE id = ?', [id]);
    },

    search: async (workspaceId, query, options) => {
      const needle = normalizeSearchQuery(query);
      if (needle === '') {
        return this.documents.listByWorkspace(workspaceId, options);
      }

      const page = paginationClause(options);
      // LIKE is case-insensitive for ASCII in SQLite; the wildcards are bound, not interpolated.
      const pattern = likePattern(needle);

      const rows = await this.driver.select<DocumentRow>(
        `SELECT ${DOCUMENT_COLUMNS} FROM documents WHERE workspace_id = ?` +
          ` AND (title LIKE ? ESCAPE '\\' OR excerpt LIKE ? ESCAPE '\\')` +
          `${liveClause(options)} ORDER BY updated_at DESC, id ASC${page.sql}`,
        [workspaceId, pattern, pattern, ...page.params],
      );

      return rows.map(toDocument);
    },

    countByWorkspace: async (workspaceId) => {
      const rows = await this.driver.select<{ count: number }>(
        'SELECT COUNT(*) AS count FROM documents WHERE workspace_id = ? AND deleted_at IS NULL',
        [workspaceId],
      );
      return rows[0]?.count ?? 0;
    },

    listTags: async (workspaceId) =>
      this.driver.select<{ tag: string; count: number }>(
        'SELECT t.tag AS tag, COUNT(*) AS count FROM document_tags t' +
          ' JOIN documents d ON d.id = t.document_id' +
          ' WHERE d.workspace_id = ? AND d.deleted_at IS NULL' +
          ' GROUP BY t.tag ORDER BY count DESC, t.tag ASC',
        [workspaceId],
      ),
  };

  readonly files: FileRepository = {
    get: async (id) => {
      const rows = await this.driver.select<FileRow>(
        `SELECT ${FILE_COLUMNS} FROM files WHERE id = ?`,
        [id],
      );
      const row = rows[0];
      return row ? toFile(row) : null;
    },

    listByDocument: async (documentId, options) => {
      const page = paginationClause(options);
      const rows = await this.driver.select<FileRow>(
        `SELECT ${FILE_COLUMNS} FROM files WHERE document_id = ?${liveClause(options)}` +
          ` ORDER BY updated_at DESC, id ASC${page.sql}`,
        [documentId, ...page.params],
      );
      return rows.map(toFile);
    },

    put: async (file) => {
      await this.saveEntity('file', 'files', FILE_FIELDS, fromFile(file), file.deletedAt !== null);
    },

    purge: async (id) => {
      await this.driver.execute('DELETE FROM files WHERE id = ?', [id]);
    },
  };

  readonly memory: MemoryRepository = {
    get: async (id) => {
      const rows = await this.driver.select<MemoryRow>(
        `SELECT ${MEMORY_COLUMNS} FROM memory_items WHERE id = ?`,
        [id],
      );
      const row = rows[0];
      return row ? toMemoryItem(row) : null;
    },

    listByWorkspace: async (workspaceId, options) => {
      const { where, params } = memoryConditions(workspaceId, options);
      const page = paginationClause(options);
      const rows = await this.driver.select<MemoryRow>(
        `SELECT ${MEMORY_COLUMNS} FROM memory_items WHERE ${where}` +
          ` ORDER BY updated_at DESC, id ASC${page.sql}`,
        [...params, ...page.params],
      );
      return rows.map(toMemoryItem);
    },

    put: async (item) => {
      await this.saveEntity(
        'memory',
        'memory_items',
        MEMORY_FIELDS,
        fromMemoryItem(item),
        item.deletedAt !== null,
      );
    },

    putMany: async (items) => {
      await this.driver.transaction(async () => {
        for (const item of items) await this.memory.put(item);
      });
    },

    purge: async (id) => {
      await this.driver.execute('DELETE FROM memory_items WHERE id = ?', [id]);
    },

    search: async (workspaceId, query, options) => {
      const needle = normalizeSearchQuery(query);
      if (needle === '') return this.memory.listByWorkspace(workspaceId, options);

      const { where, params } = memoryConditions(workspaceId, options);
      const pattern = likePattern(needle);
      const page = paginationClause(options);

      const rows = await this.driver.select<MemoryRow>(
        `SELECT ${MEMORY_COLUMNS} FROM memory_items WHERE ${where}` +
          ` AND (title LIKE ? ESCAPE '\\' OR content LIKE ? ESCAPE '\\'` +
          ` OR source LIKE ? ESCAPE '\\' OR tags LIKE ? ESCAPE '\\')` +
          ` ORDER BY updated_at DESC, id ASC${page.sql}`,
        [...params, pattern, pattern, pattern, pattern, ...page.params],
      );
      return rows.map(toMemoryItem);
    },
  };

  readonly versions: VersionRepository = {
    get: async (id) => {
      const rows = await this.driver.select<VersionRow>(
        `SELECT ${VERSION_COLUMNS} FROM document_versions WHERE id = ?`,
        [id],
      );
      const row = rows[0];
      return row ? toVersion(row) : null;
    },

    listByDocument: async (documentId, options) => {
      const page = paginationClause(options?.limit === undefined ? {} : { limit: options.limit });
      const rows = await this.driver.select<VersionRow>(
        `SELECT ${VERSION_COLUMNS} FROM document_versions WHERE document_id = ?` +
          ` ORDER BY created_at DESC, id DESC${page.sql}`,
        [documentId, ...page.params],
      );
      return rows.map(toVersion);
    },

    add: async (version) => {
      await this.driver.execute(
        `INSERT INTO document_versions (${VERSION_COLUMNS}) VALUES (${placeholders(VERSION_FIELDS.length)})`,
        fromVersion(version),
      );
    },

    prune: async (documentId, keep) => {
      await this.driver.execute(
        'DELETE FROM document_versions WHERE document_id = ? AND id NOT IN' +
          ' (SELECT id FROM document_versions WHERE document_id = ?' +
          ' ORDER BY created_at DESC, id DESC LIMIT ?)',
        [documentId, documentId, Math.max(0, keep)],
      );
    },

    purgeByDocument: async (documentId) => {
      await this.driver.execute('DELETE FROM document_versions WHERE document_id = ?', [
        documentId,
      ]);
    },
  };

  readonly outbox: OutboxRepository = {
    list: async (limit) => {
      const page = paginationClause(limit === undefined ? {} : { limit });
      const rows = await this.driver.select<OutboxRow>(
        `SELECT entity_kind, entity_id, operation, seq, queued_at FROM outbox ORDER BY seq ASC${page.sql}`,
        page.params,
      );
      return rows.map(toOutboxEntry);
    },

    count: async () => {
      const rows = await this.driver.select<{ count: number }>(
        'SELECT COUNT(*) AS count FROM outbox',
      );
      return rows[0]?.count ?? 0;
    },

    acknowledge: async (entries) => {
      await this.driver.transaction(async () => {
        for (const entry of entries) {
          await this.driver.execute(
            'DELETE FROM outbox WHERE entity_kind = ? AND entity_id = ? AND seq = ?',
            [entry.entityKind, entry.entityId, entry.seq],
          );
        }
      });
    },

    clear: async () => {
      await this.driver.execute('DELETE FROM outbox');
    },
  };

  readonly localState: LocalStateRepository = {
    get: async <T>(key: string) => {
      const rows = await this.driver.select<{ value: string }>(
        'SELECT value FROM local_state WHERE key = ?',
        [key],
      );
      const row = rows[0];
      if (!row) return null;

      try {
        return JSON.parse(row.value) as T;
      } catch {
        return null;
      }
    },

    set: async (key, value) => {
      await this.driver.execute(
        'INSERT INTO local_state (key, value, updated_at) VALUES (?, ?, ?)' +
          ' ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
        [key, JSON.stringify(value), new Date().toISOString()],
      );
    },

    delete: async (key) => {
      await this.driver.execute('DELETE FROM local_state WHERE key = ?', [key]);
    },

    keys: async (prefix) => {
      // An exact prefix: LIKE would be case-insensitive here.
      const rows = await this.driver.select<{ key: string }>(
        'SELECT key FROM local_state WHERE substr(key, 1, ?) = ? ORDER BY key',
        [prefix.length, prefix],
      );
      return rows.map((row) => row.key);
    },
  };

  async open(): Promise<void> {
    await migrate(this.driver);
  }

  async close(): Promise<void> {
    await this.driver.close();
  }

  async clear(): Promise<void> {
    await this.driver.transaction(async () => {
      for (const table of TABLES_IN_DELETE_ORDER) {
        await this.driver.execute(`DELETE FROM ${table}`);
      }
    });
  }
}

export function createSqliteDatabase(driver: SqlDriver): NotoDatabase {
  return new SqliteDatabase(driver);
}
