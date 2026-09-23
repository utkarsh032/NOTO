import type {
  DocumentStatus,
  DocumentVersionRecord,
  Folder,
  Id,
  MemoryItem,
  MemoryKind,
  NotoDocument,
  NotoFile,
  OutboxEntry,
  Workspace,
} from '@noto/types';

/**
 * Options shared by every list query.
 *
 * Soft-deleted rows are excluded by default: tombstones exist for the sync
 * layer, and application code should have to ask for them explicitly.
 */
export interface ListOptions {
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
}

export interface ListDocumentsOptions extends ListOptions {
  folderId?: Id | null;
  status?: DocumentStatus;
  favoritesOnly?: boolean;
  /** Only documents carrying this tag. Matched exactly, case included. */
  tag?: string;
  /** `'updatedAt'` (newest first) unless stated otherwise. */
  orderBy?: 'updatedAt' | 'createdAt' | 'title';
}

export interface WorkspaceRepository {
  get(id: Id): Promise<Workspace | null>;
  list(options?: ListOptions): Promise<Workspace[]>;
  put(workspace: Workspace): Promise<void>;
  /** Removes the row outright. Use only once sync has confirmed the tombstone. */
  purge(id: Id): Promise<void>;
}

export interface FolderRepository {
  get(id: Id): Promise<Folder | null>;
  listByWorkspace(workspaceId: Id, options?: ListOptions): Promise<Folder[]>;
  put(folder: Folder): Promise<void>;
  putMany(folders: readonly Folder[]): Promise<void>;
  purge(id: Id): Promise<void>;
}

export interface DocumentRepository {
  get(id: Id): Promise<NotoDocument | null>;
  listByWorkspace(workspaceId: Id, options?: ListDocumentsOptions): Promise<NotoDocument[]>;
  put(document: NotoDocument): Promise<void>;
  putMany(documents: readonly NotoDocument[]): Promise<void>;
  purge(id: Id): Promise<void>;
  /** Case-insensitive match over title and excerpt. */
  search(workspaceId: Id, query: string, options?: ListOptions): Promise<NotoDocument[]>;
  countByWorkspace(workspaceId: Id): Promise<number>;
  /** Every tag on a live document, most used first, then by name. */
  listTags(workspaceId: Id): Promise<TagCount[]>;
}

export interface TagCount {
  tag: string;
  count: number;
}

export interface FileRepository {
  get(id: Id): Promise<NotoFile | null>;
  listByDocument(documentId: Id, options?: ListOptions): Promise<NotoFile[]>;
  put(file: NotoFile): Promise<void>;
  purge(id: Id): Promise<void>;
}

export interface ListMemoryOptions extends ListOptions {
  kind?: MemoryKind;
  pinnedOnly?: boolean;
}

/** Noto Memory: everything captured, newest first. */
export interface MemoryRepository {
  get(id: Id): Promise<MemoryItem | null>;
  listByWorkspace(workspaceId: Id, options?: ListMemoryOptions): Promise<MemoryItem[]>;
  put(item: MemoryItem): Promise<void>;
  putMany(items: readonly MemoryItem[]): Promise<void>;
  purge(id: Id): Promise<void>;
  /** Case-insensitive match over title, content, source and tags. */
  search(workspaceId: Id, query: string, options?: ListMemoryOptions): Promise<MemoryItem[]>;
}

/**
 * Document versions: immutable snapshots, newest first.
 *
 * Local only for now. They are not queued for sync; hosted history is a
 * separate, plan-limited feature.
 */
export interface VersionRepository {
  get(id: Id): Promise<DocumentVersionRecord | null>;
  listByDocument(documentId: Id, options?: { limit?: number }): Promise<DocumentVersionRecord[]>;
  add(version: DocumentVersionRecord): Promise<void>;
  /** Keeps the newest `keep` versions of a document and deletes the rest. */
  prune(documentId: Id, keep: number): Promise<void>;
  purgeByDocument(documentId: Id): Promise<void>;
}

/**
 * What changed on this device and has not been pushed. Written by the
 * repositories on every local save; read and acknowledged by the sync engine.
 */
export interface OutboxRepository {
  /** Oldest first. */
  list(limit?: number): Promise<OutboxEntry[]>;
  count(): Promise<number>;
  /**
   * Removes entries a push delivered — but only where `seq` still matches, so
   * an edit that arrived during the push stays queued.
   */
  acknowledge(
    entries: readonly Pick<OutboxEntry, 'entityKind' | 'entityId' | 'seq'>[],
  ): Promise<void>;
  clear(): Promise<void>;
}

/**
 * Small values this device keeps for itself: crash-recovery snapshots,
 * unsent drafts. Never synced. A key-value table rather than localStorage,
 * which is capped at a few megabytes and cleared along with a site's cookies.
 */
export interface LocalStateRepository {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  /** Every key beginning with `prefix`. */
  keys(prefix: string): Promise<string[]>;
}

/**
 * The single storage contract every Noto platform implements: IndexedDB/Dexie
 * on web, SQLite on desktop and mobile. Application and UI code depends on this
 * interface only, never on a concrete engine.
 */
export interface NotoDatabase {
  readonly workspaces: WorkspaceRepository;
  readonly folders: FolderRepository;
  readonly documents: DocumentRepository;
  readonly files: FileRepository;
  readonly memory: MemoryRepository;
  readonly versions: VersionRepository;
  readonly outbox: OutboxRepository;
  readonly localState: LocalStateRepository;

  /** Opens the connection and applies any pending migrations. */
  open(): Promise<void>;
  close(): Promise<void>;
  /** Drops all local data. Used by "reset local data" and by tests. */
  clear(): Promise<void>;
}
