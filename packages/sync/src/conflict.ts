import { hashContent } from '@noto/core';
import type { NotoDocument, RemoteChange, SyncRecord } from '@noto/types';

import { recordOf } from './records';

/**
 * How a conflict ends.
 *
 * `remote`: the server's copy replaces the local change. `local`: `record` is
 * written locally on top of the server's version and pushed again; when two
 * different document bodies met, `lostBody` is the server's, kept in version
 * history so neither side's writing is lost.
 */
export type Resolution =
  { winner: 'remote' } | { winner: 'local'; record: SyncRecord; lostBody: NotoDocument | null };

/** Newer wins; on a tie the server does, since it already holds that copy. */
const localIsNewer = (local: SyncRecord, remote: SyncRecord): boolean =>
  local.entity.updatedAt > remote.entity.updatedAt;

/**
 * The conflict rule (audit plan phase 4, step 4; Backend_Node_Plan §9.6).
 *
 * A conflict is a local change made on a server version that has since moved
 * on. It is resolved by the device that finds it, and the result is pushed on
 * top of the server's version, so every device converges on one answer.
 *
 * 1. A delete beats an edit, whichever side made it.
 * 2. Two different document bodies are never merged and never dropped: the
 *    local body stays in the editor and the server's is kept as a version.
 *    The metadata (title, tags, folder…) comes from the newer of the two.
 * 3. Anything else is last-writer-wins on `updatedAt`.
 */
export function resolveConflict(local: SyncRecord, change: RemoteChange): Resolution {
  const remote = recordOf(change);

  if (remote.entity.deletedAt !== null) return { winner: 'remote' };
  if (local.entity.deletedAt !== null) return { winner: 'local', record: local, lostBody: null };

  if (local.kind === 'document' && remote.kind === 'document') {
    const mine = local.entity;
    const theirs = remote.entity;

    if (hashContent(mine.content) !== hashContent(theirs.content)) {
      const metadata = localIsNewer(local, remote) ? mine : theirs;
      return {
        winner: 'local',
        record: {
          kind: 'document',
          entity: {
            ...metadata,
            content: mine.content,
            excerpt: mine.excerpt,
            wordCount: mine.wordCount,
            updatedAt: mine.updatedAt > theirs.updatedAt ? mine.updatedAt : theirs.updatedAt,
          },
        },
        lostBody: theirs,
      };
    }
  }

  return localIsNewer(local, remote)
    ? { winner: 'local', record: local, lostBody: null }
    : { winner: 'remote' };
}
