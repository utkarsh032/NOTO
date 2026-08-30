import { showToast } from '../../components/toast-store';
import {
  CameraIcon,
  ClipboardIcon,
  CloseIcon,
  HistoryIcon,
  QuickNoteIcon,
  SearchIcon,
  SparklesIcon,
  type IconProps,
} from '../../components/icons';
import { cn } from '../../utils/cn';
import { navigate } from '../router';

export interface SmartSidebarProps {
  open: boolean;
  onClose(): void;
  onQuickNote(): void;
  onQuickPaste(): void;
  onSearch(): void;
  onAskAI(): void;
}

interface Entry {
  id: string;
  label: string;
  icon: (props: IconProps) => React.ReactElement;
  onSelect(handlers: SmartSidebarProps): void;
}

/**
 * The seven things worth reaching without leaving what you are doing.
 *
 * Capture is listed and says what it needs, rather than being hidden: the rail
 * is meant to be learned by position, and an entry that appears later would
 * move everything under it.
 */
const ENTRIES: Entry[] = [
  { id: 'search', label: 'Search', icon: SearchIcon, onSelect: (props) => props.onSearch() },
  { id: 'note', label: 'Note', icon: QuickNoteIcon, onSelect: (props) => props.onQuickNote() },
  {
    id: 'clipboard',
    label: 'Clipboard',
    icon: ClipboardIcon,
    onSelect: (props) => {
      props.onClose();
      navigate({ name: 'memory', param: 'clipboard' });
    },
  },
  { id: 'paste', label: 'Paste', icon: ClipboardIcon, onSelect: (props) => props.onQuickPaste() },
  {
    id: 'capture',
    label: 'Capture',
    icon: CameraIcon,
    onSelect: () => showToast('Screen capture arrives with the desktop background service.'),
  },
  { id: 'ai', label: 'AI', icon: SparklesIcon, onSelect: (props) => props.onAskAI() },
  {
    id: 'recent',
    label: 'Recent',
    icon: HistoryIcon,
    onSelect: (props) => {
      props.onClose();
      navigate('documents');
    },
  },
];

/**
 * The Smart Sidebar.
 *
 * A narrow rail pinned to the edge of the screen — 72px, the same width as the
 * collapsed application sidebar, so the two read as the same product — holding
 * the handful of things worth doing while another application has the screen.
 *
 * Desktop-only, and hidden below large widths: a rail over a phone screen is
 * just a screen with less room on it.
 */
export function SmartSidebar(props: SmartSidebarProps) {
  if (!props.open) return null;

  return (
    <aside
      aria-label="Smart Sidebar"
      className="noto-print-hidden border-default bg-surface fixed top-1/2 right-0 z-40 hidden -translate-y-1/2 flex-col gap-1 rounded-l-2xl border border-r-0 py-3 pr-2 pl-2 shadow-[var(--noto-shadow-lg)] lg:flex"
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.stopPropagation();
        props.onClose();
      }}
    >
      {ENTRIES.map((entry) => {
        const Glyph = entry.icon;

        return (
          <button
            key={entry.id}
            type="button"
            onClick={() => entry.onSelect(props)}
            className={cn(
              'flex h-14 w-14 flex-col items-center justify-center gap-1 rounded-lg transition-colors',
              'text-tertiary hover:bg-surface-secondary hover:text-primary',
              'focus-visible:outline-brand focus-visible:outline-2 focus-visible:-outline-offset-2',
            )}
          >
            <Glyph className="h-5 w-5" />
            <span className="text-caption leading-none">{entry.label}</span>
          </button>
        );
      })}

      <span className="bg-default mx-2 my-1 h-px" aria-hidden="true" />

      <button
        type="button"
        onClick={props.onClose}
        aria-label="Close Smart Sidebar"
        className="text-tertiary hover:bg-surface-secondary hover:text-primary focus-visible:outline-brand flex h-9 w-14 items-center justify-center rounded-lg transition-colors focus-visible:outline-2"
      >
        <CloseIcon className="h-4 w-4" />
      </button>
    </aside>
  );
}
