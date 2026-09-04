import { APP_NAME } from '@noto/config';
import { useMemo, useState } from 'react';

import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Tabs } from '../../components/Tabs';
import { Toggle } from '../../components/Toggle';
import { showToast } from '../../components/toast-store';
import { CheckCircleIcon, InfoIcon, LockIcon, ShieldIcon } from '../../components/icons';
import { formatBytes, formatDate, relativeTime } from '../../utils/format';
import { PageContainer } from '../PageContainer';
import { DeviceCard } from '../account/DeviceCard';
import { SessionRow } from '../account/SessionRow';
import { SettingsRow, SettingsSection } from '../settings/SettingsSection';
import { useNotoData } from '../data-context';
import { navigate } from '../router';
import { useAccount } from '../use-account';

type AccountTab = 'account' | 'devices' | 'sessions' | 'security' | 'preferences';

/** Every action here needs an account service that does not exist yet. */
const NOT_CONNECTED = `${APP_NAME} has no account service yet, so nothing was changed.`;

/**
 * Account & Devices.
 *
 * Noto works signed out and stores everything locally, so this screen describes
 * an account rather than gating one — and it says so at the top instead of
 * letting each button explain itself after the fact.
 */
export function AccountScreen() {
  const { user, devices, sessions, plan, security } = useAccount();
  const { documents } = useNotoData();

  const [tab, setTab] = useState<AccountTab>('account');
  const [signingOutOthers, setSigningOutOthers] = useState(false);

  const usedBytes = useMemo(
    () =>
      (documents ?? []).reduce(
        (total, document) => total + JSON.stringify(document.content).length,
        0,
      ),
    [documents],
  );

  const otherSessions = sessions.filter((session) => !session.isCurrent);
  const notConnected = () => showToast(NOT_CONNECTED);

  /*
   * Signed out, there is no account to manage — so the screen says that and
   * offers the one action that changes it, rather than rendering a profile,
   * a device list and a security history belonging to nobody.
   */
  if (!user) {
    return (
      <PageContainer
        title="Account & Devices"
        subtitle="Sign in to manage your account, devices and security."
      >
        <div className="border-default bg-surface-secondary flex flex-col items-start gap-4 rounded-xl border px-5 py-6">
          <div className="flex items-start gap-2.5">
            <InfoIcon className="text-tertiary mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-secondary text-body-sm">
              You are not signed in. {APP_NAME} is local-first, so everything on this device keeps
              working — an account adds a second copy, and the devices and sessions it lists are the
              ones that copy has reached.
            </p>
          </div>

          <Button variant="primary" onClick={() => navigate('login')}>
            Sign in or create an account
          </Button>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Account & Devices"
      subtitle="Manage your account, devices, and security settings."
      asideLabel="Plan, storage and security"
      aside={
        <div className="flex flex-col gap-4">
          <aside className="border-default bg-surface rounded-xl border p-4">
            <h2 className="text-primary text-body-sm font-semibold">Your plan</h2>
            <p className="text-brand-strong text-h4 mt-1">{plan.name}</p>
            <p className="text-tertiary text-caption mt-1">{plan.description}</p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3 w-full"
              onClick={() => navigate('plans')}
            >
              Compare plans
            </Button>
          </aside>

          <aside className="border-default bg-surface rounded-xl border p-4">
            <h2 className="text-primary text-body-sm font-semibold">Storage usage</h2>
            <p className="text-tertiary text-caption mt-1">
              {formatBytes(usedBytes)} used of {formatBytes(plan.storageLimitBytes)}
            </p>
            <div className="bg-surface-tertiary mt-2 h-1.5 overflow-hidden rounded-full">
              <div
                className="bg-brand h-full rounded-full"
                style={{
                  width: `${Math.min(100, Math.max(2, (usedBytes / plan.storageLimitBytes) * 100))}%`,
                }}
              />
            </div>
            <p className="text-tertiary text-caption mt-1.5">
              Documents are stored on this device; the allowance applies once sync is on.
            </p>
          </aside>

          <aside className="border-default bg-surface rounded-xl border p-4">
            <h2 className="text-primary text-body-sm font-semibold">Security</h2>
            <ul className="mt-2 flex flex-col gap-2">
              <li className="text-secondary text-caption flex items-center gap-2">
                <LockIcon className="text-tertiary h-4 w-4 shrink-0" />
                Password changed {relativeTime(security.passwordChangedAt)}
              </li>
              <li className="text-secondary text-caption flex items-center gap-2">
                <ShieldIcon
                  className={
                    security.twoFactorEnabled ? 'text-success h-4 w-4' : 'text-warning h-4 w-4'
                  }
                />
                Two-factor {security.twoFactorEnabled ? 'on' : 'off'}
              </li>
              <li className="text-secondary text-caption flex items-center gap-2">
                <CheckCircleIcon className="text-tertiary h-4 w-4 shrink-0" />
                Recovery email set
              </li>
            </ul>
          </aside>
        </div>
      }
      tabs={
        <Tabs
          label="Account sections"
          value={tab}
          onChange={setTab}
          items={[
            { value: 'account', label: 'Account' },
            { value: 'devices', label: 'Devices', count: devices.length },
            { value: 'sessions', label: 'Sessions', count: sessions.length },
            { value: 'security', label: 'Security' },
            { value: 'preferences', label: 'Preferences' },
          ]}
        />
      }
    >
      {/* Said once, at the top, rather than by every button after the click. */}
      <div className="border-default bg-surface-secondary text-secondary text-body-sm mb-5 flex items-start gap-2.5 rounded-xl border px-4 py-3">
        <InfoIcon className="text-tertiary mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Noto is local-first and works signed out. Accounts, devices and sessions arrive with sync
          — until then this is how they will be managed, and nothing here leaves your device.
        </p>
      </div>

      {tab === 'account' ? (
        <SettingsSection title="Profile">
          <div className="flex flex-wrap items-center gap-4 px-5 py-5">
            <Avatar name={user.displayName} src={user.avatarUrl} size="xl" />

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-primary text-h3">{user.displayName}</h3>
                <Badge tone="success">
                  <CheckCircleIcon className="h-3.5 w-3.5" />
                  Verified
                </Badge>
              </div>
              <p className="text-secondary text-body-sm mt-1">{user.email}</p>
              <p className="text-tertiary text-caption mt-0.5">
                Joined {formatDate(user.createdAt)}
              </p>
            </div>

            <Button variant="secondary" onClick={notConnected}>
              Edit Profile
            </Button>
          </div>

          <SettingsRow
            label="Display name"
            description={user.displayName}
            control={
              <Button variant="ghost" size="sm" onClick={notConnected}>
                Change
              </Button>
            }
          />
          <SettingsRow
            label="Email"
            description={user.email}
            control={
              <Button variant="ghost" size="sm" onClick={notConnected}>
                Change
              </Button>
            }
          />
        </SettingsSection>
      ) : null}

      {tab === 'devices' ? (
        <section aria-label="Devices">
          <ul className="flex flex-col gap-3">
            {devices.map((device) => (
              <DeviceCard
                key={device.id}
                device={device}
                onSignOut={notConnected}
                onRemove={notConnected}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {tab === 'sessions' ? (
        <section aria-label="Sessions" className="flex flex-col gap-4">
          <div className="border-default bg-surface overflow-hidden rounded-xl border shadow-sm">
            <ul>
              {sessions.map((session) => (
                <SessionRow key={session.id} session={session} onSignOut={notConnected} />
              ))}
            </ul>
          </div>

          <div className="flex justify-end">
            <Button
              variant="danger"
              disabled={otherSessions.length === 0}
              onClick={() => setSigningOutOthers(true)}
            >
              Sign out from all other sessions
            </Button>
          </div>
        </section>
      ) : null}

      {tab === 'security' ? (
        <SettingsSection title="Security" description="How this account is protected.">
          <SettingsRow
            label="Password"
            description={`Last changed ${relativeTime(security.passwordChangedAt)}.`}
            control={
              <Button variant="secondary" size="sm" onClick={notConnected}>
                Change password
              </Button>
            }
          />
          <SettingsRow
            label="Two-factor authentication"
            description="A second step when signing in on a new device."
            control={
              <Toggle
                hideLabel
                label="Two-factor authentication"
                checked={security.twoFactorEnabled}
                onChange={notConnected}
              />
            }
          />
          <SettingsRow
            label="Recovery email"
            description={security.recoveryEmail ?? 'Not set'}
            control={
              <Button variant="secondary" size="sm" onClick={notConnected}>
                Update
              </Button>
            }
          />
        </SettingsSection>
      ) : null}

      {tab === 'preferences' ? (
        <SettingsSection
          title="Preferences"
          description="How Noto behaves belongs with the rest of the settings."
        >
          <SettingsRow
            label="Appearance, editor and sync"
            description="Theme, typography, autosave and everything else live in Settings."
            control={
              <Button variant="secondary" size="sm" onClick={() => navigate('settings')}>
                Open Settings
              </Button>
            }
          />
          <SettingsRow
            label="Email from Noto"
            description="There is no mailing list, because there is no account service."
            control={<Badge>None</Badge>}
          />
        </SettingsSection>
      ) : null}

      <ConfirmDialog
        open={signingOutOthers}
        title="Sign out everywhere else?"
        destructive
        confirmLabel="Sign out other sessions"
        description={
          <>
            <p>
              {otherSessions.length} other {otherSessions.length === 1 ? 'session' : 'sessions'}{' '}
              will be ended. This session stays signed in.
            </p>
            <p className="mt-2">Documents on those devices are not deleted.</p>
          </>
        }
        onConfirm={notConnected}
        onClose={() => setSigningOutOthers(false)}
      />
    </PageContainer>
  );
}
