export interface FaqEntry {
  question: string;
  answer: string;
}

export interface FaqSection {
  title: string;
  entries: FaqEntry[];
}

export const FAQ: FaqSection[] = [
  {
    title: 'Getting started',
    entries: [
      {
        question: 'Do I need an account?',
        answer:
          'No. Noto works fully offline and has no sign-up step. An account only becomes relevant if cloud sync is added later, and it will stay optional.',
      },
      {
        question: 'What does Noto cost?',
        answer:
          'Nothing. Downloads are published on GitHub Releases and the web application is free to use.',
      },
      {
        question: 'Should I use the desktop app or the web app?',
        answer:
          'The web application is the quickest way to try Noto — open it and start writing. The desktop applications add native file handling, faster local storage and automatic updates, so they are the better long-term home for real work.',
      },
    ],
  },
  {
    title: 'Your documents',
    entries: [
      {
        question: 'Where are my documents stored?',
        answer:
          'On your own device. The desktop applications use a SQLite database in your user data directory, the web application uses IndexedDB in your browser, and mobile uses SQLite on the device.',
      },
      {
        question: 'Does Noto send my writing anywhere?',
        answer:
          'No. There is no telemetry and no server that receives document content. The only network requests Noto makes are update checks.',
      },
      {
        question: 'What happens to browser documents if I clear my browsing data?',
        answer:
          'They are deleted along with everything else the browser stored for the site. If your documents matter, use a desktop application, or keep a backup.',
      },
    ],
  },
  {
    title: 'Installing and updating',
    entries: [
      {
        question: 'Why does Windows warn me about the installer?',
        answer:
          'Until an installer has built up reputation with Microsoft SmartScreen, Windows warns about it. Choose “More info”, then “Run anyway”. The checksums published with each release let you confirm you have the file that was built.',
      },
      {
        question: 'How do updates work?',
        answer:
          'Windows and macOS check for a new version on startup, download it in the background, and apply it the next time you restart Noto. On Linux, replace the AppImage or install the new package through your package manager.',
      },
      {
        question: 'Can I get releases earlier?',
        answer:
          'Beta builds are published as prereleases on GitHub. They are opt-in, and they are less tested than stable by design.',
      },
      {
        question: 'Which Linux package should I choose?',
        answer:
          'The AppImage runs on any distribution without installing anything. Choose the .deb on Debian or Ubuntu, or the .rpm on Fedora or RHEL, if you would rather manage Noto through your package manager.',
      },
    ],
  },
  {
    title: 'The project',
    entries: [
      {
        question: 'Is Noto open source?',
        answer:
          'The source is published on GitHub. Check the licence in the repository for what you may do with it.',
      },
      {
        question: 'How do I report a bug?',
        answer:
          'Open an issue on GitHub. Include your platform, the Noto version and the steps that reproduce the problem — the issue template asks for exactly this.',
      },
    ],
  },
];
