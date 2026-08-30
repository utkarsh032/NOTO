import { useSyncExternalStore } from 'react';

export type ToastTone = 'neutral' | 'success' | 'error';

export interface Toast {
  id: string;
  message: string;
  tone: ToastTone;
  /** Optional single action, e.g. "Undo". */
  action?: { label: string; onSelect(): void };
}

/**
 * Transient confirmations.
 *
 * A module store rather than a React context: a toast is raised from event
 * handlers, effects and command handlers alike, and threading a provider
 * through every one of them buys nothing when there is only ever one stack of
 * them on screen. It lives outside `Toast.tsx` so that file exports components
 * only and can be hot-reloaded.
 */
let toasts: Toast[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

/** How long a toast stays up before dismissing itself. */
const TOAST_DURATION_MS = 4000;

export function dismissToast(id: string): void {
  toasts = toasts.filter((toast) => toast.id !== id);
  emit();
}

export function showToast(message: string, options: Omit<Partial<Toast>, 'message'> = {}): string {
  const id = options.id ?? `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  toasts = [...toasts, { id, message, tone: options.tone ?? 'neutral', action: options.action }];
  emit();

  // Errors stay until dismissed: something went wrong is not a message to
  // take away from someone who looked up a moment too late.
  if ((options.tone ?? 'neutral') !== 'error') {
    setTimeout(() => dismissToast(id), TOAST_DURATION_MS);
  }

  return id;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function snapshot(): Toast[] {
  return toasts;
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
