import type { Entity, Id } from './common';

/** A binary attachment (image, PDF, arbitrary upload) referenced by a document. */
export interface NotoFile extends Entity {
  workspaceId: Id;
  documentId: Id | null;
  name: string;
  mimeType: string;
  /** Size in bytes. */
  size: number;
  /** Location in local storage — an OPFS/IndexedDB key on web, a path on desktop/mobile. */
  localPath: string | null;
  /** Location in cloud storage once uploaded. */
  remoteUrl: string | null;
  checksum: string | null;
}

export interface CreateFileInput {
  workspaceId: Id;
  documentId?: Id | null;
  name: string;
  mimeType: string;
  size: number;
  localPath?: string | null;
}
