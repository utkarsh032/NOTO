import type { User } from '@noto/types';

import notoIcon from '../assets/noto-icon.png';
import { IconButton } from '../components/IconButton';
import { PlusIcon, SearchIcon } from '../components/icons';
import { UserMenu } from './UserMenu';
import { useNotoActions } from './use-noto-actions';
import { navigate } from './router';

export interface MobileHeaderProps {
  /** `null` when nobody is signed in. The menu still opens; the identity does not. */
  user: User | null;
  /** Opens the command palette, which is also where searching starts. */
  onSearch(): void;
  onOpenAccount(): void;
  onOpenSettings(): void;
  onOpenShortcuts(): void;
  onOpenPlans(): void;
  onSignOut(): void;
}

/**
 * The top bar on a phone.
 *
 * A phone has no sidebar, and the sidebar is where search, appearance and the
 * account went — so this is the three of them, minus the one that does not
 * belong on a phone. Appearance is in Settings, a tap inside this menu: a
 * three-way switch is a poor use of a thumb's worth of a 360px bar, and nobody
 * changes their theme on the move.
 *
 * Tabs are deliberately not here. A strip of them is unreadable at this width,
 * and a phone shows one document at a time anyway — the way back to the others
 * is Documents in the bar along the bottom. Starting a new one is, though: it
 * is the one thing a header offers whether or not anything is open, and it is
 * the reason most people pick the phone up.
 */
export function MobileHeader({
  user,
  onSearch,
  onOpenAccount,
  onOpenSettings,
  onOpenShortcuts,
  onOpenPlans,
  onSignOut,
}: MobileHeaderProps) {
  const actions = useNotoActions();

  return (
    <header className="noto-print-hidden border-default bg-background flex h-14 shrink-0 items-center gap-2 border-b px-3">
      <button
        type="button"
        onClick={() => navigate({ name: 'home' })}
        aria-label="Noto — go to Home"
        title="Home"
        className="focus-visible:outline-brand shrink-0 rounded-md transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <img src={notoIcon} alt="" className="h-8 w-8" draggable={false} />
      </button>

      {/*
       * A button rather than an input, for the same reason it was one in the
       * header this replaces: what it opens is the command palette, and two
       * fields for one search is one field too many.
       */}
      <button
        type="button"
        onClick={onSearch}
        /* The bar along the bottom has a Search of its own that goes to the
           search screen. This one opens the palette, so it says so. */
        aria-label="Search everything"
        className="border-default bg-surface hover:border-strong focus-visible:border-brand focus-visible:ring-brand-muted flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border px-3 text-left transition-colors focus-visible:ring-3 focus-visible:outline-none"
      >
        <SearchIcon className="text-tertiary h-4 w-4 shrink-0" />
        <span className="text-tertiary text-body-sm min-w-0 flex-1 truncate">Search</span>
      </button>

      <IconButton
        label="New document"
        icon={<PlusIcon className="h-5 w-5" />}
        onClick={() => void actions.newDocument()}
        className="shrink-0"
      />

      <UserMenu
        compact
        user={user}
        onOpenAccount={onOpenAccount}
        onOpenSettings={onOpenSettings}
        onOpenShortcuts={onOpenShortcuts}
        onOpenPlans={onOpenPlans}
        onSignOut={onSignOut}
        className="shrink-0"
      />
    </header>
  );
}
