import { APP_NAME } from '@noto/config';
import { useMemo, useState } from 'react';

import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Tabs } from '../../components/Tabs';
import { CheckCircleIcon, InfoIcon } from '../../components/icons';
import { showToast } from '../../components/toast-store';
import { formatBytes, formatDate, relativeTime } from '../../utils/format';
import { PageContainer } from '../PageContainer';
import { DeviceCard } from '../account/DeviceCard';
import { SessionRow } from '../account/SessionRow';
import { SettingsRow, SettingsSection } from '../settings/SettingsSection';
import { useNotoData } from '../data-context';
import { navigate } from '../router';
import { useAccount } from '../use-account';
import { useSignOut } from '../use-sign-out';

type AccountTab = 'account' | 'devices' | 'sessions' | 'security' | 'preferences';

/** The security log's event kinds, as a person would say them. */
const EVENT_LABELS: Record<string, string> = {
  sign_in: 'Signed in',
  sign_out: 'Signed out',
  sign_up: 'Account created',
  refresh: 'Session renewed',
  password_reset: 'Password reset',
  password_change: 'Password changed',
  email_verified: 'Email address confirmed',
  email_change: 'Email address changed',
  device_revoked: 'Device signed out',
  session_revoked: 'Session ended',
};

function describeEvent(kind: string): string {
  return EVENT_LABELS[kind] ?? kind.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

/**
 * Account & Devices.
 *
 * Noto works signed out and stores everything locally, so this screen describes
 * an account rather than gating one — and it says so at the top instead of
 * letting each button explain itself after the fact.
 */
export function AccountScreen() {
  const { status, user, devices, sessions, plan, security, events, revokeDevice, revokeSession } =
    useAccount();
  const { documents } = useNotoData();
  const { signOut, available: canSignOut } = useSignOut();

  const [tab, setTab] = useState<AccountTab>('account');
  const [signingOut, setSigningOut] = useState(false);

  const usedBytes = useMemo(
    () =>
      (documents ?? []).reduce(
        (total, document) => total + JSON.stringify(document.content).length,
        0,
      ),
    [documents],
  );

  /*
   * Nobody signed in.
   *
   * With an account service configured this screen is never reached that way —
   * the route guard sends the visitor to sign in first, and back here after.
   * What is left is the build that ships without cloud credentials, where there
   * is nothing to sign into and so nothing to redirect to: the screen explains
   * itself rather than rendering a profile, a device list and a security
   * history belonging to nobody.
   */
  if (!user) {
    const noService = status === 'unavailable';

    return (
      <PageContainer
        title="Account & Devices"
        subtitle={
          noService
            ? `This build of ${APP_NAME} has no account service.`
            : 'Sign in to manage your account, devices and security.'
        }
      >
        <div className="border-default bg-surface-secondary flex flex-col items-start gap-4 rounded-xl border px-5 py-6">
          <div className="flex items-start gap-2.5">
            <InfoIcon className="text-tertiary mt-0.5 h-4 w-4 shrink-0" />
            {noService ? (
              <p className="text-secondary text-body-sm">
                There is no account to manage here, and nothing on this screen is waiting on one.{' '}
                {APP_NAME} is local-first: every document, note and setting lives on this device and
                keeps working exactly as it does now.
              </p>
            ) : (
              <p className="text-secondary text-body-sm">
                You are not signed in. {APP_NAME} is local-first, so everything on this device keeps
                working — an account adds a second copy, and the devices and sessions it lists are
                the ones that copy has reached.
              </p>
            )}
          </div>

          {noService ? null : (
            <Button variant="primary" onClick={() => navigate('login')}>
              Sign in or create an account
            </Button>
          )}
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
          {revokeDevice
            ? 'Your profile, your devices, your sessions and signing out are live, and you can sign other devices out from here. Editing your profile and two-step sign-in come later; until then they are shown, not offered.'
            : 'Your profile, your devices and signing out are live. Editing your profile, ending other sessions and the security settings come later; until then they are shown, not offered.'}{' '}
          Documents stay on this device either way: Noto is local-first, and an account adds a copy
          rather than becoming the original.
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
          </div>

          <SettingsRow label="Display name" description={user.displayName} />
          <SettingsRow label="Email" description={user.email} />

          {/*
           * Signing out belongs here as well as in the avatar menu. This is the
           * screen somebody opens when they want to do something about their
           * account, and "stop being signed in on this device" is the one thing
           * on it that works today.
           */}
          {canSignOut ? (
            <SettingsRow
              label="Sign out"
              description="Ends this session on this device. Documents already here stay where they are."
              control={
                <Button variant="secondary" size="sm" onClick={() => setSigningOut(true)}>
                  Sign out
                </Button>
              }
            />
          ) : null}
        </SettingsSection>
      ) : null}

      {tab === 'devices' ? (
        <section aria-label="Devices">
          <ul className="flex flex-col gap-3">
            {devices.map((device) => (
              <DeviceCard
                key={device.id}
                device={device}
                {...(revokeDevice
                  ? {
                      onSignOut: () => {
                        void revokeDevice(device.id).then((done) =>
                          showToast(
                            done
                              ? `${device.name} is signed out.`
                              : `${device.name} could not be signed out. Try again.`,
                          ),
                        );
                      },
                    }
                  : {})}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {tab === 'sessions' ? (
        <section aria-label="Sessions" className="flex flex-col gap-4">
          {sessions.length === 0 ? (
            <p className="text-tertiary text-body-sm">
              The account service does not list sessions yet. Each device above holds one.
            </p>
          ) : (
            <div className="border-default bg-surface overflow-hidden rounded-xl border shadow-sm">
              <ul>
                {sessions.map((session) => (
                  <SessionRow
                    key={session.id}
                    session={session}
                    {...(revokeSession
                      ? {
                          onSignOut: () => {
                            void revokeSession(session.id).then((done) =>
                              showToast(
                                done
                                  ? 'That session has ended.'
                                  : 'The session could not be ended. Try again.',
                              ),
                            );
                          },
                        }
                      : {})}
                  />
                ))}
              </ul>
            </div>
          )}
        </section>
      ) : null}

      {tab === 'security' ? (
        <div className="flex flex-col gap-5">
          <SettingsSection title="Security" description="How this account is protected.">
            <SettingsRow
              label="Password"
              description={
                security?.passwordChangedAt
                  ? `Last changed ${formatDate(security.passwordChangedAt)}. To change it, sign out and use “Forgot password?”.`
                  : 'Changing it from here comes later. “Forgot password?” on the sign-in screen resets it.'
              }
            />
            <SettingsRow
              label="Two-factor authentication"
              description="A second step when signing in on a new device."
              control={<Badge>{security?.twoFactorEnabled ? 'On' : 'Not yet'}</Badge>}
            />
          </SettingsSection>

          {events.length > 0 ? (
            <SettingsSection
              title="Recent activity"
              description="Sign-ins and changes to this account, newest first."
            >
              {events.map((event) => (
                <SettingsRow
                  key={event.id}
                  label={describeEvent(event.kind)}
                  description={[event.deviceName, event.location, relativeTime(event.createdAt)]
                    .filter(Boolean)
                    .join(' · ')}
                  control={event.outcome === 'failure' ? <Badge tone="danger">Failed</Badge> : null}
                />
              ))}
            </SettingsSection>
          ) : null}
        </div>
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
        open={signingOut}
        title="Sign out of Noto?"
        confirmLabel="Sign out"
        description={
          <>
            <p>
              This session ends on this device. Your documents are stored here and are not deleted.
            </p>
            <p className="mt-2">You can sign back in at any time, on this device or another.</p>
          </>
        }
        onConfirm={signOut}
        onClose={() => setSigningOut(false)}
      />
    </PageContainer>
  );
}
