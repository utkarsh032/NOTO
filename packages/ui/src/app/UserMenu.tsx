import type { User } from '@noto/types';

import { Avatar } from '../components/Avatar';
import { Dropdown, type DropdownItem } from '../components/Dropdown';
import {
  ChevronDownIcon,
  CrownIcon,
  KeyboardIcon,
  LogOutIcon,
  SettingsIcon,
  UserIcon,
} from '../components/icons';
import { cn } from '../utils/cn';

export interface UserMenuProps {
  /** `null` when nobody is signed in. The menu still opens; the identity does not. */
  user: User | null;
  onOpenAccount(): void;
  onOpenSettings(): void;
  onOpenShortcuts(): void;
  onOpenPlans(): void;
  onSignOut(): void;
  /** Hides the name and chevron, leaving the avatar. For narrow windows. */
  compact?: boolean;
  className?: string;
}

/**
 * The account control in the header.
 *
 * Everything about the person lives here — the account itself, the settings,
 * the shortcuts, the plan — which is why the sidebar no longer lists Settings
 * and Account beside the documents. The avatar is where everyone looks first
 * for anything about themselves, so this is the one place to look.
 *
 * The appearance switch that used to hang off the bottom of this menu is gone:
 * it is a control in the header now, showing all three modes at once, and a
 * preference is easier to trust when you can see it.
 */
export function UserMenu({
  user,
  onOpenAccount,
  onOpenSettings,
  onOpenShortcuts,
  onOpenPlans,
  onSignOut,
  compact = false,
  className,
}: UserMenuProps) {
  const items: DropdownItem[] = [
    {
      id: 'account',
      label: user ? 'Account & Devices' : 'Sign in',
      icon: <UserIcon className="h-4 w-4" />,
      onSelect: onOpenAccount,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <SettingsIcon className="h-4 w-4" />,
      onSelect: onOpenSettings,
    },
    {
      id: 'shortcuts',
      label: 'Keyboard Shortcuts',
      icon: <KeyboardIcon className="h-4 w-4" />,
      onSelect: onOpenShortcuts,
    },
    {
      id: 'plans',
      label: 'Plans & Pricing',
      icon: <CrownIcon className="h-4 w-4" />,
      separated: true,
      onSelect: onOpenPlans,
    },
  ];

  /*
   * Signing out is offered only to somebody who is signed in. Noto works signed
   * out, so this is a real end state rather than a wall — but showing it to a
   * visitor who has never had an account is an action with nothing behind it.
   */
  if (user) {
    items.push({
      id: 'sign-out',
      label: 'Sign out',
      icon: <LogOutIcon className="h-4 w-4" />,
      separated: true,
      danger: true,
      onSelect: onSignOut,
    });
  }

  return (
    <Dropdown
      label="Account"
      items={items}
      className={className}
      trigger={(props) => (
        <button
          type="button"
          {...props}
          aria-label={user ? `Account: ${user.displayName}` : 'Account: not signed in'}
          className={cn(
            'hover:bg-surface-secondary focus-visible:outline-brand flex items-center gap-2 rounded-md py-1 pr-2 pl-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-1',
          )}
        >
          {user ? (
            <Avatar name={user.displayName} src={user.avatarUrl} />
          ) : (
            <span className="bg-surface-secondary text-tertiary flex h-7 w-7 items-center justify-center rounded-full">
              <UserIcon className="h-4 w-4" />
            </span>
          )}
          {compact ? null : (
            <>
              <span className="text-primary text-body-sm max-w-32 truncate font-medium">
                {user ? user.displayName : 'Sign in'}
              </span>
              <ChevronDownIcon className="text-tertiary h-4 w-4" />
            </>
          )}
        </button>
      )}
    />
  );
}
