import {
  MAX_TABLE_SIZE,
  MIN_TABLE_SIZE,
  applyLink,
  insertImage,
  insertTable,
  removeLink,
} from '@noto/editor';
import { type Editor } from '@noto/editor/react';
import { type FormEvent, useEffect, useRef, useState } from 'react';

import { Button } from '../../components/Button';
import { cn } from '../../utils/cn';
import { FIELD_CLASSES } from './controls';

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
      className="border-default bg-surface-secondary mb-3 flex flex-wrap items-center gap-2 rounded-md border p-3"
    >
      {children}
    </form>
  );
}

export function LinkPrompt({ editor, href, onClose }: PromptProps & { href: string | null }) {
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

export function ImagePrompt({ editor, onClose }: PromptProps) {
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

export function TablePrompt({ editor, onClose }: PromptProps) {
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
      <label className="text-secondary flex items-center gap-1.5 text-sm">
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
      <label className="text-secondary flex items-center gap-1.5 text-sm">
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
      <label className="text-secondary flex items-center gap-1.5 text-sm">
        <input
          checked={withHeaderRow}
          onChange={(event) => setWithHeaderRow(event.target.checked)}
          type="checkbox"
          className="accent-brand h-4 w-4"
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
