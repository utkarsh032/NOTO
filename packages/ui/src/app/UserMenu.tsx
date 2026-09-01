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
  user: User;
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
      label: 'Account & Devices',
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
    {
      id: 'sign-out',
      /* Noto works signed out, so this is a real end state rather than a wall. */
      label: 'Sign out',
      icon: <LogOutIcon className="h-4 w-4" />,
      separated: true,
      danger: true,
      onSelect: onSignOut,
    },
  ];

  return (
    <Dropdown
      label="Account"
      items={items}
      className={className}
      trigger={(props) => (
        <button
          type="button"
          {...props}
          aria-label={`Account: ${user.displayName}`}
          className={cn(
            'hover:bg-surface-secondary focus-visible:outline-brand flex items-center gap-2 rounded-md py-1 pr-2 pl-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-1',
          )}
        >
          <Avatar name={user.displayName} src={user.avatarUrl} />
          {compact ? null : (
            <>
              <span className="text-primary text-body-sm max-w-32 truncate font-medium">
                {user.displayName}
              </span>
              <ChevronDownIcon className="text-tertiary h-4 w-4" />
            </>
          )}
        </button>
      )}
    />
  );
}
