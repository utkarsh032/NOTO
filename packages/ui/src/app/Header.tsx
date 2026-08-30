import type { ThemeMode, User } from '@noto/types';

import { IconButton } from '../components/IconButton';
import { KeyHint } from '../components/KeyHint';
import { BellIcon, MoonIcon, SearchIcon, SidebarIcon, SunIcon } from '../components/icons';
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
  /** Shown only when the sidebar has no toggle of its own left. */
  onExpandSidebar?: () => void;
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
  onExpandSidebar,
  notificationCount = 0,
  compact = false,
}: HeaderProps) {
  return (
    <header className="noto-print-hidden border-default bg-background h-header flex shrink-0 items-center gap-3 border-b px-4 sm:px-6">
      {onExpandSidebar ? (
        <IconButton
          label="Expand sidebar"
          icon={<SidebarIcon className="h-5 w-5" />}
          onClick={onExpandSidebar}
          className="-ml-2"
        />
      ) : null}

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
         * Light and dark as two controls rather than one that cycles: a toggle
         * whose next state you have to remember is a toggle you press twice.
         * "Match system" lives in the account menu, where a preference belongs.
         */}
        <div className="flex items-center">
          <IconButton
            label="Light appearance"
            icon={<SunIcon className="h-5 w-5" />}
            isActive={theme === 'light'}
            onClick={() => onTheme('light')}
          />
          <IconButton
            label="Dark appearance"
            icon={<MoonIcon className="h-5 w-5" />}
            isActive={theme === 'dark'}
            onClick={() => onTheme('dark')}
          />
        </div>

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
          theme={theme}
          onTheme={onTheme}
          onOpenAccount={onOpenAccount}
          onOpenSettings={onOpenSettings}
          onOpenShortcuts={onOpenShortcuts}
          compact={compact}
          className="ml-1"
        />
      </div>
    </header>
  );
}
