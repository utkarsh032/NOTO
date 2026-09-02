export { cn } from './utils/cn';
export * from './utils/format';

/* ── Primitives ────────────────────────────────────────────────────────── */

export { Button, type ButtonProps, type ButtonSize, type ButtonVariant } from './components/Button';
export {
  IconButton,
  type IconButtonProps,
  type IconButtonSize,
  type IconButtonVariant,
} from './components/IconButton';
export { Input, Select, type InputProps, type SelectProps } from './components/Input';
export { SearchInput, type SearchInputProps } from './components/SearchInput';
export { Toggle, type ToggleProps } from './components/Toggle';
export { fieldClasses } from './components/field-styles';
export { Card, CardHeader, type CardHeaderProps, type CardProps } from './components/Card';
export { Panel, type PanelProps } from './components/Panel';
export { Badge, type BadgeProps, type BadgeTone } from './components/Badge';
export { Avatar, type AvatarProps } from './components/Avatar';
export { KeyHint, type KeyHintProps } from './components/KeyHint';
export { ThemeToggle, type ThemeToggleProps } from './components/ThemeToggle';
export {
  SegmentedControl,
  type SegmentedControlProps,
  type SegmentedOption,
} from './components/SegmentedControl';
export { Tabs, type TabItem, type TabsProps } from './components/Tabs';
export { Tooltip, type TooltipProps } from './components/Tooltip';
export { Dropdown, type DropdownItem, type DropdownProps } from './components/Dropdown';
export { Dialog, type DialogProps, type DialogSize } from './components/Dialog';
export { ConfirmDialog, type ConfirmDialogProps } from './components/ConfirmDialog';
export { PromptDialog, type PromptDialogProps } from './components/PromptDialog';
export { VirtualList, type VirtualListProps } from './components/VirtualList';

/* ── States ────────────────────────────────────────────────────────────── */

export {
  Skeleton,
  SkeletonText,
  type SkeletonProps,
  type SkeletonTextProps,
} from './components/Skeleton';
export { Spinner, type SpinnerProps } from './components/Spinner';
export {
  StatusIndicator,
  type StatusIndicatorProps,
  type StatusKind,
} from './components/StatusIndicator';
export { SyncStatus, type SyncStatusProps } from './components/SyncStatus';
export { EmptyState, type EmptyStateProps } from './components/EmptyState';
export { ErrorState, type ErrorStateProps } from './components/ErrorState';
export { LoadingState, type LoadingStateProps } from './components/LoadingState';
export { ToastViewport } from './components/Toast';
export {
  dismissToast,
  showToast,
  useToasts,
  type Toast,
  type ToastTone,
} from './components/toast-store';
export { ToolbarButton, type ToolbarButtonProps } from './components/ToolbarButton';
export * from './components/icons';
export * from './components/illustrations';

/* ── Theme ─────────────────────────────────────────────────────────────── */

export { ThemeProvider, type ThemeProviderProps } from './theme/ThemeProvider';
export { useResolvedTheme } from './theme/use-resolved-theme';

/* ── Application shell ─────────────────────────────────────────────────── */

export { NotoApp } from './app/NotoApp';
export { NotoAppShell, type NotoAppShellProps } from './app/NotoAppShell';
export { Sidebar, type SidebarProps } from './app/Sidebar';
export { Header, type HeaderProps } from './app/Header';
export { NavItem, type NavItemProps } from './app/NavItem';
export { SidebarUpdateButton, SidebarVersion, type SidebarUpdateProps } from './app/SidebarUpdate';
export { UserMenu, type UserMenuProps } from './app/UserMenu';
export { SidebarToggle, type SidebarToggleProps } from './app/SidebarToggle';
export { MobileNav, type MobileNavProps } from './app/MobileNav';
export { PageContainer, type PageContainerProps } from './app/PageContainer';
export { PRIMARY_NAV, isEntryActive, type NavEntry } from './app/navigation';
export {
  navigate,
  parseRoute,
  replaceRoute,
  routeToHash,
  useRouteHash,
  type Route,
  type RouteName,
} from './app/router';
export { useRoute } from './app/use-route';
export { useViewport, type Viewport } from './app/use-viewport';
export { useDebouncedValue } from './app/use-debounced-value';
export { useNotoActions, type NotoActions } from './app/use-noto-actions';
export { useAccount, firstNameOf } from './app/use-account';
export {
  AccountContext,
  useAccountContext,
  type AccountPlan,
  type AccountSignInResult,
  type AccountSignUpInput,
  type AccountValue,
  type SecurityState,
} from './app/account-context';

/*
 * The screens themselves are deliberately not exported.
 *
 * `NotoApp` loads them lazily, one chunk each, so opening Noto costs Home and
 * the shell rather than the editor, the settings screen and everything else at
 * once. Re-exporting them here would put them all back in the entry chunk of
 * any application that imports this package.
 */

/* ── Documents ─────────────────────────────────────────────────────────── */

export { DocumentRow, type DocumentRowProps } from './app/documents/DocumentRow';
export { DocumentCard, type DocumentCardProps } from './app/documents/DocumentCard';
export { DocumentMenu, type DocumentMenuProps } from './app/documents/DocumentMenu';
export {
  useDocumentOperations,
  type DocumentOperations,
} from './app/documents/use-document-operations';

/* ── Editor ────────────────────────────────────────────────────────────── */

/*
 * The editor components are not exported either, for the same reason as the
 * screens and more so: they carry Tiptap and ProseMirror with them, which is
 * the largest thing Noto ships. Re-exporting them here would anchor all of it
 * to the entry chunk, and Home — the screen Noto opens on — has no editor in
 * it. They are reached through the workspace screen, which is loaded lazily.
 *
 * Only the pure helpers cross this boundary.
 */
export { buildOutline, scrollToHeading, type OutlineEntry } from './app/editor/outline';
export {
  EditorStatusBar,
  type EditorSaveState,
  type EditorStatusBarProps,
} from './app/editor/EditorStatusBar';
export { TabBar, type TabBarProps } from './app/TabBar';

/* ── Memory and search ─────────────────────────────────────────────────── */

export { MemoryCard, type MemoryCardProps } from './app/memory/MemoryCard';
export { MEMORY_KINDS, MEMORY_KIND_ORDER, type MemoryKindInfo } from './app/memory/memory-kinds';
export { useMemory, type MemoryQuery, type MemoryValue } from './app/memory/use-memory';
export { Highlight, type HighlightProps } from './app/search/Highlight';
export { SearchResultRow, type SearchResultRowProps } from './app/search/SearchResultRow';
export {
  matchesScope,
  useSearch,
  type SearchHit,
  type SearchResults,
  type SearchScope,
} from './app/search/use-search';

/* ── Settings and account ──────────────────────────────────────────────── */

export {
  SettingsRow,
  SettingsSection,
  type SettingsRowProps,
  type SettingsSectionProps,
} from './app/settings/SettingsSection';
export { DeviceCard, type DeviceCardProps } from './app/account/DeviceCard';
export { SessionRow, type SessionRowProps } from './app/account/SessionRow';

/* ── Overlays ──────────────────────────────────────────────────────────── */

export { CommandPalette, type CommandPaletteProps } from './app/overlays/CommandPalette';
export { QuickNote, type QuickNoteProps } from './app/overlays/QuickNote';
export { QuickPaste, type QuickPasteProps } from './app/overlays/QuickPaste';
export { ShortcutsDialog, type ShortcutsDialogProps } from './app/overlays/ShortcutsDialog';
export { AIAssistantPanel, type AIAssistantPanelProps } from './app/overlays/AIAssistantPanel';
export { FloatingNoto, type FloatingNotoProps } from './app/overlays/FloatingNoto';
export { SmartSidebar, type SmartSidebarProps } from './app/overlays/SmartSidebar';
export { ImportDialog, type ImportDialogProps } from './app/overlays/ImportDialog';
export { ExportDialog, type ExportDialogProps } from './app/overlays/ExportDialog';

/* ── The Quick Note dock ───────────────────────────────────────────────── */

/*
 * The handle and the panel are exported separately from the dock that hosts
 * them. Inside the application `QuickNoteDock` is the whole thing; on the
 * desktop the host is an operating-system window that moves itself, and it
 * needs the two pieces without the browser-window positioning around them.
 */
export { QuickNoteDock, type QuickNoteDockProps } from './app/dock/QuickNoteDock';
export { DockHandle, type DockHandleProps } from './app/dock/DockHandle';
export { DockPanel, type DockPanelProps, type DockRecentDocument } from './app/dock/DockPanel';
export {
  DEFAULT_DOCK_PLACEMENT,
  clampOffset,
  readDockPlacement,
  setDockEnabled,
  subscribeToDockPlacement,
  writeDockPlacement,
  type DockPlacement,
  type DockSide,
} from './app/dock/dock-placement';
export {
  quickNoteTitle,
  readQuickNoteDraft,
  subscribeToQuickNoteDraft,
  writeQuickNoteDraft,
} from './app/quick-note-draft';

/* ── Data and platform seam ────────────────────────────────────────────── */

export { NotoDataContext, useNotoData, type NotoDataValue } from './app/data-context';
export { useNotoDataSource, type NotoDataSourceOptions } from './app/use-noto-data-source';
export {
  emitAppCommand,
  subscribeToAppCommands,
  type AppCommandListener,
} from './app/app-commands';
export {
  useCommandShortcuts,
  detectShortcutPlatform,
  type CommandHandlers,
} from './app/use-command-shortcuts';
export { useResponsiveSidebar } from './app/use-responsive-sidebar';
export { useDocumentTabs, type DocumentTab, type DocumentTabs } from './app/use-document-tabs';
export { printDocument, setPrintHandler, type PrintHandler } from './app/print';
export {
  checkForUpdates,
  dismissUpdate,
  installUpdate,
  isUpdateDismissed,
  isUpdateWaiting,
  openUpdatePrompt,
  reportUpdateStatus,
  setUpdateProvider,
  updateCapabilities,
  useUpdateStatus,
  useUpdateWatcher,
  type UpdateProvider,
  type UpdateState,
  type UpdateStatus,
} from './app/updates';
export { clearSnapshot, readSnapshot, writeSnapshot, type RecoverySnapshot } from './app/recovery';
export {
  useFormattingPrompts,
  type FormattingPrompts,
  type FormattingPromptKind,
} from './app/use-formatting-prompts';
export {
  EXPORT_FORMATS,
  IMPORT_ACCEPT,
  documentToHtml,
  documentToMarkdown,
  documentToText,
  downloadDocument,
  parseImportedFile,
  serialiseDocument,
  setDownloadHandler,
  type DownloadHandler,
  type DownloadRequest,
  type ExportFormat,
  type ExportFormatInfo,
  type ImportedDocument,
} from './app/export';

/* ── Mock data, until the services behind it exist ─────────────────────── */

export { WRITING_TEMPLATES, type TemplateId, type WritingTemplate } from './mock/templates';
export { buildMemoryItems, memoryStorageBytes } from './mock/memory';
export {
  CURRENCY_SYMBOL,
  PLANS,
  PLAN_FEATURES,
  formatMoney,
  planPrice,
  type BillingCycle,
  type Plan,
  type PlanFeature,
  type PlanFeatureGroup,
  type PlanId,
  type PlanPrice,
} from './mock/plans';
export { buildVersions } from './mock/versions';
export { MOCK_DEVICES, MOCK_PLAN, MOCK_SECURITY, MOCK_SESSIONS, MOCK_USER } from './mock/account';
