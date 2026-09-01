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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { openDesktopDatabase } from './platform/database';

/**
 * Anything held down for longer than this was a drag, not a click.
 *
 * Distance would be the better test and is what the in-application dock uses,
 * but it is not available here: the window is placed under the cursor while it
 * is dragged, so the pointer stops moving relative to the page and the renderer
 * is sent no pointer moves to measure. Duration is what is left, and it
 * separates the two gestures well enough — nobody drags a window in 200ms, and
 * nobody holds a click for that long either.
 */
const CLICK_LIMIT_MS = 220;

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

  /** Set when a press was long enough to have been a drag, so its click is dropped. */
  const draggedRef = useRef(false);

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

  const startDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;

    const target = event.currentTarget;
    const pressedAt = Date.now();

    target.setPointerCapture(event.pointerId);
    void window.notoDock.dragStart();

    const finish = () => {
      target.releasePointerCapture(event.pointerId);
      target.removeEventListener('pointerup', finish);
      target.removeEventListener('pointercancel', finish);

      draggedRef.current = Date.now() - pressedAt > CLICK_LIMIT_MS;
      void window.notoDock.dragEnd();
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
            onDragStart={startDrag}
            onOpen={() => {
              if (draggedRef.current) {
                draggedRef.current = false;
                return;
              }
              void window.notoDock.setExpanded(true);
            }}
            className="h-full w-full"
          />
        )}
      </div>
    </NotoDataContext.Provider>
  );
}
