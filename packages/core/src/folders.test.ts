import type { Folder, NotoDocument } from '@noto/types';
import { describe, expect, it } from 'vitest';

import { buildFolderTree, isDescendantOf, moveFolder } from './folders.ts';

const folder = (id: string, parentId: string | null, name = id, position = 0): Folder => ({
  id,
  workspaceId: 'ws-1',
  parentId,
  name,
  position,
  color: null,
  icon: null,
  createdAt: '2026-08-13T10:00:00.000Z',
  updatedAt: '2026-08-13T10:00:00.000Z',
  deletedAt: null,
});

const document = (id: string, folderId: string | null, deletedAt: string | null = null) =>
  ({ id, folderId, deletedAt }) as NotoDocument;

// root → child → grandchild, plus a second root.
const folders: Folder[] = [
  folder('root', null),
  folder('child', 'root'),
  folder('grandchild', 'child'),
  folder('other', null),
];

describe('isDescendantOf', () => {
  it('detects direct and indirect descendants', () => {
    expect(isDescendantOf(folders, 'child', 'root')).toBe(true);
    expect(isDescendantOf(folders, 'grandchild', 'root')).toBe(true);
  });

  it('rejects unrelated folders and self-comparison', () => {
    expect(isDescendantOf(folders, 'other', 'root')).toBe(false);
    expect(isDescendantOf(folders, 'root', 'root')).toBe(false);
  });

  it('terminates on data that already contains a cycle', () => {
    const cyclic = [folder('a', 'b'), folder('b', 'a')];
    expect(isDescendantOf(cyclic, 'a', 'missing')).toBe(false);
  });
});

describe('moveFolder', () => {
  it('reparents a folder', () => {
    const result = moveFolder(folders, 'other', 'root');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.parentId).toBe('root');
  });

  it('moves a folder to the workspace root', () => {
    const result = moveFolder(folders, 'grandchild', null);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.parentId).toBeNull();
  });

  it('refuses to move a folder into itself', () => {
    const result = moveFolder(folders, 'root', 'root');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('invalid_input');
  });

  it('refuses to move a folder into its own descendant', () => {
    const result = moveFolder(folders, 'root', 'grandchild');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('invalid_input');
  });

  it('reports a missing folder or parent', () => {
    expect(moveFolder(folders, 'nope', null).ok).toBe(false);
    expect(moveFolder(folders, 'root', 'nope').ok).toBe(false);
  });
});

describe('buildFolderTree', () => {
  it('nests folders under their parents', () => {
    const tree = buildFolderTree(folders);

    expect(tree.map((node) => node.id)).toEqual(['other', 'root']);
    const root = tree.find((node) => node.id === 'root');
    expect(root?.children.map((node) => node.id)).toEqual(['child']);
    expect(root?.children[0]?.children.map((node) => node.id)).toEqual(['grandchild']);
  });

  it('sorts siblings by position then name', () => {
    const siblings = [
      folder('b', null, 'Beta', 1),
      folder('a', null, 'Alpha', 1),
      folder('c', null, 'Gamma', 0),
    ];

    expect(buildFolderTree(siblings).map((node) => node.name)).toEqual(['Gamma', 'Alpha', 'Beta']);
  });

  it('counts live documents per folder and ignores deleted ones', () => {
    const documents = [
      document('d1', 'root'),
      document('d2', 'root'),
      document('d3', 'root', '2026-08-13T12:00:00.000Z'),
      document('d4', null),
    ];

    const root = buildFolderTree(folders, documents).find((node) => node.id === 'root');
    expect(root?.documentCount).toBe(2);
  });

  it('omits deleted folders and lifts their orphans to the root', () => {
    const withDeletedParent: Folder[] = [
      { ...folder('root', null), deletedAt: '2026-08-13T12:00:00.000Z' },
      folder('child', 'root'),
    ];

    const tree = buildFolderTree(withDeletedParent);
    expect(tree.map((node) => node.id)).toEqual(['child']);
  });
});
