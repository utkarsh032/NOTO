import type { MemoryKind } from '@noto/types';
import type { ReactNode } from 'react';

import type { BadgeTone } from '../../components/Badge';
import {
  CameraIcon,
  ClipboardIcon,
  ExternalLinkIcon,
  FileIcon,
  ImageIcon,
  QuickNoteIcon,
} from '../../components/icons';

export interface MemoryKindInfo {
  id: MemoryKind;
  label: string;
  /** Plural, for filters and counts. */
  plural: string;
  tone: BadgeTone;
  icon(className: string): ReactNode;
  /** The tint on the card's type glyph. Subtle: the card stays white. */
  glyphClassName: string;
}

/**
 * The six kinds of thing Noto Memory holds.
 *
 * Each gets one colour, used on the badge and the glyph and nowhere else. The
 * card itself stays white — a wall of tinted cards is a wall you cannot scan,
 * and the colour is here to answer "what kind of thing is this" in the corner
 * of the eye, not to decorate.
 */
export const MEMORY_KINDS: Record<MemoryKind, MemoryKindInfo> = {
  note: {
    id: 'note',
    label: 'Note',
    plural: 'Notes',
    tone: 'brand',
    icon: (className) => <QuickNoteIcon className={className} />,
    glyphClassName: 'bg-brand-soft text-brand-hover',
  },
  clipboard: {
    id: 'clipboard',
    label: 'Clipboard',
    plural: 'Clipboard',
    tone: 'info',
    icon: (className) => <ClipboardIcon className={className} />,
    glyphClassName: 'bg-info/10 text-info',
  },
  screenshot: {
    id: 'screenshot',
    label: 'Screenshot',
    plural: 'Screenshots',
    tone: 'ai',
    icon: (className) => <CameraIcon className={className} />,
    glyphClassName: 'bg-ai-soft text-ai',
  },
  image: {
    id: 'image',
    label: 'Image',
    plural: 'Images',
    tone: 'capture',
    icon: (className) => <ImageIcon className={className} />,
    glyphClassName: 'bg-capture/10 text-capture',
  },
  link: {
    id: 'link',
    label: 'Link',
    plural: 'Links',
    tone: 'memory',
    icon: (className) => <ExternalLinkIcon className={className} />,
    glyphClassName: 'bg-memory/10 text-memory',
  },
  file: {
    id: 'file',
    label: 'File',
    plural: 'Files',
    tone: 'warning',
    icon: (className) => <FileIcon className={className} />,
    glyphClassName: 'bg-warning/10 text-warning',
  },
};

/** The order the filters list them in, which is also the order of the tabs. */
export const MEMORY_KIND_ORDER: MemoryKind[] = [
  'note',
  'clipboard',
  'screenshot',
  'image',
  'link',
  'file',
];
