import { useRef, useState } from 'react';

import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { ImportIcon } from '../../components/icons';
import { showToast } from '../../components/toast-store';
import { cn } from '../../utils/cn';
import { IMPORT_ACCEPT, parseImportedFile, type ImportedDocument } from '../export';

export interface ImportDialogProps {
  open: boolean;
  onClose(): void;
  /** Creates one document per file. Resolves when all of them are written. */
  onImport(documents: ImportedDocument[]): Promise<void>;
}

/**
 * Import, by picking files or dropping them.
 *
 * Everything is read in the browser — nothing is uploaded — and the formats
 * Noto cannot read yet are named rather than silently rejected, so a PDF
 * dropped here gets an explanation instead of nothing happening.
 */
export function ImportDialog({ open, onClose, onImport }: ImportDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  const accept = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const readable = Array.from(files).filter((file) =>
      /\.(txt|md|markdown|json|html?|)$/i.test(file.name),
    );
    const rejected = files.length - readable.length;

    if (readable.length === 0) {
      showToast('Noto can import text, Markdown, HTML and JSON files.', { tone: 'error' });
      return;
    }

    setBusy(true);
    try {
      const documents = await Promise.all(
        readable.map(async (file) => parseImportedFile(file.name, await file.text())),
      );

      await onImport(documents);

      showToast(
        readable.length === 1
          ? `Imported “${documents[0]!.title}”`
          : `Imported ${readable.length} documents`,
        { tone: 'success' },
      );
      if (rejected > 0) {
        showToast(`${rejected} file${rejected === 1 ? '' : 's'} skipped — unsupported format.`);
      }

      onClose();
    } catch {
      showToast('Noto could not read those files. Nothing was changed.', { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Import documents"
      description="Text, Markdown, HTML and Noto JSON. Files are read on this device."
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} onClick={() => inputRef.current?.click()}>
            Choose files
          </Button>
        </>
      }
    >
      <div className="px-6 py-5">
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void accept(event.dataTransfer.files);
          }}
          className={cn(
            'flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center transition-colors',
            dragging ? 'border-brand bg-brand-soft' : 'border-strong bg-surface-secondary',
          )}
        >
          <ImportIcon className="text-tertiary h-6 w-6" />
          <p className="text-primary text-body-sm font-medium">Drop files here</p>
          <p className="text-tertiary text-caption">
            One document is created per file, in this workspace.
          </p>
        </div>

        {/* The picker itself. Hidden, driven by the footer button, because a
            bare file input cannot be styled to match anything. */}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={IMPORT_ACCEPT}
          className="sr-only"
          aria-label="Files to import"
          onChange={(event) => {
            void accept(event.target.files);
            event.target.value = '';
          }}
        />
      </div>
    </Dialog>
  );
}
