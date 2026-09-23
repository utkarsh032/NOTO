/** Unique identifier for any Noto entity. UUID v4 unless stated otherwise. */
export type Id = string;

/** An ISO-8601 timestamp string, always stored in UTC. */
export type IsoDateTime = string;

/** Every persisted Noto entity carries these fields. */
export interface Entity {
  id: Id;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  /** Set when the entity is soft-deleted; `null` while it is live. */
  deletedAt: IsoDateTime | null;
  /**
   * How many times this device has saved the entity. Maintained by storage —
   * a caller never sets it, and one that does is ignored — and absent on an
   * entity that has not been saved yet. Sync compares it to decide which of
   * two edits is newer.
   */
  version?: number;
}

/** A discriminated result type used across core operations instead of throwing. */
export type Result<T, E = NotoError> = { ok: true; value: T } | { ok: false; error: E };

export type NotoErrorCode =
  | 'not_found'
  | 'conflict'
  | 'invalid_input'
  | 'permission_denied'
  | 'storage_unavailable'
  | 'sync_failed'
  | 'unknown';

export interface NotoError {
  code: NotoErrorCode;
  message: string;
  cause?: unknown;
}
