import { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef } from 'react';

import { cn } from '../utils/cn';

/**
 * The scrolling viewport the document lives in.
 *
 * One scroll container per pane, not one per document: the toolbar is sticky
 * inside it, and a second scroller wrapped around the editor would pin the
 * toolbar to a box that never moves. Horizontal scrolling belongs a level
 * further in — to the code block, the table, or the unwrapped paragraph that
 * outgrew the measure — and the prose styles put it there, so this scroller
 * only ever moves vertically.
 *
 * Its other job is remembering. Switching tabs unmounts the editor, and coming
 * back to a document three pages down only to be dropped at the title again is
 * the kind of small loss that makes tabs feel disposable.
 */

/**
 * Where each document was left, by id.
 *
 * Module scope rather than a store: nothing else in Noto reads this, it is
 * written on every scroll event, and holding it in state would re-render the
 * shell continuously for something with no visible representation. A tab closed
 * and reopened keeps its place deliberately; the map is only lost with the
 * session, which is the same lifetime as the rest of the shell's ephemeral UI.
 */
const offsets = new Map<string, number>();

export interface EditorScrollAreaProps {
  /**
   * What is being scrolled — the open document's id. Changing it saves the
   * outgoing position and restores the incoming one.
   */
  scrollKey: string | null;
  children: ReactNode;
  className?: string;
}

export function EditorScrollArea({ scrollKey, children, className }: EditorScrollAreaProps) {
  const ref = useRef<HTMLDivElement>(null);

  /** Which document the offsets currently in the DOM belong to. */
  const currentKey = useRef<string | null>(scrollKey);

  /**
   * True while the component is putting the scroller back where it was.
   *
   * Restoring fires scroll events of its own, and a scroller that is briefly
   * too short to reach the saved offset reports the clamped one. Recording that
   * would overwrite the position with the very value the restore is trying to
   * undo, so nothing is recorded until the restore has settled.
   */
  const restoring = useRef(false);

  const remember = useCallback(() => {
    if (restoring.current) return;

    const element = ref.current;
    const key = currentKey.current;
    if (element && key) offsets.set(key, element.scrollTop);
  }, []);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    currentKey.current = scrollKey;
    const target = scrollKey ? (offsets.get(scrollKey) ?? 0) : 0;

    /*
     * An explicit behaviour, because the container asks for smooth scrolling
     * and restoring a position is not a scroll the user made — animating it
     * would show them the whole document sliding past on the way.
     */
    const apply = () => element.scrollTo({ top: target, behavior: 'instant' });

    restoring.current = true;
    apply();

    /*
     * The editor mounts its content after this effect runs, so on the first
     * pass the scroller can still be too short to reach the saved offset. One
     * more attempt on the next frame is enough, and it lands well before the
     * user could have scrolled anywhere themselves.
     */
    const frame = requestAnimationFrame(() => {
      if (element.scrollTop !== target) apply();
      restoring.current = false;
    });

    return () => {
      cancelAnimationFrame(frame);
      restoring.current = false;
    };
  }, [scrollKey]);

  /*
   * Saved on the way out as well as on every scroll: closing the pane is the
   * one case where the last scroll event has already been and gone.
   */
  useEffect(() => remember, [remember]);

  return (
    <div
      ref={ref}
      onScroll={remember}
      /*
       * Vertical only. Anything wide enough to need sideways movement scrolls
       * inside itself, which keeps the sticky toolbar above the document rather
       * than sliding out of the window with it.
       */
      className={cn('noto-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto', className)}
    >
      {children}
    </div>
  );
}
