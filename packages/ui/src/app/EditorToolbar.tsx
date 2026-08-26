import { CORE_COMMANDS, formatShortcut } from '@noto/core';
import {
  MAX_TABLE_SIZE,
  MIN_TABLE_SIZE,
  applyLink,
  insertImage,
  insertTable,
  removeLink,
  runFormatAction,
} from '@noto/editor';
import { type Editor, useFormatState } from '@noto/editor/react';
import { type ComponentType, type FormEvent, useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '../components/Button';
import { ToolbarButton } from '../components/ToolbarButton';
import {
  AlignCenterIcon,
  AlignJustifyIcon,
  AlignLeftIcon,
  AlignRightIcon,
  BoldIcon,
  BulletListIcon,
  ClearFormattingIcon,
  CodeBlockIcon,
  CodeIcon,
  DividerIcon,
  type IconProps,
  ImageIcon,
  ItalicIcon,
  LinkIcon,
  OrderedListIcon,
  QuoteIcon,
  StrikethroughIcon,
  TableIcon,
  UnderlineIcon,
} from '../components/icons';
import { cn } from '../utils/cn';
import { detectShortcutPlatform } from './use-command-shortcuts';
import type { FormattingPrompts } from './use-formatting-prompts';

/**
 * The formatting controls for the document editor.
 *
 * Every button is a command id: the label and the shortcut hint come from the
 * registry in `@noto/core`, and the action from `@noto/editor`. Nothing about
 * what bold *is* lives here — this file decides only what the controls look
 * like and which order they come in.
 */

const COMMANDS_BY_ID = new Map(CORE_COMMANDS.map((command) => [command.id, command]));

interface Control {
  id: string;
  icon: ComponentType<IconProps>;
}

const MARK_CONTROLS: Control[] = [
  { id: 'format.bold', icon: BoldIcon },
  { id: 'format.italic', icon: ItalicIcon },
  { id: 'format.underline', icon: UnderlineIcon },
  { id: 'format.strike', icon: StrikethroughIcon },
  { id: 'format.code', icon: CodeIcon },
];

const BLOCK_CONTROLS: Control[] = [
  { id: 'format.bulletList', icon: BulletListIcon },
  { id: 'format.orderedList', icon: OrderedListIcon },
  { id: 'format.blockquote', icon: QuoteIcon },
  { id: 'format.codeBlock', icon: CodeBlockIcon },
];

const ALIGN_CONTROLS: Control[] = [
  { id: 'format.alignLeft', icon: AlignLeftIcon },
  { id: 'format.alignCenter', icon: AlignCenterIcon },
  { id: 'format.alignRight', icon: AlignRightIcon },
  { id: 'format.alignJustify', icon: AlignJustifyIcon },
];

/** The block types the picker offers, in the order it lists them. */
const BLOCK_TYPES = [
  { id: 'format.paragraph', label: 'Paragraph' },
  { id: 'format.heading1', label: 'Heading 1' },
  { id: 'format.heading2', label: 'Heading 2' },
  { id: 'format.heading3', label: 'Heading 3' },
];

const TABLE_CONTROLS = [
  { id: 'table.addRowAfter', label: 'Row +' },
  { id: 'table.addColumnAfter', label: 'Column +' },
  { id: 'table.deleteRow', label: 'Delete row' },
  { id: 'table.deleteColumn', label: 'Delete column' },
  { id: 'table.toggleHeaderRow', label: 'Header row' },
];

const FIELD_CLASSES =
  'bg-surface-raised border-border-subtle text-content placeholder:text-subtle focus-visible:outline-accent h-8 rounded-md border px-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-1';

export interface EditorToolbarProps {
  editor: Editor | null;
  prompts: FormattingPrompts;
  className?: string;
}

export function EditorToolbar({ editor, prompts, className }: EditorToolbarProps) {
  const format = useFormatState(editor);
  const platform = useMemo(() => detectShortcutPlatform(), []);

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
      onClick={() => runFormatAction(editor, id)}
    >
      <Glyph />
    </ToolbarButton>
  );

  const activeBlockType = BLOCK_TYPES.find((type) => format.active[type.id])?.id ?? '';

  return (
    <div className={className}>
      <div
        className="flex flex-wrap items-center gap-0.5"
        role="toolbar"
        aria-label="Formatting"
        aria-controls="noto-document-body"
      >
        <select
          value={activeBlockType}
          onChange={(event) => runFormatAction(editor, event.target.value)}
          disabled={!editor}
          aria-label="Block type"
          className={cn(FIELD_CLASSES, 'w-28')}
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
        </select>

        <Separator />
        {MARK_CONTROLS.map(renderControl)}

        <ToolbarButton
          label={title('format.link')}
          shortcutHint={hint('format.link')}
          isActive={format.active['format.link'] ?? false}
          disabled={!editor}
          onClick={() => prompts.togglePrompt('link')}
        >
          <LinkIcon />
        </ToolbarButton>

        <Separator />
        {BLOCK_CONTROLS.map(renderControl)}

        <Separator />
        {ALIGN_CONTROLS.map(renderControl)}

        <Separator />
        <ToolbarButton
          label={title('insert.image')}
          disabled={!editor}
          onClick={() => prompts.togglePrompt('image')}
        >
          <ImageIcon />
        </ToolbarButton>
        <ToolbarButton
          label={title('insert.table')}
          disabled={!editor}
          onClick={() => prompts.togglePrompt('table')}
        >
          <TableIcon />
        </ToolbarButton>
        {renderControl({ id: 'insert.horizontalRule', icon: DividerIcon })}

        <Separator />
        {renderControl({ id: 'format.clear', icon: ClearFormattingIcon })}
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

      {format.isInTable ? (
        <div className="mt-2 flex flex-wrap items-center gap-1" aria-label="Table">
          {TABLE_CONTROLS.map((control) => (
            <Button
              key={control.id}
              size="sm"
              variant="ghost"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => runFormatAction(editor, control.id)}
            >
              {control.label}
            </Button>
          ))}
          <Button
            size="sm"
            variant="ghost"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => runFormatAction(editor, 'table.delete')}
            className="text-danger hover:text-danger"
          >
            Delete table
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function Separator() {
  return <span className="bg-border-subtle mx-0.5 h-5 w-px shrink-0" aria-hidden="true" />;
}

/* -------------------------------------------------------------------------- */
/* Prompts                                                                    */
/* -------------------------------------------------------------------------- */

interface PromptProps {
  editor: Editor | null;
  onClose: () => void;
}

function PromptForm({
  label,
  onSubmit,
  onClose,
  children,
}: {
  label: string;
  onSubmit: (event: FormEvent) => void;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <form
      onSubmit={onSubmit}
      // Escape closes the prompt wherever the caret is inside it, so a
      // half-typed URL never traps the user in the form.
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        onClose();
      }}
      aria-label={label}
      className="border-border-subtle bg-surface-raised mt-2 flex flex-wrap items-center gap-2 rounded-md border p-2"
    >
      {children}
    </form>
  );
}

function LinkPrompt({ editor, href, onClose }: PromptProps & { href: string | null }) {
  const [value, setValue] = useState(href ?? '');
  const [rejected, setRejected] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.select(), []);

  const submit = (event: FormEvent) => {
    event.preventDefault();

    if (applyLink(editor, value)) {
      onClose();
      return;
    }

    // `applyLink` refuses anything that is not a safe, resolvable URL. Saying
    // so beats silently doing nothing.
    setRejected(true);
  };

  return (
    <PromptForm label="Link" onSubmit={submit} onClose={onClose}>
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setRejected(false);
        }}
        type="text"
        inputMode="url"
        placeholder="noto.app/docs"
        aria-label="Link address"
        aria-invalid={rejected}
        className={cn(FIELD_CLASSES, 'min-w-0 flex-1')}
      />
      <Button size="sm" variant="primary" type="submit">
        Apply
      </Button>
      {href ? (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            removeLink(editor);
            onClose();
          }}
        >
          Remove
        </Button>
      ) : null}
      <Button size="sm" variant="ghost" onClick={onClose}>
        Cancel
      </Button>
      {rejected ? (
        <p className="text-danger w-full text-xs">
          That is not a web, mail or telephone address Noto can link to.
        </p>
      ) : null}
    </PromptForm>
  );
}

function ImagePrompt({ editor, onClose }: PromptProps) {
  const [src, setSrc] = useState('');
  const [alt, setAlt] = useState('');
  const [rejected, setRejected] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  const submit = (event: FormEvent) => {
    event.preventDefault();

    if (insertImage(editor, { src, alt })) {
      onClose();
      return;
    }

    setRejected(true);
  };

  return (
    <PromptForm label="Insert image" onSubmit={submit} onClose={onClose}>
      <input
        ref={inputRef}
        value={src}
        onChange={(event) => {
          setSrc(event.target.value);
          setRejected(false);
        }}
        type="text"
        inputMode="url"
        placeholder="Image address"
        aria-label="Image address"
        aria-invalid={rejected}
        className={cn(FIELD_CLASSES, 'min-w-0 flex-1')}
      />
      <input
        value={alt}
        onChange={(event) => setAlt(event.target.value)}
        type="text"
        placeholder="Description (optional)"
        aria-label="Image description"
        className={cn(FIELD_CLASSES, 'min-w-0 flex-1')}
      />
      <Button size="sm" variant="primary" type="submit">
        Insert
      </Button>
      <Button size="sm" variant="ghost" onClick={onClose}>
        Cancel
      </Button>
      {rejected ? (
        <p className="text-danger w-full text-xs">Noto could not read that as an image address.</p>
      ) : null}
    </PromptForm>
  );
}

function TablePrompt({ editor, onClose }: PromptProps) {
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const [withHeaderRow, setWithHeaderRow] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.select(), []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    insertTable(editor, { rows, cols, withHeaderRow });
    onClose();
  };

  return (
    <PromptForm label="Insert table" onSubmit={submit} onClose={onClose}>
      <label className="text-muted flex items-center gap-1.5 text-sm">
        Rows
        <input
          ref={inputRef}
          value={rows}
          onChange={(event) => setRows(Number(event.target.value))}
          type="number"
          min={MIN_TABLE_SIZE}
          max={MAX_TABLE_SIZE}
          className={cn(FIELD_CLASSES, 'w-16')}
        />
      </label>
      <label className="text-muted flex items-center gap-1.5 text-sm">
        Columns
        <input
          value={cols}
          onChange={(event) => setCols(Number(event.target.value))}
          type="number"
          min={MIN_TABLE_SIZE}
          max={MAX_TABLE_SIZE}
          className={cn(FIELD_CLASSES, 'w-16')}
        />
      </label>
      <label className="text-muted flex items-center gap-1.5 text-sm">
        <input
          checked={withHeaderRow}
          onChange={(event) => setWithHeaderRow(event.target.checked)}
          type="checkbox"
          className="accent-accent h-4 w-4"
        />
        Header row
      </label>
      <Button size="sm" variant="primary" type="submit">
        Insert
      </Button>
      <Button size="sm" variant="ghost" onClick={onClose}>
        Cancel
      </Button>
    </PromptForm>
  );
}
