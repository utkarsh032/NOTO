import { useState } from 'react';

import { Button } from './Button';
import { Dialog } from './Dialog';
import { Input } from './Input';

export interface PromptDialogProps {
  open: boolean;
  title: string;
  description?: string;
  label: string;
  initialValue?: string;
  confirmLabel?: string;
  onConfirm(value: string): void;
  onClose(): void;
}

/**
 * One question, one field, two buttons.
 *
 * Renaming, mostly. The field opens selected so the common case — replacing the
 * name outright — is one keystroke, and Enter submits, because a dialog with a
 * single field that needs the mouse to confirm is a dialog that wastes a hand.
 *
 * Closed, it renders nothing at all. That is what makes the field's starting
 * value simply its initial state: reopening the dialog for a different document
 * mounts a fresh one, rather than needing an effect to notice and overwrite
 * what the last one was left holding.
 */
export function PromptDialog({ open, ...props }: PromptDialogProps) {
  if (!open) return null;
  return <PromptDialogForm {...props} />;
}

function PromptDialogForm({
  title,
  description,
  label,
  initialValue = '',
  confirmLabel = 'Save',
  onConfirm,
  onClose,
}: Omit<PromptDialogProps, 'open'>) {
  const [value, setValue] = useState(initialValue);

  const submit = () => {
    const next = value.trim();
    if (next === '') return;

    onConfirm(next);
    onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={value.trim() === ''}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="px-6 py-5">
        <Input
          label={label}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            submit();
          }}
          onFocus={(event) => event.currentTarget.select()}
        />
      </div>
    </Dialog>
  );
}
