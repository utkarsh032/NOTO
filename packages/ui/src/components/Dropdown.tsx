import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { cn } from '../utils/cn';

export interface DropdownItem {
  id: string;
  label: string;
  icon?: ReactNode;
  /**
   * A quieter second line under the label, for a choice that has to state what
   * it is as well as what it is called — "Narrow", and the four numbers that
   * makes it.
   */
  description?: string;
  /** Right-aligned in the row: a shortcut hint, a count, a check. */
  trailing?: ReactNode;
  /** Destructive items are drawn in the danger tone and sit last. */
  danger?: boolean;
  disabled?: boolean;
  /** Draws a hairline above this item, separating it from what came before. */
  separated?: boolean;
  /**
   * The item puts focus somewhere itself — back in the editor, into a field it
   * opened — so the menu should not pull it to the trigger on the way out.
   */
  keepsFocus?: boolean;
  onSelect(): void;
}

export interface DropdownProps {
  /** The control that opens the menu. Given the props it needs to behave as one. */
  trigger(props: {
    ref: React.Ref<HTMLButtonElement>;
    onClick(): void;
    'aria-expanded': boolean;
    'aria-haspopup': 'menu';
    'aria-controls': string;
  }): ReactNode;
  items: DropdownItem[];
  /** Which edge the menu hangs from. Right is the default for row actions. */
  align?: 'left' | 'right';
  /**
   * Which side of the trigger the menu opens on. Bottom is the default; top is
   * for a control at the foot of a panel, where a menu opening downward would
   * open into the edge of the window.
   */
  side?: 'top' | 'bottom';
  /**
   * Places the menu against the viewport, measured from the trigger's box,
   * rather than inside the trigger's own layout. For a control inside a panel
   * that clips its overflow — the sidebar does, so that it can animate its
   * width — where a menu drawn in place would be cut off at the panel's edge.
   */
  floating?: boolean;
  className?: string;
  label?: string;
}

/**
 * A menu hanging off a control.
 *
 * Keyboard-first: arrows move, Home and End jump, Escape closes and gives focus
 * back to the trigger, and typing nothing at all is still enough to use it
 * because the first item is focused on open. Clicking outside closes it, which
 * is the one behaviour a menu cannot be without.
 */
export function Dropdown({
  trigger,
  items,
  align = 'right',
  side = 'bottom',
  floating = false,
  className,
  label,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();

  /** Whether anything in this menu has a glyph, and so whether rows leave room. */
  const hasIcons = items.some((item) => item.icon);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  /*
   * Where a floating menu goes. Measured from the trigger when the menu opens,
   * before anything is painted, and again if the window changes size. A scroll
   * that moved the trigger would leave the menu behind — but the menu closes
   * on any press outside it, so that is not a state that lasts.
   */
  const [anchor, setAnchor] = useState<CSSProperties | null>(null);

  useLayoutEffect(() => {
    if (!open || !floating) return;

    const place = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const gap = 4;
      setAnchor({
        position: 'fixed',
        ...(side === 'top'
          ? { bottom: window.innerHeight - rect.top + gap }
          : { top: rect.bottom + gap }),
        ...(align === 'right' ? { right: window.innerWidth - rect.right } : { left: rect.left }),
      });
    };

    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [open, floating, side, align]);

  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  /* Anything outside the menu and its trigger dismisses it. */
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  /* Open with the first item focused, so the menu is usable without a mouse. */
  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus();
  }, [open]);

  const onMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }

    const options = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [],
    );
    if (options.length === 0) return;

    const index = options.indexOf(document.activeElement as HTMLElement);

    const focusAt = (next: number) => {
      event.preventDefault();
      options[(next + options.length) % options.length]?.focus();
    };

    if (event.key === 'ArrowDown') focusAt(index + 1);
    else if (event.key === 'ArrowUp') focusAt(index - 1);
    else if (event.key === 'Home') focusAt(0);
    else if (event.key === 'End') focusAt(options.length - 1);
  };

  return (
    <div className={cn('relative', className)}>
      {trigger({
        ref: triggerRef,
        onClick: () => setOpen((value) => !value),
        'aria-expanded': open,
        'aria-haspopup': 'menu',
        'aria-controls': menuId,
      })}

      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKeyDown}
          style={floating ? (anchor ?? undefined) : undefined}
          className={cn(
            'border-default bg-surface z-40 min-w-52 rounded-xl border py-1.5 shadow-[var(--noto-shadow-md)]',
            /* A menu longer than the window scrolls inside itself. Without
               this the last few entries hang off the bottom of the screen,
               where they cannot be clicked and, on a short laptop, cannot be
               reached at all. */
            'noto-scroll-y max-h-[min(70vh,32rem)] overflow-y-auto',
            floating
              ? /* Placed by `anchor`; kept off screen until it has been measured. */
                anchor
                ? null
                : 'invisible fixed'
              : [
                  'absolute',
                  side === 'top' ? 'bottom-[calc(100%+4px)]' : 'top-[calc(100%+4px)]',
                  align === 'right' ? 'right-0' : 'left-0',
                ],
          )}
        >
          {items.map((item) => (
            <div key={item.id}>
              {item.separated ? <div className="bg-default mx-2 my-1.5 h-px" /> : null}
              <button
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                  if (!item.keepsFocus) triggerRef.current?.focus();
                }}
                className={cn(
                  'text-body-sm flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors',
                  'focus-visible:outline-brand focus-visible:outline-2 focus-visible:-outline-offset-2',
                  'disabled:pointer-events-none disabled:opacity-40',
                  item.danger
                    ? 'text-danger hover:bg-danger/10 focus:bg-danger/10'
                    : 'text-secondary hover:bg-surface-secondary focus:bg-surface-secondary hover:text-primary focus:text-primary',
                )}
              >
                {/*
                 * The slot is kept whether or not this row fills it, so a menu
                 * where only some entries carry a glyph still reads as one
                 * column of labels rather than two ragged ones. A menu with no
                 * glyphs at all reserves nothing.
                 */}
                {item.icon ? (
                  <span className="shrink-0">{item.icon}</span>
                ) : hasIcons ? (
                  <span className="w-4 shrink-0" aria-hidden="true" />
                ) : null}
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{item.label}</span>
                  {item.description ? (
                    <span className="text-tertiary text-caption mt-0.5 block">
                      {item.description}
                    </span>
                  ) : null}
                </span>
                {item.trailing ? (
                  <span className="text-tertiary text-caption shrink-0">{item.trailing}</span>
                ) : null}
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
