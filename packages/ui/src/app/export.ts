import { plainTextFromContent, slugify } from '@noto/core';
import type { DocumentContent, NotoDocument } from '@noto/types';

/**
 * Getting a document out of Noto.
 *
 * Local-first means the user's work is theirs, so every format here is written
 * from the stored ProseMirror JSON with no service in the middle. The two
 * formats Noto cannot yet write — PDF and DOCX — are declared unsupported
 * rather than quietly missing, and PDF has an honest answer already: print.
 */

export type ExportFormat = 'txt' | 'md' | 'html' | 'json' | 'pdf' | 'docx';

export interface ExportFormatInfo {
  id: ExportFormat;
  label: string;
  extension: string;
  mimeType: string;
  description: string;
  /** `false` when Noto cannot produce this format yet. */
  supported: boolean;
}

export const EXPORT_FORMATS: ExportFormatInfo[] = [
  {
    id: 'md',
    label: 'Markdown',
    extension: 'md',
    mimeType: 'text/markdown',
    description: 'Headings, lists and links, in plain text.',
    supported: true,
  },
  {
    id: 'txt',
    label: 'Plain text',
    extension: 'txt',
    mimeType: 'text/plain',
    description: 'The words, and nothing else.',
    supported: true,
  },
  {
    id: 'html',
    label: 'HTML',
    extension: 'html',
    mimeType: 'text/html',
    description: 'A standalone page, styled like the editor.',
    supported: true,
  },
  {
    id: 'json',
    label: 'Noto JSON',
    extension: 'json',
    mimeType: 'application/json',
    description: 'The document exactly as Noto stores it.',
    supported: true,
  },
  {
    id: 'pdf',
    label: 'PDF',
    extension: 'pdf',
    mimeType: 'application/pdf',
    description: 'Use Print, and choose Save as PDF.',
    supported: false,
  },
  {
    id: 'docx',
    label: 'Word (DOCX)',
    extension: 'docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    description: 'Not available yet.',
    supported: false,
  },
];

/** A node of Tiptap JSON, narrowed to the parts the writers below read. */
interface Node {
  type?: string;
  attrs?: Record<string, unknown>;
  text?: string;
  marks?: { type?: string; attrs?: Record<string, unknown> }[];
  content?: Node[];
}

function childrenOf(node: Node): Node[] {
  return Array.isArray(node.content) ? node.content : [];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* -------------------------------------------------------------------------- */
/* Markdown                                                                   */
/* -------------------------------------------------------------------------- */

function markdownInline(nodes: Node[]): string {
  return nodes
    .map((node) => {
      if (node.type !== 'text') {
        // A hard break inside a paragraph; anything else inline is ignored.
        return node.type === 'hardBreak' ? '  \n' : markdownInline(childrenOf(node));
      }

      let text = node.text ?? '';

      for (const mark of node.marks ?? []) {
        switch (mark.type) {
          case 'bold':
            text = `**${text}**`;
            break;
          case 'italic':
            text = `*${text}*`;
            break;
          case 'strike':
            text = `~~${text}~~`;
            break;
          case 'code':
            text = `\`${text}\``;
            break;
          case 'link': {
            const href = typeof mark.attrs?.href === 'string' ? mark.attrs.href : '';
            text = href ? `[${text}](${href})` : text;
            break;
          }
          default:
            break;
        }
      }

      return text;
    })
    .join('');
}

function markdownBlock(node: Node, depth = 0): string {
  const indent = '  '.repeat(depth);

  switch (node.type) {
    case 'heading': {
      const level = typeof node.attrs?.level === 'number' ? node.attrs.level : 1;
      return `${'#'.repeat(level)} ${markdownInline(childrenOf(node))}`;
    }
    case 'paragraph':
      return `${indent}${markdownInline(childrenOf(node))}`;
    case 'blockquote':
      return childrenOf(node)
        .map((child) => `> ${markdownBlock(child, depth)}`)
        .join('\n');
    case 'codeBlock':
      return `\`\`\`\n${markdownInline(childrenOf(node))}\n\`\`\``;
    case 'horizontalRule':
      return '---';
    case 'image': {
      const src = typeof node.attrs?.src === 'string' ? node.attrs.src : '';
      const alt = typeof node.attrs?.alt === 'string' ? node.attrs.alt : '';
      return `![${alt}](${src})`;
    }
    case 'bulletList':
      return childrenOf(node)
        .map((item) => `${indent}- ${markdownBlocks(childrenOf(item), depth + 1).trim()}`)
        .join('\n');
    case 'orderedList':
      return childrenOf(node)
        .map(
          (item, index) =>
            `${indent}${index + 1}. ${markdownBlocks(childrenOf(item), depth + 1).trim()}`,
        )
        .join('\n');
    case 'taskList':
      return childrenOf(node)
        .map(
          (item) =>
            `${indent}- [${item.attrs?.checked ? 'x' : ' '}] ${markdownBlocks(childrenOf(item), depth + 1).trim()}`,
        )
        .join('\n');
    case 'table':
      return markdownTable(node);
    default:
      return markdownBlocks(childrenOf(node), depth);
  }
}

function markdownBlocks(nodes: Node[], depth = 0): string {
  return nodes
    .map((node) => markdownBlock(node, depth))
    .filter((block) => block !== '')
    .join('\n\n');
}

function markdownTable(node: Node): string {
  const rows = childrenOf(node).map((row) =>
    childrenOf(row).map((cell) => markdownBlocks(childrenOf(cell)).replace(/\n+/g, ' ')),
  );
  if (rows.length === 0) return '';

  const [head, ...body] = rows;
  const divider = head!.map(() => '---');

  return [head!, divider, ...body].map((cells) => `| ${cells.join(' | ')} |`).join('\n');
}

export function documentToMarkdown(document: Pick<NotoDocument, 'title' | 'content'>): string {
  const body = markdownBlocks(childrenOf(document.content as Node));
  return `# ${document.title || 'Untitled'}\n\n${body}\n`;
}

/* -------------------------------------------------------------------------- */
/* HTML                                                                       */
/* -------------------------------------------------------------------------- */

function htmlInline(nodes: Node[]): string {
  return nodes
    .map((node) => {
      if (node.type === 'hardBreak') return '<br />';
      if (node.type !== 'text') return htmlInline(childrenOf(node));

      let text = escapeHtml(node.text ?? '');

      for (const mark of node.marks ?? []) {
        switch (mark.type) {
          case 'bold':
            text = `<strong>${text}</strong>`;
            break;
          case 'italic':
            text = `<em>${text}</em>`;
            break;
          case 'underline':
            text = `<u>${text}</u>`;
            break;
          case 'strike':
            text = `<s>${text}</s>`;
            break;
          case 'code':
            text = `<code>${text}</code>`;
            break;
          case 'link': {
            const href = typeof mark.attrs?.href === 'string' ? escapeHtml(mark.attrs.href) : '';
            text = href
              ? `<a href="${href}" rel="noopener noreferrer" target="_blank">${text}</a>`
              : text;
            break;
          }
          default:
            break;
        }
      }

      return text;
    })
    .join('');
}

function htmlBlock(node: Node): string {
  const align = typeof node.attrs?.textAlign === 'string' ? node.attrs.textAlign : null;
  const style = align && align !== 'left' ? ` style="text-align:${align}"` : '';

  switch (node.type) {
    case 'heading': {
      const level = typeof node.attrs?.level === 'number' ? node.attrs.level : 1;
      return `<h${level}${style}>${htmlInline(childrenOf(node))}</h${level}>`;
    }
    case 'paragraph':
      return `<p${style}>${htmlInline(childrenOf(node))}</p>`;
    case 'blockquote':
      return `<blockquote>${htmlBlocks(childrenOf(node))}</blockquote>`;
    case 'codeBlock':
      return `<pre><code>${escapeHtml(htmlInline(childrenOf(node)))}</code></pre>`;
    case 'horizontalRule':
      return '<hr />';
    case 'image': {
      const src = typeof node.attrs?.src === 'string' ? escapeHtml(node.attrs.src) : '';
      const alt = typeof node.attrs?.alt === 'string' ? escapeHtml(node.attrs.alt) : '';
      return `<img src="${src}" alt="${alt}" />`;
    }
    case 'bulletList':
      return `<ul>${childrenOf(node)
        .map((item) => `<li>${htmlBlocks(childrenOf(item))}</li>`)
        .join('')}</ul>`;
    case 'orderedList':
      return `<ol>${childrenOf(node)
        .map((item) => `<li>${htmlBlocks(childrenOf(item))}</li>`)
        .join('')}</ol>`;
    case 'taskList':
      return `<ul class="task-list">${childrenOf(node)
        .map(
          (item) =>
            `<li><input type="checkbox" disabled${item.attrs?.checked ? ' checked' : ''} /> ${htmlBlocks(
              childrenOf(item),
            )}</li>`,
        )
        .join('')}</ul>`;
    case 'table':
      return `<table>${childrenOf(node)
        .map(
          (row) =>
            `<tr>${childrenOf(row)
              .map((cell) => {
                const tag = cell.type === 'tableHeader' ? 'th' : 'td';
                return `<${tag}>${htmlBlocks(childrenOf(cell))}</${tag}>`;
              })
              .join('')}</tr>`,
        )
        .join('')}</table>`;
    default:
      return htmlBlocks(childrenOf(node));
  }
}

function htmlBlocks(nodes: Node[]): string {
  return nodes.map(htmlBlock).join('\n');
}

/** A standalone page: no stylesheet to fetch, no script, readable offline. */
export function documentToHtml(document: Pick<NotoDocument, 'title' | 'content'>): string {
  const title = escapeHtml(document.title || 'Untitled');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>
  body { margin: 0 auto; max-width: 720px; padding: 48px 24px; color: #111827;
         font: 17px/1.75 Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
  h1, h2, h3 { line-height: 1.3; letter-spacing: -0.015em; margin: 1.6em 0 0.5em; }
  h1 { font-size: 1.75em; } h2 { font-size: 1.375em; } h3 { font-size: 1.125em; }
  blockquote { border-left: 3px solid #d5dbd5; color: #4b5563; margin: 0 0 0.85em; padding-left: 1em; }
  code { background: #f1f4f1; border-radius: 6px; padding: 0.125em 0.35em; }
  pre { background: #f1f4f1; border: 1px solid #e5e9e5; border-radius: 8px; overflow-x: auto; padding: 0.875em 1em; }
  pre code { background: none; padding: 0; }
  a { color: #2563eb; }
  img { border-radius: 12px; max-width: 100%; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #e5e9e5; padding: 0.4em 0.6em; text-align: left; }
  th { background: #f7f9f7; }
  ul.task-list { list-style: none; padding-left: 0.5em; }
</style>
</head>
<body>
<h1>${title}</h1>
${htmlBlocks(childrenOf(document.content as Node))}
</body>
</html>
`;
}

/**
 * Several documents as one.
 *
 * Every export format Noto writes is a single file, and a browser cannot be
 * asked for twenty downloads at once without half of them being blocked. So a
 * bulk export is one document with each of the originals under its own
 * heading — which is also what someone asking for "all of it" usually wants to
 * read afterwards.
 */
export function bundleDocuments(
  documents: readonly Pick<NotoDocument, 'title' | 'content'>[],
  title: string,
): Pick<NotoDocument, 'title' | 'content'> {
  const content: unknown[] = [];

  for (const [index, document] of documents.entries()) {
    if (index > 0) content.push({ type: 'horizontalRule' });

    content.push({
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: document.title || 'Untitled' }],
    });
    content.push(...((document.content.content ?? []) as unknown[]));
  }

  return { title, content: { type: 'doc', content } };
}

/* -------------------------------------------------------------------------- */
/* Writing the file                                                           */
/* -------------------------------------------------------------------------- */

export function documentToText(document: Pick<NotoDocument, 'title' | 'content'>): string {
  return `${document.title || 'Untitled'}\n\n${plainTextFromContent(document.content)}\n`;
}

export function serialiseDocument(
  document: Pick<NotoDocument, 'title' | 'content'>,
  format: ExportFormat,
): string {
  switch (format) {
    case 'md':
      return documentToMarkdown(document);
    case 'html':
      return documentToHtml(document);
    case 'json':
      return JSON.stringify({ title: document.title, content: document.content }, null, 2);
    default:
      return documentToText(document);
  }
}

/**
 * Hands the file to the browser.
 *
 * An object URL and a synthetic click: it is the only route that works
 * identically in a browser tab and inside Electron's renderer, and it never
 * sends the document anywhere. The URL is revoked on the next tick, once the
 * download has been handed off.
 */
export function downloadDocument(
  document: Pick<NotoDocument, 'title' | 'content'>,
  format: ExportFormat,
): boolean {
  const info = EXPORT_FORMATS.find((candidate) => candidate.id === format);
  if (!info?.supported) return false;

  const blob = new Blob([serialiseDocument(document, format)], {
    type: `${info.mimeType};charset=utf-8`,
  });
  const url = URL.createObjectURL(blob);

  const anchor = window.document.createElement('a');
  anchor.href = url;
  anchor.download = `${slugify(document.title || 'untitled') || 'untitled'}.${info.extension}`;
  window.document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  setTimeout(() => URL.revokeObjectURL(url), 0);

  return true;
}

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

  return { title: stem, content: textToContent(stripHtml(text)) };
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
