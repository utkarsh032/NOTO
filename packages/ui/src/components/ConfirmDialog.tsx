import type { ReactNode } from 'react';

import { Button } from './Button';
import { Dialog } from './Dialog';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** What will happen, and whether it can be undone. */
  description: ReactNode;
  confirmLabel: string;
  /** `true` when the action destroys something. Draws the danger button. */
  destructive?: boolean;
  onConfirm(): void;
  onClose(): void;
}

/**
 * Are you sure — asked properly.
 *
 * The description says what will happen rather than repeating the question, and
 * the confirm button names the action instead of saying "OK", so the two
 * buttons can be told apart at a glance and by a screen reader alike.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  destructive = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={destructive ? 'danger' : 'primary'}
            data-autofocus
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-secondary text-body px-6 py-5">{description}</div>
    </Dialog>
  );
}
