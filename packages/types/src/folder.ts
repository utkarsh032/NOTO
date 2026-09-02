import type { Entity, Id } from './common.ts';

export interface Folder extends Entity {
  workspaceId: Id;
  /** `null` means the folder sits at the workspace root. */
  parentId: Id | null;
  name: string;
  /** Manual ordering position among siblings. */
  position: number;
  color: string | null;
  icon: string | null;
}

export interface CreateFolderInput {
  workspaceId: Id;
  parentId?: Id | null;
  name: string;
  color?: string | null;
  icon?: string | null;
}

export type UpdateFolderInput = Partial<
  Pick<Folder, 'name' | 'parentId' | 'position' | 'color' | 'icon'>
>;

/** A folder with its children resolved, used to render the sidebar tree. */
export interface FolderNode extends Folder {
  children: FolderNode[];
  documentCount: number;
}
