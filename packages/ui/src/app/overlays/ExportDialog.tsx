import type { NotoDocument } from '@noto/types';
import { useState } from 'react';

import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { showToast } from '../../components/toast-store';
import { cn } from '../../utils/cn';
import { EXPORT_FORMATS, downloadDocument, type ExportFormat } from '../export';

export interface ExportDialogProps {
  open: boolean;
  /**
   * What to write out. Only a title and its content, so the same dialog serves
   * one document and a bundle of every document in the list.
   */
  document: Pick<NotoDocument, 'title' | 'content'> | null;
  onClose(): void;
  /** Offered for PDF, which Noto produces through the print dialog. */
  onPrint?(): void;
}

/**
 * Export, as a choice of format and nothing else.
 *
 * The two formats Noto cannot write are still listed, greyed, with the reason —
 * hiding them would leave the user hunting for something that is not there, and
 * PDF in particular has a real answer sitting next to it.
 */
export function ExportDialog({ open, document, onClose, onPrint }: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>('md');

  const selected = EXPORT_FORMATS.find((candidate) => candidate.id === format);

  const run = () => {
    if (!document) return;

    if (format === 'pdf') {
      onClose();
      onPrint?.();
      return;
    }

    if (downloadDocument(document, format)) {
      showToast(`Exported as ${selected?.label ?? format}`, { tone: 'success' });
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Export document"
      description={
        document ? `“${document.title || 'Untitled'}” stays in Noto as well.` : undefined
      }
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={run}
            disabled={!document || (!selected?.supported && format !== 'pdf')}
          >
            {format === 'pdf' ? 'Open print dialog' : 'Export'}
          </Button>
        </>
      }
    >
      <fieldset className="flex flex-col gap-1.5 px-6 py-5">
        <legend className="sr-only">Format</legend>

        {EXPORT_FORMATS.map((option) => {
          const isPrintable = option.id === 'pdf' && Boolean(onPrint);
          const isChoosable = option.supported || isPrintable;

          return (
            <label
              key={option.id}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-lg border px-3.5 py-3 transition-colors',
                !isChoosable && 'cursor-not-allowed opacity-55',
                format === option.id && isChoosable
                  ? 'border-brand bg-brand-soft'
                  : 'border-default hover:bg-surface-secondary',
              )}
            >
              <input
                type="radio"
                name="noto-export-format"
                value={option.id}
                checked={format === option.id}
                disabled={!isChoosable}
                onChange={() => setFormat(option.id)}
                className="accent-brand mt-1"
              />
              <span className="min-w-0">
                <span className="text-primary text-body-sm block font-medium">{option.label}</span>
                <span className="text-tertiary text-caption block">{option.description}</span>
              </span>
            </label>
          );
        })}
      </fieldset>
    </Dialog>
  );
}
