import { EXCERPT_LENGTH, UNTITLED_DOCUMENT_TITLE } from '@noto/config';
import type { DocumentContent } from '@noto/types';

/** A single node of Tiptap/ProseMirror JSON, narrowed to the parts Noto reads. */
interface ContentNode {
  type?: string;
  text?: string;
  content?: ContentNode[];
}

function isContentNode(value: unknown): value is ContentNode {
  return typeof value === 'object' && value !== null;
}

/**
 * Flattens editor JSON to plain text. Block-level nodes are separated by
 * newlines so that word counts and excerpts do not run sentences together.
 */
export function plainTextFromContent(content: DocumentContent): string {
  const parts: string[] = [];

  const walk = (nodes: readonly unknown[]): void => {
    for (const node of nodes) {
      if (!isContentNode(node)) continue;

      if (typeof node.text === 'string') {
        parts.push(node.text);
      }

      if (Array.isArray(node.content)) {
        walk(node.content);
      }

      // Anything that is not an inline text node ends a block.
      if (node.type !== 'text' && node.type !== undefined) {
        parts.push('\n');
      }
    }
  };

  walk(content.content ?? []);

  return parts
    .join('')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/**
 * Builds editor JSON from plain text, one paragraph per line.
 *
 * Used by clients without a rich-text surface — currently mobile — so that a
 * document written there is still a valid document everywhere else.
 */
export function contentFromPlainText(text: string): DocumentContent {
  return {
    type: 'doc',
    content: text
      .split('\n')
      .map((line) =>
        line === ''
          ? { type: 'paragraph' }
          : { type: 'paragraph', content: [{ type: 'text', text: line }] },
      ),
  };
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed === '') return 0;
  return trimmed.split(/\s+/u).length;
}

/** Truncates on a word boundary and appends an ellipsis when text was dropped. */
export function buildExcerpt(text: string, maxLength: number = EXCERPT_LENGTH): string {
  const normalized = text.replace(/\s+/gu, ' ').trim();
  if (normalized.length <= maxLength) return normalized;

  const clipped = normalized.slice(0, maxLength);
  const lastSpace = clipped.lastIndexOf(' ');
  const base = lastSpace > maxLength * 0.6 ? clipped.slice(0, lastSpace) : clipped;

  return `${base.trimEnd()}…`;
}

/**
 * Derives a title from the document body, used when the user starts typing
 * before naming the document.
 */
export function deriveTitle(content: DocumentContent): string {
  const firstLine = plainTextFromContent(content).split('\n')[0]?.trim() ?? '';
  if (firstLine === '') return UNTITLED_DOCUMENT_TITLE;
  return buildExcerpt(firstLine, 80);
}

export function slugify(value: string): string {
  return (
    value
      .normalize('NFKD')
      // Strip the combining diacritical marks that NFKD just split off.
      .replace(/[̀-ͯ]/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/gu, '-')
      .replace(/^-+|-+$/gu, '')
      .slice(0, 80)
  );
}
