import { z } from 'zod';

/**
 * What a device may send to the sync routes (Node plan §6: `sync`, `workspaces`).
 *
 * The entity shapes are `@noto/types`' own — the device sends what it stores.
 * Fields the device keeps for itself (`version`, `contentHash`, a file's
 * `localPath`) are dropped here rather than refused, so a client that sends
 * a little more than it must is not broken by it.
 */

export const PUSH_CAP = 200;
export const PULL_CAP = 500;

const timestamp = z.iso.datetime({ offset: true });
const tags = z.array(z.string().trim().min(1).max(100)).max(100);

const entityBase = {
  id: z.uuid(),
  createdAt: timestamp,
  updatedAt: timestamp,
  deletedAt: timestamp.nullable(),
};

const workspaceEntity = z.object({
  ...entityBase,
  name: z.string().trim().min(1).max(200),
  icon: z.string().max(100).nullable(),
});

const folderEntity = z.object({
  ...entityBase,
  workspaceId: z.uuid(),
  parentId: z.uuid().nullable(),
  name: z.string().trim().min(1).max(200),
  position: z.number().int(),
  color: z.string().max(40).nullable(),
  icon: z.string().max(100).nullable(),
});

const documentEntity = z.object({
  ...entityBase,
  workspaceId: z.uuid(),
  folderId: z.uuid().nullable(),
  title: z.string().max(1000),
  content: z.looseObject({ type: z.literal('doc'), content: z.array(z.unknown()).optional() }),
  status: z.enum(['draft', 'active', 'archived']),
  excerpt: z.string().max(10_000),
  wordCount: z.number().int().min(0),
  isFavorite: z.boolean(),
  tags,
});

const fileEntity = z.object({
  ...entityBase,
  workspaceId: z.uuid(),
  documentId: z.uuid().nullable(),
  name: z.string().trim().min(1).max(255),
  mimeType: z.string().min(1).max(255),
  size: z.number().int().min(0),
  checksum: z.string().max(128).nullable(),
});

const memoryEntity = z.object({
  ...entityBase,
  workspaceId: z.uuid(),
  kind: z.enum(['note', 'clipboard', 'screenshot', 'image', 'link', 'file']),
  title: z.string().max(1000),
  content: z.string().max(1_000_000),
  source: z.string().max(500).nullable(),
  url: z.string().max(4096).nullable(),
  tags,
  isPinned: z.boolean(),
  sizeBytes: z.number().int().min(0).nullable(),
});

const change = {
  operation: z.enum(['create', 'update', 'delete']),
  baseVersion: z.number().int().min(0),
};

export const pushChangeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('workspace'), entity: workspaceEntity, ...change }),
  z.object({ kind: z.literal('folder'), entity: folderEntity, ...change }),
  z.object({ kind: z.literal('document'), entity: documentEntity, ...change }),
  z.object({ kind: z.literal('file'), entity: fileEntity, ...change }),
  z.object({ kind: z.literal('memory'), entity: memoryEntity, ...change }),
]);

export type PushChange = z.infer<typeof pushChangeSchema>;

export const pushSchema = z.object({
  deviceId: z.uuid(),
  workspaceId: z.uuid(),
  changes: z.array(pushChangeSchema).max(PUSH_CAP),
});

export const pullSchema = z.object({
  deviceId: z.uuid(),
  workspaceId: z.uuid(),
  sinceSeq: z.number().int().min(0),
  limit: z.number().int().min(1).max(PULL_CAP).optional(),
});

/** A claim sends the workspace as the device has it. */
export const claimSchema = z.object({
  name: z.string().trim().min(1).max(200),
  icon: z.string().max(100).nullable().optional(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
