import { contentFromPlainText } from '@noto/core';
import {
  DockHandle,
  DockPanel,
  NotoDataContext,
  quickNoteTitle,
  useNotoDataSource,
  type DockSide,
} from '@noto/ui';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { openDesktopDatabase } from './platform/database';

/**
 * The Quick Note dock, as the desktop draws it.
 *
 * The same handle and the same panel the application renders inside its own
 * window — but here they are the entire contents of a small, frameless,
 * always-on-top window of their own, which is what lets the dock still be there
 * after Noto has been minimised or closed.
 *
 * It is the same bundle as the application, loaded at `#/dock`. A second Vite
 * entry would have meant a second build, a second HTML file and a second copy
 * of the design system in the installer, all to render two components that
 * already exist.
 *
 * The window's placement — which edge, how far down, which display — belongs to
 * the main process, because none of it is knowable from in here. This side
 * reports gestures and draws what it is told.
 */
export function DockApp() {
  const open = useCallback(() => openDesktopDatabase(), []);
  const data = useNotoDataSource({ open });

  const [side, setSide] = useState<DockSide>('right');
  const [expanded, setExpanded] = useState(false);

  const openPanel = useCallback(() => void window.notoDock.setExpanded(true), []);

  /*
   * The dock window is transparent, so the page behind the handle must be too —
   * otherwise the rounded tab sits on a rectangle of application background.
   */
  useEffect(() => {
    document.body.classList.add('noto-dock-window');
    return () => document.body.classList.remove('noto-dock-window');
  }, []);

  /* The main process is the authority on both; it says so as soon as we load. */
  useEffect(
    () =>
      window.notoDock.onPlacement((placement) => {
        setSide(placement.side);
        setExpanded(placement.expanded);
      }),
    [],
  );

  /**
   * A press on the handle or the panel's header.
   *
   * `onTap` runs if the press turns out not to have been a drag — which is a
   * question the main process answers, since it is the only side that saw the
   * cursor. Duration used to stand in for that here, and it was a poor stand-in:
   * a deliberate quarter-second press on the tab was read as a drag and opened
   * nothing at all.
   */
  const startDrag = (event: ReactPointerEvent<HTMLElement>, onTap?: () => void) => {
    if (event.button !== 0) return;

    const target = event.currentTarget;

    target.setPointerCapture(event.pointerId);
    void window.notoDock.dragStart();

    const finish = (release: PointerEvent) => {
      target.releasePointerCapture(event.pointerId);
      target.removeEventListener('pointerup', finish);
      target.removeEventListener('pointercancel', finish);

      /* A cancelled press — the system taking the pointer away — is not a tap. */
      const lifted = release.type === 'pointerup';

      void window.notoDock.dragEnd().then((moved) => {
        if (lifted && !moved) onTap?.();
      });
    };

    /*
     * Pointer capture is what makes this work at all: the window moves out from
     * under the pointer, and without capture the release would be delivered to
     * whatever ended up underneath it instead.
     */
    target.addEventListener('pointerup', finish);
    target.addEventListener('pointercancel', finish);
  };

  const recent = useMemo(
    () =>
      [...(data.documents ?? [])]
        .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
        .slice(0, 4)
        .map((document) => ({
          id: document.id,
          title: document.title,
          updatedAt: document.updatedAt,
        })),
    [data.documents],
  );

  const save = async (text: string) => {
    const id = await data.createDocument();
    if (!id) return;

    await data.updateDocument(id, {
      title: quickNoteTitle(text),
      content: contentFromPlainText(text),
    });
  };

  return (
    <NotoDataContext.Provider value={data}>
      {/*
       * The window is exactly the size of whichever of these is showing, so the
       * root fills it and nothing needs positioning.
       */}
      <div className="flex h-full w-full items-stretch">
        {expanded ? (
          <DockPanel
            side={side}
            onClose={() => void window.notoDock.setExpanded(false)}
            onFlipSide={() => void window.notoDock.setSide(side === 'right' ? 'left' : 'right')}
            onSave={save}
            onOpenNoto={() => void window.notoDock.openApp('navigation.quickNotes')}
            onQuickPaste={() => void window.notoDock.openApp('app.quickPaste')}
            onSearch={() => void window.notoDock.openApp('navigation.commandPalette')}
            onAskAI={() => void window.notoDock.openApp('app.aiAssistant')}
            recent={recent}
            onOpenRecent={(id) => void window.notoDock.openApp('navigation.openDocument', id)}
            onDragStart={startDrag}
            className="h-full"
          />
        ) : (
          <DockHandle
            side={side}
            onDragStart={(event) => startDrag(event, openPanel)}
            /* The pointer opens on release, above; a key press has no release
               to wait for and arrives here as a click with no detail. */
            onOpen={(event) => {
              if (event.detail !== 0) return;
              openPanel();
            }}
            className="h-full w-full"
          />
        )}
      </div>
    </NotoDataContext.Provider>
  );
}
