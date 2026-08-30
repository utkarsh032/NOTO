import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from 'react';

import { cn } from '../utils/cn';

export interface DropdownItem {
  id: string;
  label: string;
  icon?: ReactNode;
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
export function Dropdown({ trigger, items, align = 'right', className, label }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();

  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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
          className={cn(
            'border-default bg-surface absolute top-[calc(100%+4px)] z-40 min-w-52 rounded-xl border py-1.5 shadow-[var(--noto-shadow-md)]',
            align === 'right' ? 'right-0' : 'left-0',
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
                {item.icon ? <span className="shrink-0">{item.icon}</span> : null}
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
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
