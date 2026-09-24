import { createId, hashContent } from '@noto/core';
import type { DocumentVersionRecord, NotoDocument, VersionOrigin } from '@noto/types';

import type { NotoDatabase } from './types';

/**
 * When Noto keeps a version of a document.
 *
 * Not on every save — autosave writes every second or so while someone types,
 * and a history of a thousand near-identical rows is no history at all. A
 * version is the state a document *rested* in: before a change lands, if the
 * last version is older than the interval, the text as it was is kept. Saving
 * explicitly and restoring keep a version whatever the interval.
 */
export interface VersionPolicy {
  /** The least time between two automatic versions of one document. */
  intervalMs: number;
  /** Versions kept per document; older ones are pruned. */
  keep: number;
}

export const DEFAULT_VERSION_POLICY: VersionPolicy = {
  intervalMs: 10 * 60_000,
  keep: 50,
};

export interface VersionOptions {
  policy?: VersionPolicy;
  summary?: string | null;
  now?: () => Date;
  generateId?: () => string;
}

export function versionOf(
  document: NotoDocument,
  origin: VersionOrigin,
  options: VersionOptions = {},
): DocumentVersionRecord {
  return {
    id: (options.generateId ?? createId)(),
    documentId: document.id,
    workspaceId: document.workspaceId,
    title: document.title,
    content: document.content,
    wordCount: document.wordCount,
    contentHash: hashContent(document.content),
    origin,
    summary: options.summary ?? null,
    createdAt: (options.now ?? (() => new Date()))().toISOString(),
  };
}

/**
 * Keeps a version of `document` as it is now, unless the newest version
 * already has this exact body. Resolves with what was kept, or `null`.
 */
export async function recordVersion(
  database: NotoDatabase,
  document: NotoDocument,
  origin: VersionOrigin,
  options: VersionOptions = {},
): Promise<DocumentVersionRecord | null> {
  if (isBlank(document)) return null;

  const [latest] = await database.versions.listByDocument(document.id, { limit: 1 });
  const version = versionOf(document, origin, options);
  if (latest?.contentHash === version.contentHash) return null;

  await database.versions.add(version);
  await database.versions.prune(document.id, (options.policy ?? DEFAULT_VERSION_POLICY).keep);

  return version;
}

/**
 * Called with a document before and after an edit, before the edit is
 * written. Keeps the before, if its body is changing and the last version is
 * older than the interval. Resolves with what was kept, or `null`.
 */
export async function snapshotBeforeChange(
  database: NotoDatabase,
  previous: NotoDocument,
  next: NotoDocument,
  options: VersionOptions = {},
): Promise<DocumentVersionRecord | null> {
  if (isBlank(previous)) return null;

  const before = hashContent(previous.content);
  if (before === hashContent(next.content)) return null;

  const policy = options.policy ?? DEFAULT_VERSION_POLICY;
  const now = (options.now ?? (() => new Date()))();
  const [latest] = await database.versions.listByDocument(previous.id, { limit: 1 });

  if (latest) {
    if (latest.contentHash === before) return null;
    if (now.getTime() - Date.parse(latest.createdAt) < policy.intervalMs) return null;
  }

  return recordVersion(database, previous, 'autosave', { ...options, now: () => now });
}

/**
 * A document with no words is not worth a version: there is nothing in it to
 * go back to, and every new document starts that way.
 */
function isBlank(document: NotoDocument): boolean {
  return document.wordCount === 0;
}
