import { DEFAULT_WORKSPACE_NAME } from '@noto/config';
import type { CreateWorkspaceInput, Workspace } from '@noto/types';

import { type Clock, systemClock } from './clock.ts';
import { createId } from './id.ts';

export interface WorkspaceDeps {
  clock?: Clock;
  generateId?: () => string;
}

export function createWorkspace(input: CreateWorkspaceInput, deps: WorkspaceDeps = {}): Workspace {
  const clock = deps.clock ?? systemClock;
  const generateId = deps.generateId ?? createId;
  const timestamp = clock.now();

  return {
    id: generateId(),
    name: input.name.trim() || DEFAULT_WORKSPACE_NAME,
    ownerId: input.ownerId ?? null,
    isLocal: input.isLocal ?? true,
    icon: input.icon ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  };
}

/**
 * The offline workspace Noto creates on first launch, before any account
 * exists, so the app is usable immediately and without a network.
 */
export function createDefaultWorkspace(deps: WorkspaceDeps = {}): Workspace {
  return createWorkspace({ name: DEFAULT_WORKSPACE_NAME, isLocal: true }, deps);
}
