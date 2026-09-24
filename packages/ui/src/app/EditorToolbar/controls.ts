import { CORE_COMMANDS } from '@noto/core';
import { type ComponentType } from 'react';

import { fieldClasses } from '../../components/field-styles';
import {
  AlignCenterIcon,
  AlignJustifyIcon,
  AlignLeftIcon,
  AlignRightIcon,
  BoldIcon,
  BulletListIcon,
  ChecklistIcon,
  type IconProps,
  ItalicIcon,
  OrderedListIcon,
  StrikethroughIcon,
  UnderlineIcon,
} from '../../components/icons';

export const COMMANDS_BY_ID = new Map(CORE_COMMANDS.map((command) => [command.id, command]));

export interface Control {
  id: string;
  icon: ComponentType<IconProps>;
}

export const MARK_CONTROLS: Control[] = [
  { id: 'format.bold', icon: BoldIcon },
  { id: 'format.italic', icon: ItalicIcon },
  { id: 'format.underline', icon: UnderlineIcon },
  { id: 'format.strike', icon: StrikethroughIcon },
];

export const LIST_CONTROLS: Control[] = [
  { id: 'format.bulletList', icon: BulletListIcon },
  { id: 'format.orderedList', icon: OrderedListIcon },
  { id: 'format.taskList', icon: ChecklistIcon },
];

/*
 * Alignment is split rather than shortened. Left and centre are what a writer
 * reaches for; right and justify are real but rare, so they wait in the
 * overflow menu instead of spending two slots on the bar.
 */
export const ALIGN_CONTROLS: Control[] = [
  { id: 'format.alignLeft', icon: AlignLeftIcon },
  { id: 'format.alignCenter', icon: AlignCenterIcon },
];

export const OVERFLOW_ALIGN_CONTROLS: Control[] = [
  { id: 'format.alignRight', icon: AlignRightIcon },
  { id: 'format.alignJustify', icon: AlignJustifyIcon },
];

/** The block types the picker offers, in the order it lists them. */
export const BLOCK_TYPES = [
  { id: 'format.paragraph', label: 'Paragraph' },
  { id: 'format.heading1', label: 'Heading 1' },
  { id: 'format.heading2', label: 'Heading 2' },
  { id: 'format.heading3', label: 'Heading 3' },
];

export const TABLE_CONTROLS = [
  { id: 'table.addRowAfter', label: 'Row +' },
  { id: 'table.addColumnAfter', label: 'Column +' },
  { id: 'table.deleteRow', label: 'Delete row' },
  { id: 'table.deleteColumn', label: 'Delete column' },
  { id: 'table.toggleHeaderRow', label: 'Header row' },
];

/* The toolbar and its prompts share the design system's field styling at the
   compact size: a 40px input here would push the controls out of line. */
export const FIELD_CLASSES = fieldClasses('sm');
