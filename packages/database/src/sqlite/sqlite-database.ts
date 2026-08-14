import { normalizeSearchQuery } from '../query';
import type {
  DocumentRepository,
  FileRepository,
  FolderRepository,
  ListDocumentsOptions,
  ListOptions,
  NotoDatabase,
  WorkspaceRepository,
} from '../types';
import type { SqlDriver, SqlValue } from './driver';
import {
  type DocumentRow,
  type FileRow,
  type FolderRow,
  type WorkspaceRow,
  fromDocument,
  fromFile,
  fromFolder,
  fromWorkspace,
  toDocument,
  toFile,
  toFolder,
  toWorkspace,
} from './rows';
import { TABLES_IN_DELETE_ORDER, migrate } from './schema';

const WORKSPACE_COLUMNS = 'id, name, owner_id, is_local, icon, created_at, updated_at, deleted_at';
const FOLDER_COLUMNS =
  'id, workspace_id, parent_id, name, position, color, icon, created_at, updated_at, deleted_at';
const DOCUMENT_COLUMNS =
  'id, workspace_id, folder_id, title, content, status, excerpt, word_count, is_favorite, tags, created_at, updated_at, deleted_at';
const FILE_COLUMNS =
  'id, workspace_id, document_id, name, mime_type, size, local_path, remote_url, checksum, created_at, updated_at, deleted_at';

function placeholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(', ');
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

/**
 * SQLite-backed storage for the desktop and mobile applications.
 *
 * The queries live here; the engine does not. Electron and Expo each pass in a
 * `SqlDriver`, which is the only thing that differs between the two platforms.
 */
export class SqliteDatabase implements NotoDatabase {
  constructor(private readonly driver: SqlDriver) {}

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
      await this.driver.execute(
        `INSERT OR REPLACE INTO workspaces (${WORKSPACE_COLUMNS}) VALUES (${placeholders(8)})`,
        fromWorkspace(workspace),
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
      await this.driver.execute(
        `INSERT OR REPLACE INTO folders (${FOLDER_COLUMNS}) VALUES (${placeholders(10)})`,
        fromFolder(folder),
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
      await this.driver.execute(
        `INSERT OR REPLACE INTO documents (${DOCUMENT_COLUMNS}) VALUES (${placeholders(13)})`,
        fromDocument(document),
      );
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
      const pattern = `%${needle.replace(/[%_]/gu, (match) => `\\${match}`)}%`;

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
      await this.driver.execute(
        `INSERT OR REPLACE INTO files (${FILE_COLUMNS}) VALUES (${placeholders(12)})`,
        fromFile(file),
      );
    },

    purge: async (id) => {
      await this.driver.execute('DELETE FROM files WHERE id = ?', [id]);
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
