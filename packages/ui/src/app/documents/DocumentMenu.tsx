import type { NotoDocument } from '@noto/types';

import { Dropdown, type DropdownItem } from '../../components/Dropdown';
import {
  ArchiveIcon,
  CopyIcon,
  DocumentIcon,
  ExportIcon,
  MoreIcon,
  PencilIcon,
  PinIcon,
  TrashIcon,
} from '../../components/icons';
import { cn } from '../../utils/cn';

export interface DocumentMenuProps {
  document: NotoDocument;
  onOpen(): void;
  onRename(): void;
  onDuplicate(): void;
  onTogglePin(): void;
  onArchive(): void;
  onExport(): void;
  onDelete(): void;
  /** Fades in with the row on hover, but always reachable by keyboard. */
  revealOnHover?: boolean;
  className?: string;
}

/**
 * The overflow menu on a document row or card.
 *
 * The same seven actions in the same order everywhere a document is listed, so
 * the one people use most is always in the same place under the pointer. Move
 * is deliberately absent: Noto has no folder management yet, and a menu item
 * that opens a dialog with nothing to choose is worse than one that waits.
 */
export function DocumentMenu({
  document,
  onOpen,
  onRename,
  onDuplicate,
  onTogglePin,
  onArchive,
  onExport,
  onDelete,
  revealOnHover = false,
  className,
}: DocumentMenuProps) {
  const items: DropdownItem[] = [
    { id: 'open', label: 'Open', icon: <DocumentIcon className="h-4 w-4" />, onSelect: onOpen },
    { id: 'rename', label: 'Rename', icon: <PencilIcon className="h-4 w-4" />, onSelect: onRename },
    {
      id: 'duplicate',
      label: 'Duplicate',
      icon: <CopyIcon className="h-4 w-4" />,
      onSelect: onDuplicate,
    },
    {
      id: 'pin',
      label: document.isFavorite ? 'Unpin' : 'Pin to sidebar',
      icon: <PinIcon className="h-4 w-4" />,
      onSelect: onTogglePin,
    },
    {
      id: 'export',
      label: 'Export…',
      icon: <ExportIcon className="h-4 w-4" />,
      separated: true,
      onSelect: onExport,
    },
    {
      id: 'archive',
      label: document.status === 'archived' ? 'Restore' : 'Archive',
      icon: <ArchiveIcon className="h-4 w-4" />,
      onSelect: onArchive,
    },
    {
      id: 'delete',
      label: 'Move to Trash',
      icon: <TrashIcon className="h-4 w-4" />,
      separated: true,
      danger: true,
      onSelect: onDelete,
    },
  ];

  return (
    <Dropdown
      items={items}
      label={`Actions for ${document.title || 'Untitled'}`}
      className={className}
      trigger={(props) => (
        <button
          type="button"
          {...props}
          aria-label={`Actions for ${document.title || 'Untitled'}`}
          className={cn(
            'text-tertiary hover:bg-surface hover:text-primary focus-visible:outline-brand flex h-8 w-8 items-center justify-center rounded-md transition-colors focus-visible:outline-2',
            revealOnHover &&
              'opacity-0 group-hover/card:opacity-100 group-hover/doc:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100',
          )}
        >
          <MoreIcon className="h-5 w-5" />
        </button>
      )}
    />
  );
}
