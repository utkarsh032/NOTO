import type { DocumentContent } from '@noto/types';

export interface OutlineEntry {
  /** Position among the document's headings, which is how it is found in the DOM. */
  index: number;
  level: number;
  text: string;
}

interface Node {
  type?: string;
  attrs?: Record<string, unknown>;
  text?: string;
  content?: Node[];
}

function textOf(node: Node): string {
  if (typeof node.text === 'string') return node.text;
  return (node.content ?? []).map(textOf).join('');
}

/**
 * The document's headings, in order.
 *
 * Read from the stored content rather than from the editor: the outline is a
 * map of the document, and a map that redraws itself on every keystroke is
 * harder to use than one that settles a moment after you stop typing.
 */
export function buildOutline(content: DocumentContent): OutlineEntry[] {
  const entries: OutlineEntry[] = [];

  const walk = (nodes: readonly Node[]): void => {
    for (const node of nodes) {
      if (node.type === 'heading') {
        const text = textOf(node).trim();
        entries.push({
          index: entries.length,
          level: typeof node.attrs?.level === 'number' ? node.attrs.level : 1,
          text: text === '' ? 'Untitled section' : text,
        });
      }

      if (Array.isArray(node.content)) walk(node.content);
    }
  };

  walk((content.content ?? []) as Node[]);

  return entries;
}

/**
 * Scrolls the document to the nth heading.
 *
 * By position rather than by id: ProseMirror does not give headings ids, and
 * adding them would mean writing into the user's document to support a panel
 * beside it.
 */
export function scrollToHeading(index: number): void {
  const body = document.querySelector('#noto-document-body');
  if (!body) return;

  const headings = body.querySelectorAll<HTMLElement>('h1, h2, h3');
  headings[index]?.scrollIntoView({ block: 'start', behavior: 'smooth' });
}
