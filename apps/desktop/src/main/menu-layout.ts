/**
 * What the application menu contains, in order.
 *
 * Only ids: the titles and the keys come from the shared command registry, the
 * same one the command palette lists and the renderer binds keys from, so the
 * menu cannot say one thing while the key does another.
 *
 * `'-'` is a separator. A `role` is one of Electron's own items, used where the
 * operating system already does the job better than a command could — the
 * clipboard, above all, which on macOS does not work at all without them.
 */
export type MenuEntry = string | '-' | { role: MenuRole };

export type MenuRole =
  | 'cut'
  | 'copy'
  | 'paste'
  | 'pasteAndMatchStyle'
  | 'selectAll'
  | 'togglefullscreen'
  | 'minimize'
  | 'toggleDevTools';

export interface MenuSection {
  label: string;
  entries: MenuEntry[];
}

export const MENU_LAYOUT: readonly MenuSection[] = [
  {
    label: '&File',
    entries: [
      'document.new',
      'folder.new',
      '-',
      'document.open',
      '-',
      'document.save',
      'document.saveAs',
      'document.saveAll',
      '-',
      'document.print',
      '-',
      'document.rename',
      'document.toggleFavorite',
      'document.archive',
      'document.delete',
      '-',
      'document.close',
      'document.closeAll',
      'tab.reopenClosed',
    ],
  },
  {
    label: '&Edit',
    entries: [
      'edit.undo',
      'edit.redo',
      '-',
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'pasteAndMatchStyle' },
      { role: 'selectAll' },
      '-',
      'edit.find',
      'edit.replace',
      'edit.findNext',
      'edit.findPrevious',
    ],
  },
  {
    label: 'F&ormat',
    entries: [
      'format.bold',
      'format.italic',
      'format.underline',
      'format.strike',
      'format.code',
      'format.link',
      '-',
      'format.paragraph',
      'format.heading1',
      'format.heading2',
      'format.heading3',
      '-',
      'format.bulletList',
      'format.orderedList',
      'format.taskList',
      'format.blockquote',
      'format.codeBlock',
      '-',
      'format.alignLeft',
      'format.alignCenter',
      'format.alignRight',
      'format.alignJustify',
      '-',
      'format.clear',
    ],
  },
  {
    label: '&Insert',
    entries: ['insert.image', 'insert.table', 'insert.horizontalRule'],
  },
  {
    label: '&View',
    entries: [
      'navigation.commandPalette',
      'view.toggleSidebar',
      '-',
      'view.zoomIn',
      'view.zoomOut',
      'view.zoomReset',
      '-',
      'view.toggleWordWrap',
      'view.toggleInvisibles',
      'view.toggleTheme',
      '-',
      { role: 'togglefullscreen' },
    ],
  },
  {
    label: '&Go',
    entries: [
      'navigation.home',
      'navigation.workspace',
      'navigation.documents',
      'navigation.quickNotes',
      'navigation.memory',
      'navigation.search',
      '-',
      'tab.moveLeft',
      'tab.moveRight',
      'tab.togglePin',
      'tab.duplicate',
      '-',
      'navigation.account',
      'navigation.plans',
    ],
  },
  {
    label: '&Tools',
    entries: [
      'app.quickNote',
      'app.quickPaste',
      'app.floatingNoto',
      'app.smartSidebar',
      'app.toggleDock',
      '-',
      'app.aiAssistant',
    ],
  },
  {
    label: '&Window',
    /*
     * No Close: Cmd+W is Close Document, and a second item claiming the same
     * key would close the window out from under the tab it meant to close.
     */
    entries: [{ role: 'minimize' }],
  },
  {
    label: '&Help',
    entries: ['app.shortcuts', '-', 'app.checkForUpdates'],
  },
];

/**
 * Settings, which on macOS belongs under the application's name rather than in
 * File. Kept out of the layout so `menu.ts` can put it in the right one.
 */
export const SETTINGS_COMMAND = 'app.settings';

/** Every command id the layout names, in order. */
export function commandIdsIn(layout: readonly MenuSection[]): string[] {
  return layout.flatMap((section) =>
    section.entries.filter((entry): entry is string => typeof entry === 'string' && entry !== '-'),
  );
}
