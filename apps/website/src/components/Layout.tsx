import { GITHUB_URL } from '@noto/config';
import type { ReactNode } from 'react';
import { useState } from 'react';

import { BUILD_ENV, BUILD_VERSION, IS_PREVIEW, WEB_APP_URL } from '../env';
import { useTheme } from '../hooks/use-theme';
import { Link } from '../router';
import { useRouter } from '../router-context';
import { Container } from './primitives';

const NAV = [
  { href: '/features', label: 'Features' },
  { href: '/download', label: 'Download' },
  { href: '/docs', label: 'Documentation' },
  { href: '/changelog', label: 'Changelog' },
  { href: '/faq', label: 'FAQ' },
];

const FOOTER_GROUPS = [
  {
    title: 'Product',
    links: [
      { href: '/features', label: 'Features' },
      { href: '/download', label: 'Download' },
      { href: '/requirements', label: 'System requirements' },
      { href: WEB_APP_URL, label: 'Open the web app' },
    ],
  },
  {
    title: 'Releases',
    links: [
      { href: '/changelog', label: 'Changelog' },
      { href: '/releases', label: 'Release notes' },
      { href: `${GITHUB_URL}/releases`, label: 'All releases' },
    ],
  },
  {
    title: 'Project',
    links: [
      { href: '/docs', label: 'Documentation' },
      { href: '/about', label: 'About' },
      { href: '/faq', label: 'FAQ' },
      { href: GITHUB_URL, label: 'Source on GitHub' },
    ],
  },
];

function ThemeToggle() {
  const { theme, toggle } = useTheme();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to the ${theme === 'dark' ? 'light' : 'dark'} theme`}
      className="border-default text-secondary hover:bg-surface-secondary hover:text-primary focus-visible:outline-brand rounded-md border px-2.5 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      {theme === 'dark' ? 'Light' : 'Dark'}
    </button>
  );
}

function Header() {
  const { path } = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <header className="border-default bg-background/90 sticky top-0 z-20 border-b backdrop-blur">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Link href="/" className="text-primary text-lg font-semibold tracking-tight">
          Noto
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={path === item.href ? 'page' : undefined}
              className={`hover:bg-surface-secondary rounded-md px-3 py-2 text-sm transition-colors ${
                path === item.href ? 'text-primary font-medium' : 'text-secondary'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <a
            href={WEB_APP_URL}
            className="bg-brand text-on-brand hover:bg-brand-hover hidden rounded-md px-4 py-2 text-sm font-medium transition-colors sm:inline-flex"
          >
            Open Noto
          </a>
          <button
            type="button"
            className="border-default text-secondary rounded-md border px-2.5 py-1.5 text-sm md:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((value) => !value)}
          >
            Menu
          </button>
        </div>
      </Container>

      {open ? (
        <nav id="mobile-nav" className="border-default border-t md:hidden" aria-label="Primary">
          <Container className="flex flex-col py-2">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="text-secondary hover:bg-surface-secondary rounded-md px-2 py-2.5 text-sm"
              >
                {item.label}
              </Link>
            ))}
          </Container>
        </nav>
      ) : null}
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-default bg-surface-secondary mt-auto border-t py-12">
      <Container>
        <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <p className="text-primary text-base font-semibold">Noto</p>
            <p className="text-secondary mt-2 max-w-xs text-sm">
              Your notes. Your workspace. Local-first, on every platform you use.
            </p>
          </div>

          {FOOTER_GROUPS.map((group) => (
            <div key={group.title}>
              <p className="text-primary text-sm font-semibold">{group.title}</p>
              <ul className="mt-3 space-y-2">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-secondary hover:text-primary text-sm">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-default text-tertiary mt-10 flex flex-col gap-2 border-t pt-6 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Noto. Documents stay on your device.</p>
          <p>
            Website build {BUILD_VERSION}
            {IS_PREVIEW ? ` · ${BUILD_ENV}` : ''}
          </p>
        </div>
      </Container>
    </footer>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      {/* Non-production deployments say so, so a staging URL is never mistaken
          for the real download page. */}
      {IS_PREVIEW ? (
        <p className="bg-warning text-on-warning text-caption px-4 py-1.5 text-center font-medium">
          This is the {BUILD_ENV} deployment of the Noto website. Downloads here may not be released
          yet.
        </p>
      ) : null}

      <a
        href="#main"
        className="focus:bg-brand focus:text-on-brand sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-30 focus:rounded-md focus:px-4 focus:py-2"
      >
        Skip to content
      </a>

      <Header />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}
