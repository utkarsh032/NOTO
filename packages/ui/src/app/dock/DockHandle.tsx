import type { PointerEvent as ReactPointerEvent } from 'react';

import notoIcon from '../../assets/noto-icon.png';
import { GripIcon } from '../../components/icons';
import { cn } from '../../utils/cn';
import type { DockSide } from './dock-placement';

export interface DockHandleProps {
  side: DockSide;
  /** Opens the panel. */
  onOpen(): void;
  /** Begins a drag. The host decides whether that moves a div or a window. */
  onDragStart(event: ReactPointerEvent<HTMLElement>): void;
  /** True while a drag is in progress, so the handle can stop pretending to be a button. */
  isDragging?: boolean;
  className?: string;
}

/**
 * The dock handle: Noto, reduced to a tab on the edge of the screen.
 *
 * This is the part that is always there — after the window is minimised, after
 * it is closed — so almost everything about it is about not being in the way.
 * It is 40px of a 96px-tall pill, tucked half off the edge it is stuck to, at
 * two-thirds opacity until a pointer comes near it. Hovering slides it fully
 * into view; that slide is the affordance, and it is the only animation.
 *
 * Two gestures, one control. A click opens the panel; a drag moves the dock to
 * the other side of the display or up and down the one it is on. They are told
 * apart by distance rather than by time — a press that has travelled more than
 * a few pixels was a drag, and everything shorter was a click — because a
 * press-and-hold to move something you can see is a gesture nobody discovers.
 */
export function DockHandle({ side, onOpen, onDragStart, isDragging, className }: DockHandleProps) {
  const isLeft = side === 'left';

  return (
    <button
      type="button"
      onClick={onOpen}
      onPointerDown={onDragStart}
      aria-label="Open Quick Note"
      title="Quick Note — click to open, drag to move"
      className={cn(
        'noto-print-hidden group border-default bg-surface flex h-24 w-11 flex-col items-center justify-center gap-2 border shadow-[var(--noto-shadow-md)]',
        'hover:border-brand-subtle focus-visible:outline-brand focus-visible:outline-2 focus-visible:outline-offset-2',
        'transition-[transform,border-color,background-color] ease-out',
        isLeft ? 'rounded-r-2xl border-l-0' : 'rounded-l-2xl border-r-0',
        /* Tucked in until wanted, then fully out. A dragging handle is already
           out, and should not also be sliding. */
        isDragging
          ? 'cursor-grabbing'
          : cn('cursor-grab', isLeft ? 'hover:translate-x-1' : 'hover:-translate-x-1'),
        className,
      )}
      style={{ transitionDuration: 'var(--noto-duration-normal)' }}
    >
      <img src={notoIcon} alt="" draggable={false} className="h-6 w-6" />

      <span className="text-tertiary text-caption whitespace-nowrap [writing-mode:vertical-rl]">
        Note
      </span>

      {/* The grip says the tab moves. It is the only part that is not the mark
          or the word, and it is deliberately the quietest thing on it. */}
      <GripIcon className="text-disabled group-hover:text-tertiary h-3.5 w-3.5 transition-colors" />
    </button>
  );
}
