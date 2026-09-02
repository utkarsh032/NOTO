import type { Entity, Id } from './common.ts';

/**
 * The top-level container for documents, folders and files. Noto always has at
 * least one local workspace, created on first launch, so the app works offline
 * and without an account.
 */
export interface Workspace extends Entity {
  name: string;
  ownerId: Id | null;
  /** `true` for the offline workspace created on first launch. */
  isLocal: boolean;
  icon: string | null;
}

export interface CreateWorkspaceInput {
  name: string;
  ownerId?: Id | null;
  isLocal?: boolean;
  icon?: string | null;
}
