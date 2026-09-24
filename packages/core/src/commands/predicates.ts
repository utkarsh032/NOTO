import type { CommandContext } from './types.ts';

/** When a command applies. Shared by every group of definitions. */
export const requiresDocument = (context: CommandContext): boolean => context.hasActiveDocument;
export const requiresEditable = (context: CommandContext): boolean =>
  context.hasActiveDocument && context.isEditable;
export const requiresTable = (context: CommandContext): boolean =>
  requiresEditable(context) && context.isInTable === true;
