import { cn } from '../utils/cn';
import { AlertIcon, CheckIcon, CloseIcon, InfoIcon } from './icons';
import { dismissToast, useToasts, type ToastTone } from './toast-store';

const TONE: Record<ToastTone, { className: string; icon: typeof CheckIcon }> = {
  neutral: { className: 'text-secondary', icon: InfoIcon },
  success: { className: 'text-success', icon: CheckIcon },
  error: { className: 'text-danger', icon: AlertIcon },
};

/**
 * The toast stack, bottom-centre.
 *
 * Mounted once by the shell. Toasts are announced politely rather than
 * assertively: they confirm something the user just did, and interrupting a
 * screen reader mid-sentence to say "Copied" is worse than saying it late.
 */
export function ToastViewport() {
  const toasts = useToasts();

  if (toasts.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="noto-print-hidden pointer-events-none fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((toast) => {
        const tone = TONE[toast.tone];
        const Glyph = tone.icon;

        return (
          <div
            key={toast.id}
            className="border-default bg-surface pointer-events-auto flex max-w-md min-w-72 items-center gap-3 rounded-xl border px-4 py-3 shadow-[var(--noto-shadow-md)]"
          >
            <Glyph className={cn('h-4 w-4 shrink-0', tone.className)} />
            <p className="text-primary text-body-sm min-w-0 flex-1">{toast.message}</p>

            {toast.action ? (
              <button
                type="button"
                onClick={() => {
                  toast.action?.onSelect();
                  dismissToast(toast.id);
                }}
                className="text-brand-strong text-body-sm hover:text-brand focus-visible:outline-brand shrink-0 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                {toast.action.label}
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss"
              className="text-tertiary hover:text-primary focus-visible:outline-brand shrink-0 rounded-sm focus-visible:outline-2"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
