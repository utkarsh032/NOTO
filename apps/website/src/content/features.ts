/** Copy for the home page and the features page. Content, not layout. */

export interface Feature {
  title: string;
  description: string;
  /** Only shown on the features page. */
  detail?: string;
  /** Marks work that is planned rather than shipped. */
  status?: 'planned';
}

export interface FeatureGroup {
  title: string;
  summary: string;
  features: Feature[];
}

/** The three points the home page leads with. */
export const HIGHLIGHTS: Feature[] = [
  {
    title: 'Local-first',
    description:
      'Your documents are stored on your own device and stay readable with no network and no account.',
  },
  {
    title: 'One workspace everywhere',
    description:
      'The same editor, shortcuts and layout on Windows, macOS, Linux, Android, iOS and the browser.',
  },
  {
    title: 'Yours to keep',
    description:
      'Plain, portable documents in a local database you can back up, move, or walk away with.',
  },
];

export const FEATURE_GROUPS: FeatureGroup[] = [
  {
    title: 'Writing',
    summary: 'An editor that gets out of the way.',
    features: [
      {
        title: 'Rich text that stays structured',
        description: 'Headings, lists, quotes, code blocks and inline formatting.',
        detail:
          'The editor is built on ProseMirror, so a document is a real structure rather than a blob of HTML. That is what makes reliable outlines, exports and future collaboration possible.',
      },
      {
        title: 'Autosave',
        description: 'Every change is written locally moments after you stop typing.',
        detail:
          'There is no save button and no unsaved state to lose. Closing the window mid-sentence is safe.',
      },
      {
        title: 'Keyboard-first',
        description:
          'Formatting, navigation and document switching without reaching for the mouse.',
      },
    ],
  },
  {
    title: 'Organising',
    summary: 'Enough structure to find things again.',
    features: [
      {
        title: 'Workspaces and folders',
        description: 'Group documents by project, and keep unrelated work apart.',
      },
      {
        title: 'Search',
        description: 'Find a document by title or by what is written inside it.',
      },
      {
        title: 'Tabs',
        description: 'Keep several documents open and move between them.',
        status: 'planned',
      },
    ],
  },
  {
    title: 'Platforms',
    summary: 'The same Noto wherever you work.',
    features: [
      {
        title: 'Desktop applications',
        description: 'Native installers for Windows, macOS and Linux, with automatic updates.',
        detail:
          'Windows and macOS update themselves in the background. Linux updates arrive through the AppImage or your package manager.',
      },
      {
        title: 'Web application',
        description: 'Open a browser and start writing — nothing to install.',
        detail:
          'The web application stores documents in your browser using IndexedDB, so it keeps working offline once loaded.',
      },
      {
        title: 'Mobile applications',
        description: 'Android and iOS builds sharing the same document model.',
        status: 'planned',
      },
    ],
  },
  {
    title: 'Data and privacy',
    summary: 'Local by default, cloud only if you ask.',
    features: [
      {
        title: 'No account required',
        description: 'Install Noto and start writing. There is no sign-up step.',
      },
      {
        title: 'No telemetry',
        description: 'Noto does not report what you write, or that you are writing.',
      },
      {
        title: 'Optional sync',
        description: 'Cloud sync across your devices, off unless you turn it on.',
        status: 'planned',
        detail:
          'Sync is built as a layer above local storage rather than underneath it, so turning it off leaves a fully working local application rather than an empty one.',
      },
    ],
  },
];
