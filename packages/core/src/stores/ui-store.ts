import type { Id } from '@noto/types';
import { create } from 'zustand';

/**
 * Ephemeral shell state — what is open, what is selected, what is focused.
 *
 * Nothing here is persisted or synced; it is rebuilt on every launch.
 */
export interface UiStore {
  sidebarCollapsed: boolean;
  commandPaletteOpen: boolean;
  activeWorkspaceId: Id | null;
  activeDocumentId: Id | null;
  activeFolderId: Id | null;
  searchQuery: string;

  toggleSidebar(): void;
  setSidebarCollapsed(collapsed: boolean): void;
  setCommandPaletteOpen(open: boolean): void;
  setActiveWorkspace(id: Id | null): void;
  setActiveDocument(id: Id | null): void;
  setActiveFolder(id: Id | null): void;
  setSearchQuery(query: string): void;
}

export const useUiStore = create<UiStore>()((set) => ({
  sidebarCollapsed: false,
  commandPaletteOpen: false,
  activeWorkspaceId: null,
  activeDocumentId: null,
  activeFolderId: null,
  searchQuery: '',

  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
  setActiveWorkspace: (activeWorkspaceId) => set({ activeWorkspaceId }),
  // Changing folders clears the open document so the two never disagree.
  setActiveFolder: (activeFolderId) => set({ activeFolderId, activeDocumentId: null }),
  setActiveDocument: (activeDocumentId) => set({ activeDocumentId }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
}));
