import type { ThemeMode, User } from '@noto/types';

import { IconButton } from '../components/IconButton';
import { KeyHint } from '../components/KeyHint';
import { ThemeToggle } from '../components/ThemeToggle';
import { BellIcon, SearchIcon } from '../components/icons';
import { cn } from '../utils/cn';
import { UserMenu } from './UserMenu';

export interface HeaderProps {
  user: User;
  theme: ThemeMode;
  onTheme(mode: ThemeMode): void;
  /** Opens the command palette, which is also where searching starts. */
  onSearch(): void;
  /** Formatted for this platform — "Ctrl K" or "⌘K". */
  searchShortcut: string;
  onOpenAccount(): void;
  onOpenSettings(): void;
  onOpenShortcuts(): void;
  /** Opens the plan comparison. */
  onOpenPlans(): void;
  /** Ends the session, which lands on the sign-in screen. */
  onSignOut(): void;
  /** How many notifications are waiting. Zero hides the dot. */
  notificationCount?: number;
  compact?: boolean;
}

/**
 * The global header: search on the left, the user on the right, nothing else.
 *
 * The search field is a button rather than an input. What it opens is the
 * command palette, which searches documents, memory and commands together — an
 * input here would collect a query the palette then has to be handed, and two
 * fields for one search is one field too many.
 *
 * There is no sidebar button here any more. The sidebar is opened and closed by
 * the handle on its own edge, which is in the same place whichever state it is
 * in; a second control that only appeared once the first one had gone was two
 * answers to one question.
 */
export function Header({
  user,
  theme,
  onTheme,
  onSearch,
  searchShortcut,
  onOpenAccount,
  onOpenSettings,
  onOpenShortcuts,
  onOpenPlans,
  onSignOut,
  notificationCount = 0,
  compact = false,
}: HeaderProps) {
  return (
    <header className="noto-print-hidden border-default bg-background h-header flex shrink-0 items-center gap-3 border-b px-4 sm:px-6">
      <button
        type="button"
        onClick={onSearch}
        className={cn(
          'border-default bg-surface hover:border-strong focus-visible:border-brand focus-visible:ring-brand-muted',
          'flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-md border px-3 text-left transition-colors focus-visible:ring-3 focus-visible:outline-none',
          compact ? 'max-w-full' : 'max-w-2xl',
        )}
      >
        <SearchIcon className="text-tertiary h-4 w-4 shrink-0" />
        <span className="text-tertiary text-body min-w-0 flex-1 truncate">
          Search notes, docs, memory…
        </span>
        <KeyHint keys={searchShortcut} className="hidden sm:inline-flex" />
      </button>

      <div className="ml-auto flex shrink-0 items-center gap-1">
        {/*
         * All three appearances in one control. Light and dark used to be two
         * buttons here with "match system" hidden in the account menu, which
         * meant the header could not show the state the user was actually in.
         */}
        <ThemeToggle value={theme} onChange={onTheme} size={compact ? 'sm' : 'md'} />

        <span className="relative inline-flex">
          <IconButton
            label={
              notificationCount > 0 ? `Notifications, ${notificationCount} unread` : 'Notifications'
            }
            icon={<BellIcon className="h-5 w-5" />}
            onClick={onOpenSettings}
          />
          {notificationCount > 0 ? (
            /* A dot, not a number: the count is in the label, and a badge with
               a digit in it turns the header into something to clear. */
            <span
              aria-hidden="true"
              className="bg-brand border-background absolute top-1.5 right-1.5 h-2 w-2 rounded-full border-2"
            />
          ) : null}
        </span>

        <UserMenu
          user={user}
          onOpenAccount={onOpenAccount}
          onOpenSettings={onOpenSettings}
          onOpenShortcuts={onOpenShortcuts}
          onOpenPlans={onOpenPlans}
          onSignOut={onSignOut}
          compact={compact}
          className="ml-1"
        />
      </div>
    </header>
  );
}
