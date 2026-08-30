import type { ReactNode } from 'react';

import { ArrowRightIcon } from '../../components/icons';
import { cn } from '../../utils/cn';

export type QuickActionTone = 'brand' | 'info' | 'warning' | 'ai';

export interface QuickActionCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  tone: QuickActionTone;
  onSelect(): void;
}

/**
 * The tint on the icon, and nothing else.
 *
 * Four cards side by side is exactly where a colour system gets away from you:
 * tinting the whole card would make the row the loudest thing on the page, and
 * the page is about the greeting and the documents under it. The colour is
 * there to tell the four apart at a glance, so it goes on the one element that
 * is already a symbol.
 */
const TONE: Record<QuickActionTone, string> = {
  brand: 'bg-brand-soft text-brand-hover',
  info: 'bg-info/10 text-info',
  warning: 'bg-warning/10 text-warning',
  ai: 'bg-ai-soft text-ai',
};

export function QuickActionCard({
  title,
  description,
  icon,
  tone,
  onSelect,
}: QuickActionCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'group/action border-default bg-surface hover:border-strong focus-visible:outline-brand',
        'flex items-start gap-3.5 rounded-xl border p-5 text-left shadow-sm transition-all hover:shadow-md',
        'focus-visible:outline-2 focus-visible:outline-offset-2',
      )}
    >
      <span
        className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-lg', TONE[tone])}
      >
        {icon}
      </span>

      <span className="min-w-0 flex-1">
        <span className="text-primary text-body font-semibold">{title}</span>
        <span className="text-tertiary text-caption mt-1 block">{description}</span>
      </span>

      {/* The arrow is the affordance the whole card carries; it brightens with
          the card rather than being a second control inside it. */}
      <span
        aria-hidden="true"
        className="border-default text-tertiary group-hover/action:border-brand group-hover/action:bg-brand group-hover/action:text-on-brand mt-6 flex h-8 w-8 shrink-0 items-center justify-center self-end rounded-full border transition-colors"
      >
        <ArrowRightIcon className="h-4 w-4" />
      </span>
    </button>
  );
}
