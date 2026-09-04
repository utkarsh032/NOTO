import { APP_NAME, APP_VERSION, MINIMUM_PASSWORD_LENGTH } from '@noto/config';
import { useCallback, useId, useRef, useState } from 'react';

import notoIcon from '../../assets/noto-icon.png';
import notoWordmark from '../../assets/noto-wordmark.png';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { showToast } from '../../components/toast-store';
import {
  AppleIcon,
  ArrowRightIcon,
  BoltIcon,
  CloudOffIcon,
  EyeIcon,
  EyeOffIcon,
  GithubIcon,
  GoogleIcon,
  LockIcon,
  MailIcon,
  SparklesIcon,
  type IconProps,
} from '../../components/icons';
import { cn } from '../../utils/cn';
import { navigate } from '../router';
import { TurnstileWidget, type TurnstileHandle } from '../TurnstileWidget';
import { useAccount } from '../use-account';

/**
 * Shown when the build has no cloud configured, which is a supported state
 * rather than a failure: Noto is whole signed out, and a desktop build without
 * Supabase credentials is not broken.
 */
const NOT_CONNECTED = `${APP_NAME} has no account service in this build, so nothing was signed in.`;

/** Shown when a build has no Turnstile sitekey, which the server requires. */
const SIGN_UP_UNAVAILABLE = `Creating an account is not open in this build. Sign in if you already have one.`;

type Mode = 'sign-in' | 'sign-up';

interface AccountPromise {
  icon: (props: IconProps) => React.ReactElement;
  title: string;
  body: string;
}

/**
 * What an account is actually for.
 *
 * Not features — Noto has all of them signed out. These are the three things an
 * account changes, which is the only honest reason to ask anyone for one.
 */
const PROMISES: AccountPromise[] = [
  {
    icon: CloudOffIcon,
    title: 'Your notes stay yours',
    body: 'Everything is written to this device first. An account adds a copy; it never becomes the original.',
  },
  {
    icon: BoltIcon,
    title: 'The same Noto everywhere',
    body: 'Documents, tabs and Quick Notes follow you to the desktop app, the browser and your phone.',
  },
  {
    icon: SparklesIcon,
    title: 'Memory that outlives the device',
    body: 'Clipboard history, captures and versions kept somewhere that survives a reinstall.',
  },
];

/**
 * Sign in.
 *
 * The one screen in Noto that renders without the shell around it: a sidebar
 * full of somebody's documents behind a sign-in form belongs, by definition, to
 * a person who is not signed in.
 *
 * Two panels. The left is the argument — what an account is for, and the
 * promise that it is additive rather than a gate — and it is the panel that
 * disappears first on a narrow window, because someone who came here to sign in
 * does not need to be sold to. The right is the work: three providers, an email
 * form, and — given equal weight rather than hidden underneath — the way past
 * this screen entirely. Noto is local-first, so "continue without an account"
 * is a first-class answer here and is styled like one.
 */
export function LoginScreen() {
  const [mode, setMode] = useState<Mode>('sign-in');

  return (
    <main className="bg-background flex h-full min-h-0">
      <BrandPanel />

      <div className="noto-scroll flex min-w-0 flex-1 flex-col overflow-y-auto">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-10 sm:px-10">
          {/* The mark appears on this side only when the brand panel is gone,
              so the window never shows it twice. */}
          <img
            src={notoIcon}
            alt={APP_NAME}
            draggable={false}
            className="mb-6 h-10 w-10 lg:hidden"
          />

          <h1 className="text-primary text-h1">
            {mode === 'sign-in' ? 'Welcome back' : `Create your ${APP_NAME} account`}
          </h1>
          <p className="text-secondary text-body mt-2">
            {mode === 'sign-in'
              ? 'Sign in to sync your documents, memory and settings across your devices.'
              : 'One account, every device. Your existing local documents come with you.'}
          </p>

          <ProviderButtons />

          <div className="my-6 flex items-center gap-3" aria-hidden="true">
            <span className="bg-default h-px flex-1" />
            <span className="text-tertiary text-caption">or continue with email</span>
            <span className="bg-default h-px flex-1" />
          </div>

          <CredentialsForm mode={mode} onModeChange={setMode} />

          <p className="text-secondary text-body-sm mt-6 text-center">
            {mode === 'sign-in' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button
              type="button"
              onClick={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}
              className="text-brand-strong focus-visible:outline-brand rounded-sm font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {mode === 'sign-in' ? 'Create one' : 'Sign in'}
            </button>
          </p>

          {/*
           * The escape hatch, and deliberately not a footnote. Noto works
           * signed out; a person who wants that should not have to wonder
           * whether they are allowed.
           */}
          <div className="border-default mt-8 border-t pt-6">
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => navigate('home')}
              leading={<ArrowRightIcon className="h-4 w-4" />}
            >
              Continue without an account
            </Button>
            <p className="text-tertiary text-caption mt-2.5 text-center">
              Everything works offline. You can sign in later without losing a word.
            </p>
          </div>

          <p className="text-tertiary text-caption mt-8 text-center">
            By continuing you agree to the {APP_NAME} terms and privacy policy.
          </p>
        </div>
      </div>
    </main>
  );
}

/**
 * The left half.
 *
 * A single soft brand wash rather than an illustration: the panel has to hold
 * its own at any height, and a picture that has to be cropped to fit is a
 * picture that stops meaning anything. The two blurred discs are the whole
 * decoration, and they are `aria-hidden` because they are not information.
 */
function BrandPanel() {
  return (
    <aside
      aria-label={`About ${APP_NAME}`}
      className="bg-brand-soft border-default relative hidden w-[46%] max-w-2xl shrink-0 flex-col justify-between overflow-hidden border-r p-12 lg:flex"
    >
      <span
        aria-hidden="true"
        className="bg-brand/15 pointer-events-none absolute -top-24 -left-16 h-72 w-72 rounded-full blur-3xl"
      />
      <span
        aria-hidden="true"
        className="bg-memory/15 pointer-events-none absolute -right-20 -bottom-28 h-80 w-80 rounded-full blur-3xl"
      />

      <img
        src={notoWordmark}
        alt={APP_NAME}
        draggable={false}
        className="relative h-7 w-auto self-start"
      />

      <div className="relative">
        <h2 className="text-primary text-display max-w-md">Write it down. Find it later.</h2>
        <p className="text-secondary text-body-lg mt-4 max-w-md">
          {APP_NAME} keeps your work on your own device and adds the cloud on top — never the other
          way round.
        </p>

        <ul className="mt-10 flex flex-col gap-6">
          {PROMISES.map((promise) => {
            const Glyph = promise.icon;

            return (
              <li key={promise.title} className="flex gap-4">
                <span className="bg-surface text-brand-strong border-brand-subtle flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-sm">
                  <Glyph className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-primary text-body font-semibold">{promise.title}</h3>
                  <p className="text-secondary text-body-sm mt-1 max-w-sm">{promise.body}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <p className="text-tertiary text-caption relative">
        {APP_NAME} {APP_VERSION} · Local-first, on Web, Desktop and Mobile
      </p>
    </aside>
  );
}

/** The three providers, given one row so none of them looks like the default. */
function ProviderButtons() {
  const providers = [
    { id: 'google', label: 'Google', icon: <GoogleIcon className="h-4.5 w-4.5" /> },
    { id: 'apple', label: 'Apple', icon: <AppleIcon className="h-4.5 w-4.5" /> },
    { id: 'github', label: 'GitHub', icon: <GithubIcon className="h-4.5 w-4.5" /> },
  ];

  return (
    <div className="mt-8 grid grid-cols-3 gap-3">
      {providers.map((provider) => (
        <button
          key={provider.id}
          type="button"
          onClick={() => showToast(NOT_CONNECTED)}
          aria-label={`Continue with ${provider.label}`}
          className={cn(
            'border-default bg-surface text-primary text-body-sm flex h-11 items-center justify-center gap-2 rounded-md border font-medium',
            'hover:border-strong hover:bg-surface-secondary active:bg-surface-tertiary transition-colors',
            'focus-visible:outline-brand focus-visible:outline-2 focus-visible:outline-offset-2',
          )}
        >
          {provider.icon}
          <span className="hidden sm:inline">{provider.label}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * The email form.
 *
 * It validates on submit rather than on every keystroke: a message that appears
 * under a field while it is still being typed into is telling somebody they are
 * wrong before they have finished being right.
 */
function CredentialsForm({
  mode,
  onModeChange,
}: {
  mode: Mode;
  /** A completed sign-up sends the person back to sign-in, once confirmed. */
  onModeChange: (mode: Mode) => void;
}) {
  const passwordId = useId();
  const { signIn, signUp, resendConfirmation, turnstileSiteKey } = useAccount();

  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  // Set when a sign-in failed only because the address is unconfirmed, which
  // is the one failure the person can act on without changing anything.
  const [unconfirmed, setUnconfirmed] = useState(false);
  const turnstile = useRef<TurnstileHandle | null>(null);

  // Stable, so the widget is not torn down and re-rendered on every keystroke.
  const onToken = useCallback((token: string | null) => setTurnstileToken(token), []);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; name?: string }>({});

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    const next: typeof errors = {};
    if (mode === 'sign-up' && name.trim() === '') next.name = 'Tell us what to call you.';
    /* Deliberately loose. The address is confirmed by mail, not by a regex. */
    if (!/^\S+@\S+\.\S+$/.test(email.trim()))
      next.email = 'That does not look like an email address.';
    if (password.length < MINIMUM_PASSWORD_LENGTH)
      next.password = `Passwords are at least ${MINIMUM_PASSWORD_LENGTH} characters.`;

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    if (mode === 'sign-up') {
      if (!signUp) {
        showToast(SIGN_UP_UNAVAILABLE);

        return;
      }

      if (!turnstileToken) {
        showToast('Finish the bot check first.');

        return;
      }

      setSubmitting(true);
      const created = await signUp({
        email: email.trim(),
        password,
        displayName: name.trim(),
        turnstileToken,
      });
      setSubmitting(false);

      // The token is spent either way — Cloudflare redeems it once — so the
      // widget is reset before any second attempt.
      turnstile.current?.reset();

      if (created.ok) {
        showToast(
          created.confirmationRequired
            ? 'Account created. Check your email to confirm the address.'
            : 'Account created. You can sign in now.',
        );
        onModeChange('sign-in');

        return;
      }

      if (created.fields) {
        setErrors({
          ...(created.fields.email === undefined ? {} : { email: created.fields.email }),
          ...(created.fields.password === undefined ? {} : { password: created.fields.password }),
          ...(created.fields.displayName === undefined ? {} : { name: created.fields.displayName }),
        });
      }

      showToast(created.message ?? 'That did not work. Try again.');

      return;
    }

    if (!signIn) {
      showToast(NOT_CONNECTED);
      return;
    }

    setSubmitting(true);
    const result = await signIn(email.trim(), password);
    setSubmitting(false);

    if (result.ok) {
      setUnconfirmed(false);
      navigate('home');

      return;
    }

    setUnconfirmed(result.message?.startsWith('Confirm your email address') === true);

    /*
     * The message comes from the server and is shown as it arrives. It says the
     * same thing for an unknown address and a wrong password, which is
     * deliberate on that side and must not be second-guessed on this one.
     */
    showToast(result.message ?? 'That did not work. Try again.');
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {mode === 'sign-up' ? (
        <Input
          label="Name"
          value={name}
          autoComplete="name"
          placeholder="Aman Kumar"
          invalid={Boolean(errors.name)}
          hint={errors.name}
          onChange={(event) => setName(event.target.value)}
        />
      ) : null}

      <Input
        label="Email"
        type="email"
        value={email}
        autoComplete="email"
        placeholder="you@example.com"
        leading={<MailIcon className="h-4 w-4" />}
        invalid={Boolean(errors.email)}
        hint={errors.email}
        onChange={(event) => setEmail(event.target.value)}
      />

      <div>
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor={passwordId} className="text-primary text-body-sm font-medium">
            Password
          </label>
          {mode === 'sign-in' ? (
            <button
              type="button"
              onClick={() => showToast(NOT_CONNECTED)}
              className="text-brand-strong text-caption focus-visible:outline-brand rounded-sm font-medium hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Forgot password?
            </button>
          ) : null}
        </div>

        <div className="relative mt-1.5">
          <Input
            id={passwordId}
            type={revealed ? 'text' : 'password'}
            value={password}
            autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
            placeholder={
              mode === 'sign-in'
                ? 'Your password'
                : `At least ${MINIMUM_PASSWORD_LENGTH} characters`
            }
            leading={<LockIcon className="h-4 w-4" />}
            invalid={Boolean(errors.password)}
            hint={errors.password}
            className="pr-11"
            onChange={(event) => setPassword(event.target.value)}
          />

          {/*
           * Positioned against the field rather than the group, so the hint
           * line under it does not drag the button down with it.
           */}
          <button
            type="button"
            onClick={() => setRevealed((current) => !current)}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            aria-pressed={revealed}
            className="text-tertiary hover:text-primary focus-visible:outline-brand absolute top-0 right-0 flex h-10 w-10 items-center justify-center rounded-md transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2"
          >
            {revealed ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {mode === 'sign-up' && turnstileSiteKey ? (
        <TurnstileWidget
          siteKey={turnstileSiteKey}
          action="signup"
          onToken={onToken}
          handleRef={turnstile}
        />
      ) : null}

      {unconfirmed && resendConfirmation ? (
        <p className="text-secondary text-caption">
          Nothing in your inbox?{' '}
          <button
            type="button"
            onClick={() => {
              void resendConfirmation(email.trim());
              showToast('Sent. Check your inbox, and your spam folder.');
            }}
            className="text-brand-strong focus-visible:outline-brand rounded-sm font-medium hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Send the confirmation email again
          </button>
        </p>
      ) : null}

      <Button type="submit" variant="primary" loading={submitting} className="mt-1 h-11 w-full">
        {mode === 'sign-in' ? 'Sign in' : 'Create account'}
      </Button>
    </form>
  );
}
