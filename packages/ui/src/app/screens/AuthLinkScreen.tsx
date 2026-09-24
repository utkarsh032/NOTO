import { APP_NAME, MINIMUM_PASSWORD_LENGTH } from '@noto/config';
import { useEffect, useState } from 'react';

import notoIcon from '../../assets/noto-icon.png';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { CheckCircleIcon, InfoIcon, LockIcon } from '../../components/icons';
import type { AccountSignInResult } from '../account-context';
import { parseAuthLink } from '../auth-link';
import { navigate } from '../router';
import { useAccount } from '../use-account';
import { useRoute } from '../use-route';

/**
 * Where the links in Noto's emails land.
 *
 * `apps/api` sends two: `#/auth/verify?token=…` to confirm an address, and
 * `#/auth/reset?token=…` to set a new password. Both were Supabase's hosted
 * pages before; now they are this screen, rendered without the shell for the
 * same reason sign-in is — it is about the account, not the work.
 */

/*
 * A token is single-use, and React runs a mount effect twice in development.
 * Spending the same token twice would report the second, failed attempt — so
 * each token is sent once, and the answer shared.
 */
const verifications = new Map<string, Promise<AccountSignInResult>>();

function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="bg-background noto-scroll flex h-full min-h-0 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-10 sm:px-10">
        <img src={notoIcon} alt={APP_NAME} draggable={false} className="mb-6 h-10 w-10" />
        <h1 className="text-primary text-h1">{title}</h1>
        <div className="mt-4 flex flex-col gap-4">{children}</div>
      </div>
    </main>
  );
}

function Note({ tone, children }: { tone: 'info' | 'success'; children: React.ReactNode }) {
  const Glyph = tone === 'success' ? CheckCircleIcon : InfoIcon;

  return (
    <div className="border-default bg-surface-secondary text-secondary text-body-sm flex items-start gap-2.5 rounded-xl border px-4 py-3">
      <Glyph
        className={`mt-0.5 h-4 w-4 shrink-0 ${tone === 'success' ? 'text-success' : 'text-tertiary'}`}
      />
      <p>{children}</p>
    </div>
  );
}

function VerifyEmail({ token }: { token: string }) {
  const { verifyEmail } = useAccount();
  const [result, setResult] = useState<AccountSignInResult | null>(null);

  useEffect(() => {
    if (!verifyEmail) return;

    let cancelled = false;
    let pending = verifications.get(token);
    if (!pending) {
      pending = verifyEmail(token);
      verifications.set(token, pending);
    }

    void pending.then((outcome) => {
      if (!cancelled) setResult(outcome);
    });

    return () => {
      cancelled = true;
    };
  }, [token, verifyEmail]);

  if (!verifyEmail) {
    return (
      <Frame title="Confirm your email">
        <Note tone="info">
          This build of {APP_NAME} has no account service, so the address cannot be confirmed here.
          Open the link in the web app instead.
        </Note>
      </Frame>
    );
  }

  if (!result) {
    return (
      <Frame title="Confirming your email…">
        <p className="text-secondary text-body">One moment.</p>
      </Frame>
    );
  }

  if (!result.ok) {
    return (
      <Frame title="That link did not work">
        <Note tone="info">
          {result.message ?? 'The link may have expired or been used already.'} Sign in and ask for
          a new confirmation email.
        </Note>
        <Button variant="primary" className="h-11 w-full" onClick={() => navigate('login')}>
          Go to sign in
        </Button>
      </Frame>
    );
  }

  return (
    <Frame title="Email confirmed">
      <Note tone="success">Your address is confirmed. You can sign in now.</Note>
      <Button variant="primary" className="h-11 w-full" onClick={() => navigate('login')}>
        Sign in
      </Button>
    </Frame>
  );
}

function ResetPassword({ token }: { token: string }) {
  const { resetPassword } = useAccount();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!resetPassword) {
    return (
      <Frame title="Set a new password">
        <Note tone="info">
          This build of {APP_NAME} has no account service, so the password cannot be reset here.
          Open the link in the web app instead.
        </Note>
      </Frame>
    );
  }

  if (done) {
    return (
      <Frame title="Password changed">
        <Note tone="success">
          Your new password is set. Every device that was signed in has been signed out, so sign in
          again with the new one.
        </Note>
        <Button variant="primary" className="h-11 w-full" onClick={() => navigate('login')}>
          Sign in
        </Button>
      </Frame>
    );
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    const next: typeof errors = {};
    if (password.length < MINIMUM_PASSWORD_LENGTH) {
      next.password = `Passwords are at least ${MINIMUM_PASSWORD_LENGTH} characters.`;
    }
    if (confirm !== password) next.confirm = 'The two passwords are different.';

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    const outcome = await resetPassword(token, password);
    setSubmitting(false);

    if (outcome.ok) {
      setDone(true);

      return;
    }

    if (outcome.fields?.newPassword) setErrors({ password: outcome.fields.newPassword });
    setFailure(outcome.message ?? 'That did not work. The link may have expired.');
  };

  return (
    <Frame title="Set a new password">
      {failure ? <Note tone="info">{failure}</Note> : null}

      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Input
          label="New password"
          type="password"
          value={password}
          autoComplete="new-password"
          placeholder={`At least ${MINIMUM_PASSWORD_LENGTH} characters`}
          leading={<LockIcon className="h-4 w-4" />}
          invalid={Boolean(errors.password)}
          hint={errors.password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <Input
          label="Type it again"
          type="password"
          value={confirm}
          autoComplete="new-password"
          leading={<LockIcon className="h-4 w-4" />}
          invalid={Boolean(errors.confirm)}
          hint={errors.confirm}
          onChange={(event) => setConfirm(event.target.value)}
        />
        <Button type="submit" variant="primary" loading={submitting} className="mt-1 h-11 w-full">
          Set password
        </Button>
      </form>
    </Frame>
  );
}

export function AuthLinkScreen() {
  const route = useRoute();
  const { kind, token } = parseAuthLink(route.param);

  if (!kind || !token) {
    return (
      <Frame title="That link is incomplete">
        <Note tone="info">
          Part of the link seems to be missing. Open it again from the email, or copy the whole
          address into the browser.
        </Note>
        <Button variant="secondary" className="h-11 w-full" onClick={() => navigate('home')}>
          Open {APP_NAME}
        </Button>
      </Frame>
    );
  }

  return kind === 'verify' ? <VerifyEmail token={token} /> : <ResetPassword token={token} />;
}
