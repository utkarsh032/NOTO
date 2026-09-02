import { useEffect, useRef } from 'react';

/**
 * The Cloudflare Turnstile widget.
 *
 * Rendered explicitly rather than by Cloudflare's automatic scan of the DOM,
 * because the token is single-use: this screen stays mounted after a failed
 * submission, so the widget has to be reset before a second attempt, and that
 * needs the id `render` returns.
 *
 * The script is injected on mount rather than sitting in `index.html`, so the
 * one screen that shows this form is the only screen that ever fetches it.
 */

interface TurnstileApi {
  render(element: HTMLElement, options: Record<string, unknown>): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();

  const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Turnstile failed to load.')));
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', () => resolve());
    script.addEventListener('error', () => reject(new Error('Turnstile failed to load.')));
    document.head.append(script);
  });
}

export interface TurnstileHandle {
  /** Clears a spent token so the form can be submitted again. */
  reset(): void;
}

export function TurnstileWidget({
  siteKey,
  action,
  onToken,
  handleRef,
}: {
  siteKey: string;
  action: string;
  onToken: (token: string | null) => void;
  handleRef?: { current: TurnstileHandle | null };
}) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let widgetId: string | null = null;
    let cancelled = false;

    void loadScript()
      .then(() => {
        if (cancelled || !container.current || !window.turnstile) return;

        widgetId = window.turnstile.render(container.current, {
          sitekey: siteKey,
          action,
          callback: (token: string) => onToken(token),
          // A spent or rejected token must not look like a valid one.
          'expired-callback': () => onToken(null),
          'error-callback': () => onToken(null),
        });

        if (handleRef) {
          handleRef.current = {
            reset: () => {
              if (widgetId) window.turnstile?.reset(widgetId);
              onToken(null);
            },
          };
        }
      })
      .catch(() => {
        // The server fails closed on a missing token, so there is nothing to
        // do here but leave the form unable to submit.
        onToken(null);
      });

    return () => {
      cancelled = true;
      if (widgetId) window.turnstile?.remove(widgetId);
      if (handleRef) handleRef.current = null;
    };
  }, [siteKey, action, onToken, handleRef]);

  return <div ref={container} className="min-h-[65px]" />;
}
