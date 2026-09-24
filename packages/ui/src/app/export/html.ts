import type { NotoDocument } from '@noto/types';

import { childrenOf, escapeHtml, type Node } from './node';

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
