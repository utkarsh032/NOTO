import type { PointerEvent as ReactPointerEvent } from 'react';
import { useRef, useState, useSyncExternalStore } from 'react';

import { cn } from '../../utils/cn';
import { DockHandle } from './DockHandle';
import { DockPanel, type DockRecentDocument } from './DockPanel';
import {
  DEFAULT_DOCK_PLACEMENT,
  clampOffset,
  readDockPlacement,
  subscribeToDockPlacement,
  writeDockPlacement,
  type DockSide,
} from './dock-placement';

export interface QuickNoteDockProps {
  /** Turns the current draft into a document. */
  onSave(text: string): Promise<void> | void;
  onOpenNoto(): void;
  onQuickPaste(): void;
  onSearch(): void;
  onAskAI(): void;
  recent?: DockRecentDocument[];
  onOpenRecent?(id: string): void;
}

/** How far a press has to travel before it stops being a click. */
const DRAG_THRESHOLD_PX = 5;

/**
 * The Quick Note dock, inside the application window.
 *
 * A handle stuck to one edge of the window that opens a narrow panel — the
 * arrangement a phone uses for its edge assistant, which is where the shape
 * comes from. On the desktop the same handle and the same panel are drawn by an
 * operating-system window instead, so the dock survives Noto being minimised or
 * closed; in a browser tab that is not possible, and this is what the idea
 * reduces to there: always in the window, never in the way, and movable to
 * whichever side of it your hands are.
 *
 * Dragging snaps live rather than on release. Cross the middle of the window
 * and the handle is already on the other edge, so the gesture answers as you
 * make it instead of after you have committed to it.
 */
export function QuickNoteDock(props: QuickNoteDockProps) {
  /* The third snapshot is for a server that does not exist here, and it has to
     be a constant for the same reason the cached one does. */
  const stored = useSyncExternalStore(
    subscribeToDockPlacement,
    readDockPlacement,
    () => DEFAULT_DOCK_PLACEMENT,
  );

  const [expanded, setExpanded] = useState(false);
  const [drag, setDrag] = useState<{ side: DockSide; offset: number } | null>(null);

  /* Set when a press turns into a drag, so the click it ends with is ignored. */
  const draggedRef = useRef(false);

  const side = drag?.side ?? stored.side;
  const offset = drag?.offset ?? stored.offset;

  const startDrag = (event: ReactPointerEvent<HTMLElement>) => {
    /* Only the primary button drags; a right-click is not a gesture here. */
    if (event.button !== 0) return;

    const origin = { x: event.clientX, y: event.clientY };
    draggedRef.current = false;

    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);

    const onMove = (move: PointerEvent) => {
      const travelled =
        Math.abs(move.clientX - origin.x) + Math.abs(move.clientY - origin.y) > DRAG_THRESHOLD_PX;

      if (!travelled && !draggedRef.current) return;
      draggedRef.current = true;

      setDrag({
        side: move.clientX < window.innerWidth / 2 ? 'left' : 'right',
        offset: clampOffset(move.clientY / window.innerHeight),
      });
    };

    const onUp = () => {
      target.releasePointerCapture(event.pointerId);
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
      target.removeEventListener('pointercancel', onUp);

      setDrag((current) => {
        if (current) writeDockPlacement({ ...current, enabled: true });
        return null;
      });
    };

    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
    target.addEventListener('pointercancel', onUp);
  };

  const flipSide = () => {
    writeDockPlacement({ ...stored, side: stored.side === 'right' ? 'left' : 'right' });
  };

  if (!stored.enabled) return null;

  return (
    <>
      {expanded ? (
        <div
          className={cn(
            'fixed top-1/2 z-40 w-[340px] max-w-[calc(100vw-1rem)] -translate-y-1/2',
            side === 'right' ? 'right-0' : 'left-0',
          )}
        >
          <DockPanel
            side={side}
            onClose={() => setExpanded(false)}
            onFlipSide={flipSide}
            onSave={props.onSave}
            onOpenNoto={props.onOpenNoto}
            onQuickPaste={props.onQuickPaste}
            onSearch={props.onSearch}
            onAskAI={props.onAskAI}
            recent={props.recent}
            onOpenRecent={props.onOpenRecent}
            /* The panel is tall; anchored to the middle of the edge it never
               hangs off the top or the bottom, whatever the window height. */
            className="max-h-[min(560px,calc(100vh-2rem))]"
          />
        </div>
      ) : (
        <div
          className={cn(
            'fixed z-40 -translate-y-1/2',
            side === 'right' ? 'right-0' : 'left-0',
            /* No transition while dragging: the handle should be under the
               pointer, not easing towards it. */
            drag ? '' : 'transition-[top] ease-out',
          )}
          style={{ top: `${offset * 100}%`, transitionDuration: 'var(--noto-duration-normal)' }}
        >
          <DockHandle
            side={side}
            isDragging={drag !== null}
            onDragStart={startDrag}
            onOpen={() => {
              if (draggedRef.current) {
                draggedRef.current = false;
                return;
              }
              setExpanded(true);
            }}
          />
        </div>
      )}
    </>
  );
}
