import type { NotoDocument } from '@noto/types';

import { childrenOf, type Node } from './node';

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
