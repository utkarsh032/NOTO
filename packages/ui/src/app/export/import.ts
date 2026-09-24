import { htmlToContent } from '@noto/editor';
import type { DocumentContent } from '@noto/types';

import type { Node } from './node';

/* -------------------------------------------------------------------------- */
/* Import                                                                     */
/* -------------------------------------------------------------------------- */

export interface ImportedDocument {
  title: string;
  content: DocumentContent;
}

/** What a file picker should accept, and what each one turns into. */
export const IMPORT_ACCEPT = '.txt,.md,.markdown,.json,.html,.htm';

/**
 * Reads a file into a document.
 *
 * Markdown is parsed structurally — headings, lists, quotes and fenced code
 * become real nodes — because importing a document as one long paragraph is
 * indistinguishable from losing it. Anything unrecognised falls back to plain
 * text, which is always better than refusing the file.
 */
export function parseImportedFile(name: string, text: string): ImportedDocument {
  const extension = name.split('.').pop()?.toLowerCase() ?? '';
  const stem = name.replace(/\.[^.]+$/, '');

  if (extension === 'json') {
    try {
      const parsed: unknown = JSON.parse(text);
      const record = parsed as { title?: unknown; content?: unknown };
      const content = (record.content ?? parsed) as DocumentContent;

      if (content && typeof content === 'object' && (content as Node).type === 'doc') {
        return {
          title: typeof record.title === 'string' ? record.title : stem,
          content,
        };
      }
    } catch {
      // Not Noto's JSON; fall through and keep the text rather than refusing it.
    }
  }

  if (extension === 'md' || extension === 'markdown') {
    return { title: stem, content: markdownToContent(text) };
  }

  if ((extension === 'html' || extension === 'htm') && typeof DOMParser !== 'undefined') {
    return { title: titleFromHtml(text) ?? stem, content: htmlToContent(text) };
  }

  return { title: stem, content: textToContent(stripHtml(text)) };
}

/** The page's own `<title>`, when it has a real one. */
function titleFromHtml(html: string): string | null {
  const title = new DOMParser().parseFromString(html, 'text/html').title.trim();
  return title === '' ? null : title;
}

function stripHtml(value: string): string {
  if (!/<[a-z][\s\S]*>/i.test(value)) return value;

  const parsed = new DOMParser().parseFromString(value, 'text/html');
  return parsed.body.textContent ?? '';
}

function textToContent(text: string): DocumentContent {
  return {
    type: 'doc',
    content: text
      .split(/\r?\n/)
      .map((line) =>
        line.trim() === ''
          ? { type: 'paragraph' }
          : { type: 'paragraph', content: [{ type: 'text', text: line }] },
      ),
  };
}

function markdownToContent(markdown: string): DocumentContent {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: Node[] = [];

  let paragraph: string[] = [];
  let list: { ordered: boolean; items: Node[] } | null = null;
  let fence: string[] | null = null;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push({ type: 'paragraph', content: [{ type: 'text', text: paragraph.join(' ') }] });
    paragraph = [];
  };

  const flushList = () => {
    if (!list) return;
    blocks.push({ type: list.ordered ? 'orderedList' : 'bulletList', content: list.items });
    list = null;
  };

  const flushAll = () => {
    flushParagraph();
    flushList();
  };

  for (const line of lines) {
    if (fence !== null) {
      if (line.trimEnd() === '```') {
        blocks.push({
          type: 'codeBlock',
          content: [{ type: 'text', text: fence.join('\n') }],
        });
        fence = null;
      } else {
        fence.push(line);
      }
      continue;
    }

    if (line.trimStart().startsWith('```')) {
      flushAll();
      fence = [];
      continue;
    }

    if (line.trim() === '') {
      flushAll();
      continue;
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      flushAll();
      blocks.push({
        type: 'heading',
        attrs: { level: heading[1]!.length },
        content: [{ type: 'text', text: heading[2]! }],
      });
      continue;
    }

    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      flushAll();
      blocks.push({ type: 'horizontalRule' });
      continue;
    }

    const quote = /^>\s?(.*)$/.exec(line);
    if (quote) {
      flushAll();
      blocks.push({
        type: 'blockquote',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: quote[1]! }] }],
      });
      continue;
    }

    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
    const ordered = /^\s*\d+[.)]\s+(.*)$/.exec(line);

    if (bullet || ordered) {
      flushParagraph();

      const isOrdered = Boolean(ordered);
      const text = (bullet?.[1] ?? ordered?.[1])!;

      if (list && list.ordered !== isOrdered) flushList();
      list ??= { ordered: isOrdered, items: [] };

      list.items.push({
        type: 'listItem',
        content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
      });
      continue;
    }

    flushList();
    paragraph.push(line.trim());
  }

  flushAll();
  if (fence !== null && fence.length > 0) {
    blocks.push({ type: 'codeBlock', content: [{ type: 'text', text: fence.join('\n') }] });
  }

  return { type: 'doc', content: blocks.length > 0 ? blocks : [{ type: 'paragraph' }] };
}
