import type { DocumentContent } from '@noto/types';
import { useEffect, useState } from 'react';

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

export interface OutlineNode extends OutlineEntry {
  children: OutlineNode[];
}

/**
 * The same headings, nested by level.
 *
 * A heading deeper than the one before it becomes its child, which is what
 * lets a long document's outline be folded down to its parts. Levels that skip
 * a step — an h3 under an h1 — nest anyway rather than being flattened: the
 * writer meant it to sit under that heading, whatever number they gave it.
 */
export function buildOutlineTree(entries: readonly OutlineEntry[]): OutlineNode[] {
  const roots: OutlineNode[] = [];
  const stack: OutlineNode[] = [];

  for (const entry of entries) {
    const node: OutlineNode = { ...entry, children: [] };

    while (stack.length > 0 && stack[stack.length - 1]!.level >= node.level) stack.pop();

    if (stack.length === 0) roots.push(node);
    else stack[stack.length - 1]!.children.push(node);

    stack.push(node);
  }

  return roots;
}

/**
 * Which heading the reader is currently under, as an index into the outline.
 *
 * Measured against the top of the editor's scroller rather than the window:
 * the pane has a toolbar over it, and a heading that has slid under the
 * toolbar has been read, not arrived at.
 */
export function useActiveHeading(documentId: string | null): number {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!documentId) return;

    const body = document.querySelector('#noto-document-body');
    const scroller = body?.closest<HTMLElement>('.noto-scroll') ?? null;
    if (!body || !scroller) return;

    let frame = 0;

    const measure = () => {
      frame = 0;

      const headings = body.querySelectorAll<HTMLElement>('h1, h2, h3');
      const line = scroller.getBoundingClientRect().top + 96;

      let next = 0;
      headings.forEach((heading, index) => {
        if (heading.getBoundingClientRect().top <= line) next = index;
      });

      setActive(next);
    };

    /* Coalesced to one reading per frame; scrolling fires far faster than the
       panel can usefully redraw. */
    const onScroll = () => {
      if (frame === 0) frame = requestAnimationFrame(measure);
    };

    measure();
    scroller.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      scroller.removeEventListener('scroll', onScroll);
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, [documentId]);

  return active;
}
