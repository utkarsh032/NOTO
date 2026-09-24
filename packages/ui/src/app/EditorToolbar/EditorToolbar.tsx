import { formatShortcut, useSettingsStore } from '@noto/core';
import { runEditorAction } from '@noto/editor';
import { type Editor, useFormatState } from '@noto/editor/react';
import { useMemo } from 'react';

import { Button } from '../../components/Button';
import { Dropdown, type DropdownItem } from '../../components/Dropdown';
import { Select } from '../../components/Input';
import { ToolbarButton } from '../../components/ToolbarButton';
import {
  CheckIcon,
  ChevronDownIcon,
  ClearFormattingIcon,
  CodeBlockIcon,
  CodeIcon,
  DividerIcon,
  ImageIcon,
  LinkIcon,
  MaximizeIcon,
  MinimizeIcon,
  MoreIcon,
  PilcrowIcon,
  PrinterIcon,
  QuoteIcon,
  RedoIcon,
  SearchIcon,
  TableIcon,
  UndoIcon,
  WrapTextIcon,
} from '../../components/icons';
import { PageLayoutMenu, PageMarginsPrompt } from '../editor/PageLayoutMenu';
import { detectShortcutPlatform } from '../use-command-shortcuts';
import type { FormattingPrompts } from '../use-formatting-prompts';
import { Separator } from './Separator';
import {
  ALIGN_CONTROLS,
  BLOCK_TYPES,
  COMMANDS_BY_ID,
  type Control,
  LIST_CONTROLS,
  MARK_CONTROLS,
  OVERFLOW_ALIGN_CONTROLS,
  TABLE_CONTROLS,
} from './controls';
import { ImagePrompt, LinkPrompt, TablePrompt } from './prompts';
import { useFullscreen } from './use-fullscreen';

export interface EditorToolbarProps {
  editor: Editor | null;
  prompts: FormattingPrompts;
  /** Opens the find bar, which the editor pane owns. */
  onFind?(): void;
  /** Sends the document to the printer. */
  onPrint?(): void;
  className?: string;
}

export function EditorToolbar({ editor, prompts, onFind, onPrint, className }: EditorToolbarProps) {
  const format = useFormatState(editor);
  const platform = useMemo(() => detectShortcutPlatform(), []);

  /*
   * Zoom and wrap are settings rather than document state: they change how this
   * reader sees every document, and survive a restart. The toolbar is simply
   * the nearest place to reach them.
   */
  const { showInvisibles, wordWrap } = useSettingsStore((state) => state.settings.editor);
  const updateEditor = useSettingsStore((state) => state.updateEditor);

  const hint = (commandId: string): string | undefined => {
    const shortcut = COMMANDS_BY_ID.get(commandId)?.shortcut;
    return shortcut ? formatShortcut(shortcut, platform) : undefined;
  };

  const title = (commandId: string): string => COMMANDS_BY_ID.get(commandId)?.title ?? commandId;

  const renderControl = ({ id, icon: Glyph }: Control) => (
    <ToolbarButton
      key={id}
      label={title(id)}
      shortcutHint={hint(id)}
      isActive={format.active[id] ?? false}
      disabled={!editor}
      onClick={() => runEditorAction(editor, id)}
    >
      <Glyph />
    </ToolbarButton>
  );

  const activeBlockType = BLOCK_TYPES.find((type) => format.active[type.id])?.id ?? '';

  const [fullscreen, toggleFullscreen] = useFullscreen();

  /*
   * The overflow menu. Rare, not lesser: everything here is a command with a
   * shortcut of its own, and the menu exists so the bar can stay eight groups
   * wide rather than fourteen.
   */
  const overflowItems: DropdownItem[] = [
    ...OVERFLOW_ALIGN_CONTROLS.map((control) => ({
      id: control.id,
      label: title(control.id),
      icon: <control.icon className="h-4 w-4" />,
      trailing: format.active[control.id] ? <CheckIcon className="h-4 w-4" /> : undefined,
      disabled: !editor,
      onSelect: () => runEditorAction(editor, control.id),
    })),
    {
      id: 'format.codeBlock',
      label: title('format.codeBlock'),
      icon: <CodeBlockIcon className="h-4 w-4" />,
      trailing: format.active['format.codeBlock'] ? <CheckIcon className="h-4 w-4" /> : undefined,
      disabled: !editor,
      separated: true,
      onSelect: () => runEditorAction(editor, 'format.codeBlock'),
    },
    {
      id: 'insert.horizontalRule',
      label: title('insert.horizontalRule'),
      icon: <DividerIcon className="h-4 w-4" />,
      disabled: !editor,
      onSelect: () => runEditorAction(editor, 'insert.horizontalRule'),
    },
    {
      id: 'edit.find',
      label: title('edit.find'),
      icon: <SearchIcon className="h-4 w-4" />,
      trailing: hint('edit.find'),
      disabled: !editor || !onFind,
      separated: true,
      onSelect: () => onFind?.(),
    },
    {
      id: 'document.print',
      label: title('document.print'),
      icon: <PrinterIcon className="h-4 w-4" />,
      trailing: hint('document.print'),
      disabled: !onPrint,
      onSelect: () => onPrint?.(),
    },
    {
      id: 'view.toggleInvisibles',
      label: title('view.toggleInvisibles'),
      icon: <PilcrowIcon className="h-4 w-4" />,
      trailing: showInvisibles ? <CheckIcon className="h-4 w-4" /> : undefined,
      separated: true,
      keepsFocus: true,
      onSelect: () => {
        updateEditor({ showInvisibles: !showInvisibles });
        editor?.commands.focus();
      },
    },
    {
      id: 'view.toggleWordWrap',
      label: title('view.toggleWordWrap'),
      icon: <WrapTextIcon className="h-4 w-4" />,
      trailing: wordWrap ? <CheckIcon className="h-4 w-4" /> : undefined,
      keepsFocus: true,
      onSelect: () => {
        updateEditor({ wordWrap: !wordWrap });
        editor?.commands.focus();
      },
    },
  ];

  return (
    <div className={className}>
      <div
        className="min-h-toolbar noto-scroll-x flex items-center gap-0.5 overflow-x-auto py-1.5"
        role="toolbar"
        aria-label="Formatting"
        aria-controls="noto-document-body"
      >
        <Select
          value={activeBlockType}
          onChange={(event) => runEditorAction(editor, event.target.value)}
          disabled={!editor}
          aria-label="Block type"
          fieldSize="sm"
          className="w-32"
        >
          {/* Code blocks and table cells are none of the four; the picker says
              so rather than claiming the block is a paragraph. */}
          {activeBlockType === '' ? (
            <option value="" disabled>
              —
            </option>
          ) : null}
          {BLOCK_TYPES.map((type) => (
            <option key={type.id} value={type.id}>
              {type.label}
            </option>
          ))}
        </Select>

        <Separator />
        {MARK_CONTROLS.map(renderControl)}

        <Separator />
        {renderControl({ id: 'format.code', icon: CodeIcon })}
        <ToolbarButton
          label={title('format.link')}
          shortcutHint={hint('format.link')}
          isActive={format.active['format.link'] ?? false}
          disabled={!editor}
          onClick={() => prompts.togglePrompt('link')}
        >
          <LinkIcon />
        </ToolbarButton>
        <ToolbarButton
          label={title('insert.image')}
          disabled={!editor}
          onClick={() => prompts.togglePrompt('image')}
        >
          <ImageIcon />
        </ToolbarButton>

        <Separator />
        {LIST_CONTROLS.map(renderControl)}
        {/*
         * The chevron beside the three list buttons changes which kind of list
         * the caret is in, rather than offering a fourth thing to insert: it is
         * the same three commands, reached the way a picker is reached.
         */}
        <Dropdown
          align="left"
          label="List type"
          items={LIST_CONTROLS.map((control) => ({
            id: control.id,
            label: title(control.id),
            icon: <control.icon className="h-4 w-4" />,
            trailing: format.active[control.id] ? <CheckIcon className="h-4 w-4" /> : undefined,
            disabled: !editor,
            onSelect: () => runEditorAction(editor, control.id),
          }))}
          trigger={(triggerProps) => (
            <button
              {...triggerProps}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              disabled={!editor}
              aria-label="List type"
              title="List type"
              className="text-secondary hover:bg-surface-secondary hover:text-primary focus-visible:outline-brand inline-flex h-8 w-5 shrink-0 items-center justify-center rounded-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 disabled:pointer-events-none disabled:opacity-40"
            >
              <ChevronDownIcon className="h-3.5 w-3.5" />
            </button>
          )}
        />

        <Separator />
        {renderControl({ id: 'format.clear', icon: ClearFormattingIcon })}

        <Separator />
        {ALIGN_CONTROLS.map(renderControl)}

        <Separator />
        {renderControl({ id: 'format.blockquote', icon: QuoteIcon })}

        <Separator />
        <ToolbarButton
          label={title('insert.table')}
          disabled={!editor}
          onClick={() => prompts.togglePrompt('table')}
        >
          <TableIcon />
        </ToolbarButton>

        {/*
         * Page size and margins. Beside the table rather than in the overflow
         * menu: both are about the shape of the document rather than the text
         * in it, and this is the control someone goes looking for the moment
         * they decide the thing they are writing is going to be printed.
         */}
        <PageLayoutMenu onCustomMargins={() => prompts.openPrompt('margins')} />

        {/*
         * Everything that is real but rarely reached for. It is a menu rather
         * than eight more glyphs: a bar the eye has to scan is a bar that costs
         * more than the controls on it are worth.
         */}
        <Dropdown
          align="left"
          label="More formatting"
          items={overflowItems}
          trigger={(triggerProps) => (
            <button
              {...triggerProps}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              aria-label="More formatting"
              title="More formatting"
              className="text-secondary hover:bg-surface-secondary hover:text-primary focus-visible:outline-brand ml-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-1"
            >
              <MoreIcon className="h-4 w-4" />
            </button>
          )}
        />

        {/*
         * History and the window sit at the far end, pushed there rather than
         * ordered there: undo acts on what you just did rather than on the
         * selection, and full screen acts on the window, not the document.
         */}
        <span className="flex-1" aria-hidden="true" />

        <ToolbarButton
          label={title('edit.undo')}
          shortcutHint={hint('edit.undo')}
          disabled={!editor || !format.canUndo}
          onClick={() => runEditorAction(editor, 'edit.undo')}
        >
          <UndoIcon />
        </ToolbarButton>
        <ToolbarButton
          label={title('edit.redo')}
          shortcutHint={hint('edit.redo')}
          disabled={!editor || !format.canRedo}
          onClick={() => runEditorAction(editor, 'edit.redo')}
        >
          <RedoIcon />
        </ToolbarButton>

        <Separator />
        <ToolbarButton
          label={fullscreen ? 'Exit full screen' : 'Full screen'}
          isActive={fullscreen}
          onClick={toggleFullscreen}
        >
          {fullscreen ? <MinimizeIcon /> : <MaximizeIcon />}
        </ToolbarButton>
      </div>

      {/*
       * Prompts open below the bar rather than in a modal, the way the sidebar
       * asks before deleting: the document stays visible, so the user can see
       * the selection the link is about to be applied to.
       */}
      {prompts.open === 'link' ? (
        <LinkPrompt editor={editor} href={format.linkHref} onClose={prompts.closePrompt} />
      ) : null}
      {prompts.open === 'image' ? (
        <ImagePrompt editor={editor} onClose={prompts.closePrompt} />
      ) : null}
      {prompts.open === 'table' ? (
        <TablePrompt editor={editor} onClose={prompts.closePrompt} />
      ) : null}
      {prompts.open === 'margins' ? <PageMarginsPrompt onClose={prompts.closePrompt} /> : null}

      {format.isInTable ? (
        <div
          className="border-default bg-surface-secondary mb-3 flex flex-wrap items-center gap-1 rounded-md border p-1.5"
          aria-label="Table"
        >
          {TABLE_CONTROLS.map((control) => (
            <Button
              key={control.id}
              size="sm"
              variant="ghost"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => runEditorAction(editor, control.id)}
            >
              {control.label}
            </Button>
          ))}
          <Button
            size="sm"
            variant="ghost"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => runEditorAction(editor, 'table.delete')}
            className="text-danger hover:text-danger"
          >
            Delete table
          </Button>
        </div>
      ) : null}
    </div>
  );
}
