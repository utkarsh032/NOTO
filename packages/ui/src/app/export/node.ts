/** A node of Tiptap JSON, narrowed to the parts the writers and readers here read. */
export interface Node {
  type?: string;
  attrs?: Record<string, unknown>;
  text?: string;
  marks?: { type?: string; attrs?: Record<string, unknown> }[];
  content?: Node[];
}

export function childrenOf(node: Node): Node[] {
  return Array.isArray(node.content) ? node.content : [];
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
