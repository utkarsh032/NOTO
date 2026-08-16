import { GITHUB_URL } from '@noto/config';

/**
 * The documentation page is an index, not a home for the documentation itself.
 * The docs live in the repository next to the code they describe, which is the
 * only way they stay accurate; duplicating them here would guarantee drift.
 */

const DOCS_ROOT = `${GITHUB_URL}/blob/main/docs`;

export interface DocLink {
  title: string;
  description: string;
  href: string;
}

export interface DocSection {
  title: string;
  description: string;
  links: DocLink[];
}

export const DOC_SECTIONS: DocSection[] = [
  {
    title: 'Using Noto',
    description: 'Getting started, and what to expect from each platform.',
    links: [
      {
        title: 'Install Noto',
        description: 'Pick the right package for your platform and get it running.',
        href: '/download',
      },
      {
        title: 'System requirements',
        description: 'What Noto needs on Windows, macOS, Linux and the web.',
        href: '/requirements',
      },
      {
        title: 'Frequently asked questions',
        description: 'Storage, privacy, updates, and where your documents actually live.',
        href: '/faq',
      },
    ],
  },
  {
    title: 'Architecture',
    description: 'How Noto is put together, and why.',
    links: [
      {
        title: 'Overview',
        description: 'The monorepo, the shared packages, and how the platforms use them.',
        href: `${DOCS_ROOT}/architecture/overview.md`,
      },
      {
        title: 'Storage',
        description: 'The storage contract, and the adapters behind it on each platform.',
        href: `${DOCS_ROOT}/architecture/storage.md`,
      },
    ],
  },
  {
    title: 'Development',
    description: 'For anyone building Noto rather than using it.',
    links: [
      {
        title: 'Getting started',
        description: 'Prerequisites, installing, and running each application locally.',
        href: `${DOCS_ROOT}/development/getting-started.md`,
      },
      {
        title: 'Branching and workflow',
        description: 'How work moves from a feature branch to a release.',
        href: `${DOCS_ROOT}/development/branching.md`,
      },
      {
        title: 'Continuous integration',
        description: 'What runs on a pull request, and what runs on a tag.',
        href: `${DOCS_ROOT}/development/continuous-integration.md`,
      },
    ],
  },
  {
    title: 'Releases and deployment',
    description: 'How a version becomes a download.',
    links: [
      {
        title: 'Cutting a release',
        description: 'Versioning, tagging, and what the pipeline does with the tag.',
        href: `${DOCS_ROOT}/releases/README.md`,
      },
      {
        title: 'Update channels',
        description: 'Stable, beta and nightly, and how the desktop applications update.',
        href: `${DOCS_ROOT}/releases/update-channels.md`,
      },
      {
        title: 'Website and web app deployment',
        description: 'Cloudflare Workers, staging and production.',
        href: `${DOCS_ROOT}/deployment/website.md`,
      },
      {
        title: 'Code signing',
        description: 'Windows Authenticode, Apple signing and notarization.',
        href: `${DOCS_ROOT}/deployment/code-signing.md`,
      },
    ],
  },
];
