import {
  DocumentsIcon,
  MemoryIcon,
  PencilIcon,
  QuickNoteIcon,
  SearchIcon,
  type IconProps,
} from '../components/icons';
import { cn } from '../utils/cn';
import { navigate, type Route } from './router';

export interface MobileNavProps {
  route: Route;
  onQuickNote(): void;
}

interface MobileEntry {
  id: string;
  label: string;
  icon: (props: IconProps) => React.ReactElement;
  isActive(route: Route): boolean;
  onSelect(handlers: { quickNote(): void }): void;
}

/**
 * The five things worth reaching on a phone, in the order the product ranks
 * them: write something down, find something, and get to the work.
 *
 * Deliberately not the desktop sidebar in a drawer. Settings and Account are
 * reachable from the header; putting them here would spend two of five slots on
 * screens nobody opens on a phone.
 */
const ENTRIES: MobileEntry[] = [
  {
    id: 'quick-note',
    label: 'Quick Note',
    icon: QuickNoteIcon,
    isActive: () => false,
    onSelect: (handlers) => handlers.quickNote(),
  },
  {
    id: 'memory',
    label: 'Memory',
    icon: MemoryIcon,
    isActive: (route) => route.name === 'memory',
    onSelect: () => navigate('memory'),
  },
  {
    id: 'search',
    label: 'Search',
    icon: SearchIcon,
    isActive: (route) => route.name === 'search',
    onSelect: () => navigate('search'),
  },
  {
    id: 'documents',
    label: 'Documents',
    icon: DocumentsIcon,
    isActive: (route) => route.name === 'documents' || route.name === 'home',
    onSelect: () => navigate('documents'),
  },
  {
    id: 'workspace',
    label: 'Editor',
    icon: PencilIcon,
    isActive: (route) => route.name === 'workspace',
    onSelect: () => navigate('workspace'),
  },
];

export function MobileNav({ route, onQuickNote }: MobileNavProps) {
  return (
    <nav
      aria-label="Primary"
      className="noto-print-hidden border-default bg-surface flex shrink-0 items-stretch border-t"
      /* Clears the home indicator on phones that draw one. */
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {ENTRIES.map((entry) => {
        const isActive = entry.isActive(route);
        const Glyph = entry.icon;

        return (
          <button
            key={entry.id}
            type="button"
            onClick={() => entry.onSelect({ quickNote: onQuickNote })}
            aria-current={isActive ? 'page' : undefined}
            /* 44px is the smallest target a thumb can be asked to hit. */
            className={cn(
              'flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 px-1 py-2 transition-colors',
              'focus-visible:outline-brand focus-visible:outline-2 focus-visible:-outline-offset-2',
              isActive ? 'text-brand-strong' : 'text-tertiary',
            )}
          >
            <Glyph className="h-5 w-5" />
            <span className="text-caption leading-none">{entry.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
