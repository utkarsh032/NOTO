import { CORE_COMMANDS, type CommandContext, type ShortcutPlatform } from '@noto/core';
import { findCommandForEvent } from '@noto/core';
import { useEffect, useRef } from 'react';

/** Handlers keyed by command id. A command with no handler stays unbound. */
export type CommandHandlers = Record<string, (() => void) | undefined>;

/**
 * The modifier convention this device follows.
 *
 * Read from the browser rather than passed in, because the same shared shell
 * runs inside Electron on macOS and in a browser on Windows.
 */
export function detectShortcutPlatform(): ShortcutPlatform {
  if (typeof navigator === 'undefined') return 'other';

  const platform = navigator.platform || '';
  const agent = navigator.userAgent || '';
  return /mac|iphone|ipad|ipod/i.test(`${platform} ${agent}`) ? 'mac' : 'other';
}

/**
 * Binds command accelerators to handlers for as long as the component is mounted.
 *
 * The listener resolves keys through the command registry rather than matching
 * them inline, so a shortcut can only ever do what the command says it does —
 * and a command that is disabled in the current context does not fire at all.
 *
 * Several components may call this at once; each binds only the command ids it
 * passes handlers for, and the editor binds save because it is what holds the
 * unsaved draft.
 */
export function useCommandShortcuts(handlers: CommandHandlers, context: CommandContext): void {
  // Held in refs so that handlers rebuilt on every render — the normal case —
  // do not detach and reattach the listener.
  const handlersRef = useRef(handlers);
  const contextRef = useRef(context);

  useEffect(() => {
    handlersRef.current = handlers;
    contextRef.current = context;
  });

  useEffect(() => {
    const platform = detectShortcutPlatform();

    const onKeyDown = (event: KeyboardEvent) => {
      // A key still being composed into a character (IME) is not a shortcut.
      if (event.isComposing) return;

      const command = findCommandForEvent(CORE_COMMANDS, event, contextRef.current, platform);
      if (!command) return;

      const handler = handlersRef.current[command.id];
      if (!handler) return;

      // Only claimed once a handler is known, so an unbound accelerator keeps
      // whatever the browser or the editor would normally do with it.
      event.preventDefault();
      handler();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
