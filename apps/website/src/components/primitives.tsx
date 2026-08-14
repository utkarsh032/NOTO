/**
 * The small set of building blocks the website pages share.
 *
 * These are deliberately local rather than imported from `@noto/ui`: that
 * package is the application's design system and pulls in the editor, the store
 * and the storage layer with it. The website is a static marketing site and has
 * no business shipping any of that to a visitor who only wants a download link.
 * It shares the design *tokens*, which is where the visual consistency lives.
 */

import type { ReactNode } from 'react';

import { Link } from '../router';

function classes(...values: (string | false | undefined)[]): string {
  return values.filter(Boolean).join(' ');
}

// ── Layout ───────────────────────────────────────────────────────────────────

export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={classes('mx-auto w-full max-w-5xl px-5 sm:px-8', className)}>{children}</div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  lead,
}: {
  eyebrow?: string;
  title: string;
  lead?: ReactNode;
}) {
  return (
    <header className="border-border-subtle bg-surface-sunken border-b py-14 sm:py-20">
      <Container>
        {eyebrow ? (
          <p className="text-accent mb-3 text-sm font-medium tracking-wide uppercase">{eyebrow}</p>
        ) : null}
        <h1 className="text-content text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        {lead ? <p className="text-muted mt-4 max-w-2xl text-lg">{lead}</p> : null}
      </Container>
    </header>
  );
}

export function Section({
  title,
  description,
  children,
  id,
}: {
  title?: string;
  description?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="py-12 sm:py-16">
      <Container>
        {title ? (
          <h2 className="text-content text-xl font-semibold tracking-tight sm:text-2xl">{title}</h2>
        ) : null}
        {description ? <p className="text-muted mt-2 max-w-2xl">{description}</p> : null}
        <div className={title || description ? 'mt-8' : undefined}>{children}</div>
      </Container>
    </section>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={classes(
        'border-border-subtle bg-surface-raised rounded-lg border p-5 shadow-sm',
        className,
      )}
    >
      {children}
    </div>
  );
}

// ── Actions ──────────────────────────────────────────────────────────────────

type ButtonTone = 'primary' | 'secondary';

const TONE: Record<ButtonTone, string> = {
  primary: 'bg-accent text-accent-content hover:bg-accent-hover',
  secondary: 'border border-border-strong bg-surface-raised text-content hover:bg-surface-sunken',
};

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 rounded-md px-5 py-2.5 text-sm font-medium ' +
  'transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

export function ButtonLink({
  href,
  tone = 'primary',
  className,
  children,
  download,
}: {
  href: string;
  tone?: ButtonTone;
  className?: string;
  children: ReactNode;
  download?: boolean;
}) {
  // A download URL points at GitHub's release CDN, so it must be a plain anchor
  // rather than a client-side navigation.
  if (download || !href.startsWith('/')) {
    return (
      <a
        href={href}
        className={classes(BUTTON_BASE, TONE[tone], className)}
        {...(download ? {} : { target: '_blank', rel: 'noreferrer noopener' })}
      >
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={classes(BUTTON_BASE, TONE[tone], className)}>
      {children}
    </Link>
  );
}

// ── Content ──────────────────────────────────────────────────────────────────

export function Prose({ children }: { children: ReactNode }) {
  return (
    <div
      className={classes(
        'text-muted max-w-2xl space-y-4',
        '[&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2',
        '[&_code]:bg-surface-sunken [&_code]:rounded [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-sm',
        '[&_h3]:text-content [&_h3]:pt-2 [&_h3]:text-base [&_h3]:font-semibold',
        '[&_strong]:text-content [&_li]:ml-5 [&_li]:list-disc [&_strong]:font-semibold',
      )}
    >
      {children}
    </div>
  );
}

export function DefinitionTable({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="divide-border-subtle divide-y">
      {rows.map((row) => (
        <div key={row.label} className="grid gap-1 py-3 sm:grid-cols-3 sm:gap-4">
          <dt className="text-content text-sm font-medium">{row.label}</dt>
          <dd className="text-muted text-sm sm:col-span-2">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'accent';
}) {
  return (
    <span
      className={classes(
        'inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium',
        // Filled rather than tinted: `accent-subtle` is a dark blue in the dark
        // theme and would not carry accent-coloured text legibly.
        tone === 'accent' ? 'bg-accent text-accent-content' : 'bg-surface-sunken text-muted',
      )}
    >
      {children}
    </span>
  );
}
