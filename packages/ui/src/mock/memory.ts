import type { MemoryItem, MemoryKind } from '@noto/types';

/**
 * Presentation data for Noto Memory.
 *
 * Capture — clipboard watching, screenshots, link saving — is a platform
 * service that does not exist yet, so the screens are built against this
 * fixture instead. Everything here is shaped exactly like the `MemoryItem` a
 * repository will return, and the screens read it through `useMemoryItems`, so
 * replacing this module with a real query is a one-file change.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Fixed at module load so a render never moves the timestamps under the user. */
const NOW = Date.now();

const ago = (ms: number): string => new Date(NOW - ms).toISOString();

interface Seed {
  kind: MemoryKind;
  title: string;
  content: string;
  source: string | null;
  tags: string[];
  at: number;
  isPinned?: boolean;
  sizeBytes?: number | null;
  url?: string | null;
}

const SEEDS: Seed[] = [
  {
    kind: 'note',
    title: 'Angular upload solution',
    content:
      'Use concatMap so the uploads queue instead of racing. The file input is reset in finalize(), otherwise picking the same file twice does nothing the second time.',
    source: 'Quick Note',
    tags: ['angular', 'rxjs'],
    at: 42 * MINUTE,
    isPinned: true,
  },
  {
    kind: 'clipboard',
    title: 'concatMap upload code',
    content:
      'from(files).pipe(concatMap((file) => this.api.upload(file)), finalize(() => this.input.nativeElement.value = ""))',
    source: 'VS Code',
    tags: ['snippet'],
    at: 55 * MINUTE,
  },
  {
    kind: 'screenshot',
    title: 'Angular dashboard screenshot',
    content: 'Upload progress bar, empty state and the error toast in one frame.',
    source: 'Chrome — localhost:4200',
    tags: ['ui', 'reference'],
    at: 2 * HOUR,
    sizeBytes: 486_912,
  },
  {
    kind: 'link',
    title: 'RxJS concatMap vs mergeMap',
    content:
      'rxjs.dev — the operator decision tree, with the marble diagrams that finally made it click.',
    source: 'rxjs.dev',
    url: 'https://rxjs.dev/api/operators/concatMap',
    tags: ['rxjs', 'reading'],
    at: 3 * HOUR,
    isPinned: true,
  },
  {
    kind: 'note',
    title: 'Design review — takeaways',
    content:
      'Cards keep the 12px radius. Green is for primary actions only. The sidebar stays light; a dark rail was tried and read as a different product.',
    source: 'Quick Note',
    tags: ['design', 'noto'],
    at: 5 * HOUR,
  },
  {
    kind: 'clipboard',
    title: 'Postgres connection string',
    content: 'postgres://noto:••••••@db.internal:5432/noto?sslmode=require',
    source: 'Terminal',
    tags: ['infra'],
    at: 6 * HOUR,
  },
  {
    kind: 'image',
    title: 'Colour ramp — emerald',
    content: 'The nine steps, with contrast ratios written under each.',
    source: 'Figma',
    tags: ['design', 'tokens'],
    at: 8 * HOUR,
    sizeBytes: 214_003,
  },
  {
    kind: 'file',
    title: 'Noto PRD v1.2.pdf',
    content: 'Product requirements — sections 5.3 through 5.11 are the ones that changed.',
    source: 'Downloads',
    tags: ['docs'],
    at: 26 * HOUR,
    sizeBytes: 1_842_176,
  },
  {
    kind: 'link',
    title: 'Local-first software',
    content: 'inkandswitch.com — the seven ideals. Worth rereading before the sync design review.',
    source: 'inkandswitch.com',
    url: 'https://www.inkandswitch.com/local-first/',
    tags: ['reading', 'sync'],
    at: 28 * HOUR,
  },
  {
    kind: 'clipboard',
    title: 'Release checklist',
    content: 'pnpm version:check → pnpm build → pnpm test → pnpm release:prepare → tag → publish',
    source: 'Noto',
    tags: ['release'],
    at: 30 * HOUR,
  },
  {
    kind: 'screenshot',
    title: 'Editor toolbar spacing',
    content: 'Before and after the 4px gap change, at 1280 and at 1024.',
    source: 'Noto Desktop',
    tags: ['ui'],
    at: 2 * DAY,
    sizeBytes: 351_744,
  },
  {
    kind: 'note',
    title: 'Ideas for the mobile app',
    content:
      'Bottom navigation: Quick Note, Memory, Search, Documents. The editor opens full screen with the toolbar above the keyboard.',
    source: 'Quick Note',
    tags: ['mobile', 'ideas'],
    at: 2 * DAY + 4 * HOUR,
  },
  {
    kind: 'link',
    title: 'Inter — dynamic metrics',
    content: 'rsms.me — optical sizing and the cap-height alignment trick used in the header.',
    source: 'rsms.me',
    url: 'https://rsms.me/inter/',
    tags: ['typography'],
    at: 3 * DAY,
  },
  {
    kind: 'file',
    title: 'noto-icon-set.zip',
    content: 'Exported at 16, 20 and 24 with the 1.75px stroke.',
    source: 'Downloads',
    tags: ['icons'],
    at: 3 * DAY + 2 * HOUR,
    sizeBytes: 96_512,
  },
  {
    kind: 'clipboard',
    title: 'SQL — documents by folder',
    content:
      'select f.name, count(*) from documents d join folders f on f.id = d.folder_id where d.deleted_at is null group by f.name;',
    source: 'DBeaver',
    tags: ['sql'],
    at: 4 * DAY,
  },
  {
    kind: 'note',
    title: 'Atomic Habits — chapter 3',
    content:
      'Make it obvious, make it attractive, make it easy, make it satisfying. The environment does more work than the intention.',
    source: 'Quick Note',
    tags: ['reading', 'notes'],
    at: 4 * DAY + 6 * HOUR,
  },
  {
    kind: 'image',
    title: 'Whiteboard — sync conflict cases',
    content: 'Three-way merge sketch, with the two cases that need the user asked.',
    source: 'Camera',
    tags: ['sync', 'architecture'],
    at: 5 * DAY,
    sizeBytes: 2_310_144,
  },
  {
    kind: 'screenshot',
    title: 'Dark theme — memory cards',
    content: 'Contrast check on the type badges against the dark surface.',
    source: 'Noto Desktop',
    tags: ['design', 'a11y'],
    at: 6 * DAY,
    sizeBytes: 402_432,
  },
  {
    kind: 'link',
    title: 'ProseMirror — decorations guide',
    content:
      'prosemirror.net — how the search plugin paints matches without touching the document.',
    source: 'prosemirror.net',
    url: 'https://prosemirror.net/docs/guide/#view.decorations',
    tags: ['editor'],
    at: 8 * DAY,
  },
  {
    kind: 'note',
    title: 'Weekly review — week 21',
    content: 'Shipped tabs and find/replace. Next: memory capture, then the search screen.',
    source: 'Quick Note',
    tags: ['review'],
    at: 9 * DAY,
  },
  {
    kind: 'clipboard',
    title: 'Playwright — run one spec',
    content: 'pnpm --filter @noto/web test:e2e -- workspace.spec.ts --headed',
    source: 'Terminal',
    tags: ['testing'],
    at: 11 * DAY,
  },
  {
    kind: 'file',
    title: 'meeting-notes-2024-05.md',
    content: 'Exported from Noto for the shared drive.',
    source: 'Documents',
    tags: ['meetings'],
    at: 14 * DAY,
    sizeBytes: 12_288,
  },
];

/** The workspace id is stamped by the caller; the fixture is workspace-agnostic. */
export function buildMemoryItems(workspaceId: string): MemoryItem[] {
  return SEEDS.map((seed, index) => ({
    id: `memory-${index + 1}`,
    workspaceId,
    kind: seed.kind,
    title: seed.title,
    content: seed.content,
    source: seed.source,
    url: seed.url ?? null,
    tags: seed.tags,
    isPinned: seed.isPinned ?? false,
    sizeBytes: seed.sizeBytes ?? null,
    createdAt: ago(seed.at),
    updatedAt: ago(seed.at),
    deletedAt: null,
  }));
}

/** Bytes held by the fixture, for the Memory summary card. */
export function memoryStorageBytes(items: readonly MemoryItem[]): number {
  return items.reduce((total, item) => total + (item.sizeBytes ?? item.content.length * 2), 0);
}
