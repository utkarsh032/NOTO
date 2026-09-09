import type { Id } from '@noto/types';
import { create } from 'zustand';

/**
 * Ephemeral shell state — what is open, what is selected, what is focused.
 *
 * Nothing here is persisted or synced; it is rebuilt on every launch.
 */
export interface UiStore {
  sidebarCollapsed: boolean;
  /**
   * Whether the workspace's context panel is open.
   *
   * It lives here beside `sidebarCollapsed` because it is the same kind of
   * thing — how much of the window the document gets — and because the control
   * that toggles it is in the header while the panel it opens is in the
   * workspace. Two components, one answer.
   */
  contextPanelOpen: boolean;
  commandPaletteOpen: boolean;
  activeWorkspaceId: Id | null;
  activeDocumentId: Id | null;
  activeFolderId: Id | null;
  searchQuery: string;

  toggleSidebar(): void;
  setSidebarCollapsed(collapsed: boolean): void;
  toggleContextPanel(): void;
  setContextPanelOpen(open: boolean): void;
  setCommandPaletteOpen(open: boolean): void;
  setActiveWorkspace(id: Id | null): void;
  setActiveDocument(id: Id | null): void;
  setActiveFolder(id: Id | null): void;
  setSearchQuery(query: string): void;
}

export const useUiStore = create<UiStore>()((set) => ({
  sidebarCollapsed: false,
  /* Open to begin with: the outline is how a long document is navigated, and a
     panel that has to be found before it can help is one most people never
     find. The control beside the tabs is there to put it away. */
  contextPanelOpen: true,
  commandPaletteOpen: false,
  activeWorkspaceId: null,
  activeDocumentId: null,
  activeFolderId: null,
  searchQuery: '',

  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
  toggleContextPanel: () => set((state) => ({ contextPanelOpen: !state.contextPanelOpen })),
  setContextPanelOpen: (contextPanelOpen) => set({ contextPanelOpen }),
  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
  setActiveWorkspace: (activeWorkspaceId) => set({ activeWorkspaceId }),
  // Changing folders clears the open document so the two never disagree.
  setActiveFolder: (activeFolderId) => set({ activeFolderId, activeDocumentId: null }),
  setActiveDocument: (activeDocumentId) => set({ activeDocumentId }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
}));
