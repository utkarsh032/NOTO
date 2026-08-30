import type { ThemeMode, User } from '@noto/types';

import { Avatar } from '../components/Avatar';
import { Dropdown, type DropdownItem } from '../components/Dropdown';
import {
  ChevronDownIcon,
  KeyboardIcon,
  LogOutIcon,
  MonitorIcon,
  SettingsIcon,
  UserIcon,
} from '../components/icons';
import { cn } from '../utils/cn';

export interface UserMenuProps {
  user: User;
  theme: ThemeMode;
  onTheme(mode: ThemeMode): void;
  onOpenAccount(): void;
  onOpenSettings(): void;
  onOpenShortcuts(): void;
  /** Hides the name and chevron, leaving the avatar. For narrow windows. */
  compact?: boolean;
  className?: string;
}

/**
 * The account control in the header.
 *
 * It carries the two settings people look for by face rather than by name —
 * where the theme is decided and where the shortcuts are listed — because the
 * avatar is where everyone looks first for anything about themselves.
 */
export function UserMenu({
  user,
  theme,
  onTheme,
  onOpenAccount,
  onOpenSettings,
  onOpenShortcuts,
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
      id: 'theme-system',
      label: 'Match system appearance',
      icon: <MonitorIcon className="h-4 w-4" />,
      trailing: theme === 'system' ? 'On' : undefined,
      separated: true,
      onSelect: () => onTheme('system'),
    },
    {
      id: 'sign-out',
      /* Noto works signed out, so this is a real end state rather than a wall. */
      label: 'Sign out',
      icon: <LogOutIcon className="h-4 w-4" />,
      separated: true,
      danger: true,
      onSelect: onOpenAccount,
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
