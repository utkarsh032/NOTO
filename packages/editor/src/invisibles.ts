import { type Editor, Extension } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey, type Transaction } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

/**
 * Show Characters — drawing the parts of a document that take up space but
 * have no shape.
 *
 * Spaces and tabs are marked with an inline decoration rather than replaced by
 * a visible glyph: the character stays exactly what it was, and a dot is
 * painted over it by the stylesheet. Nothing here alters the document, so
 * turning the setting on cannot change what a copy, an export or a save
 * produces — which is the whole requirement. Line breaks and the ends of
 * blocks have no character to decorate at all, so those are widgets, which
 * ProseMirror keeps outside the document by construction.
 *
 * The cost of the feature is that a long document holds thousands of spaces,
 * and rebuilding a decoration for each of them on every keystroke would be
 * felt immediately. So the set is built once when the setting is switched on
 * and maintained incrementally after that: positions are mapped through each
 * transaction, and only the blocks a change actually touched are rebuilt.
 */

const invisiblesKey = new PluginKey<InvisiblesState>('notoInvisibles');

/** Shared by every marker, so one rule can colour all of them. */
export const INVISIBLE_CLASS = 'noto-invisible';
export const SPACE_CLASS = 'noto-invisible-space';
export const TAB_CLASS = 'noto-invisible-tab';
export const BREAK_CLASS = 'noto-invisible-break';
export const PARAGRAPH_CLASS = 'noto-invisible-paragraph';

interface InvisiblesState {
  enabled: boolean;
  decorations: DecorationSet;
}

/**
 * A marker standing in for something with no character behind it.
 *
 * `contenteditable="false"` and `aria-hidden` together keep it out of the way:
 * the caret cannot land inside it, and a screen reader announcing a pilcrow at
 * the end of every paragraph would be worse than useless.
 */
function marker(className: string, glyph: string) {
  return (): HTMLElement => {
    const span = document.createElement('span');
    span.className = `${INVISIBLE_CLASS} ${className}`;
    span.textContent = glyph;
    span.contentEditable = 'false';
    span.setAttribute('aria-hidden', 'true');
    return span;
  };
}

const renderBreak = marker(BREAK_CLASS, '↵');
const renderParagraphEnd = marker(PARAGRAPH_CLASS, '¶');

/*
 * `marks: []` stops a marker inheriting the formatting around it — a pilcrow
 * ending a bold paragraph should not itself be bold. `key` lets ProseMirror
 * reuse the element rather than recreate it on every redraw.
 */
const BREAK_SPEC = { side: -1, marks: [], key: 'noto-invisible-break', ignoreSelection: true };
const PARAGRAPH_SPEC = {
  side: 1,
  marks: [],
  key: 'noto-invisible-paragraph',
  ignoreSelection: true,
};

/**
 * The markers for everything between `from` and `to`.
 *
 * Exported for the tests: this is the whole of what the feature decides, and
 * everything around it is bookkeeping about when to run it.
 */
export function buildInvisibleDecorations(
  doc: ProseMirrorNode,
  from: number,
  to: number,
): Decoration[] {
  const decorations: Decoration[] = [];

  doc.nodesBetween(from, to, (node, pos) => {
    if (node.isText) {
      const text = node.text ?? '';

      for (let index = 0; index < text.length; index += 1) {
        const character = text[index];
        const className =
          character === ' ' ? SPACE_CLASS : character === '\t' ? TAB_CLASS : undefined;
        if (!className) continue;

        // A text node can begin before the range asked for and end after it.
        const at = pos + index;
        if (at < from || at >= to) continue;

        decorations.push(
          Decoration.inline(at, at + 1, { class: `${INVISIBLE_CLASS} ${className}` }),
        );
      }

      return false;
    }

    if (node.type.name === 'hardBreak') {
      decorations.push(Decoration.widget(pos, renderBreak, BREAK_SPEC));
      return false;
    }

    /*
     * The end of a block is a character the user typed — Enter — and the only
     * one with nothing whatsoever to show for it. The marker goes just inside
     * the closing token, which is where the caret sits on that line.
     */
    if (node.isTextblock) {
      const end = pos + node.nodeSize - 1;
      if (end >= from && end <= to) {
        decorations.push(Decoration.widget(end, renderParagraphEnd, PARAGRAPH_SPEC));
      }
    }

    return true;
  });

  return decorations;
}

function rebuild(doc: ProseMirrorNode): DecorationSet {
  return DecorationSet.create(doc, buildInvisibleDecorations(doc, 0, doc.content.size));
}

/**
 * The span of the new document a transaction rewrote, or `null` when it
 * rewrote nothing.
 *
 * Several changes in one transaction — a Replace All, say — collapse into the
 * single range covering them all, which costs a wider rebuild in the rare case
 * and keeps the common one, a keystroke, down to the block it landed in.
 */
function changedRange(tr: Transaction): { from: number; to: number } | null {
  let from = Number.POSITIVE_INFINITY;
  let to = Number.NEGATIVE_INFINITY;

  tr.mapping.maps.forEach((stepMap, index) => {
    stepMap.forEach((_oldStart, _oldEnd, newStart, newEnd) => {
      // Positions from step `index` are in that step's coordinates; the steps
      // after it have to be applied before they mean anything in `tr.doc`.
      const remaining = tr.mapping.slice(index + 1);
      from = Math.min(from, remaining.map(newStart, -1));
      to = Math.max(to, remaining.map(newEnd, 1));
    });
  });

  return from === Number.POSITIVE_INFINITY ? null : { from, to };
}

/**
 * Widens a range to whole top-level blocks.
 *
 * A block-end marker belongs to its block rather than to the character that
 * moved, so rebuilding half a paragraph would drop the pilcrow off the end.
 */
function blockAligned(
  doc: ProseMirrorNode,
  from: number,
  to: number,
): { from: number; to: number } {
  const size = doc.content.size;
  const $from = doc.resolve(Math.max(0, Math.min(from, size)));
  const $to = doc.resolve(Math.max(0, Math.min(to, size)));

  return {
    from: $from.depth > 0 ? $from.before(1) : 0,
    to: $to.depth > 0 ? $to.after(1) : size,
  };
}

/** Registers the decoration plugin. It draws nothing until it is switched on. */
export const NotoInvisibles = Extension.create({
  name: 'notoInvisibles',

  addProseMirrorPlugins() {
    return [
      new Plugin<InvisiblesState>({
        key: invisiblesKey,

        state: {
          init: () => ({ enabled: false, decorations: DecorationSet.empty }),

          apply(tr, value, _oldState, newState) {
            const toggled = tr.getMeta(invisiblesKey) as boolean | undefined;
            const enabled = toggled ?? value.enabled;

            // `DecorationSet.empty` is a singleton, so the identity the editor
            // compares against does not change while the feature is off.
            if (!enabled) return { enabled: false, decorations: DecorationSet.empty };

            // Switched on just now — there is nothing to maintain yet.
            if (!value.enabled) return { enabled, decorations: rebuild(newState.doc) };

            if (!tr.docChanged) return value;

            const mapped = value.decorations.map(tr.mapping, tr.doc);
            const changed = changedRange(tr);
            if (!changed) return { enabled, decorations: mapped };

            const range = blockAligned(tr.doc, changed.from, changed.to);

            return {
              enabled,
              decorations: mapped
                .remove(mapped.find(range.from, range.to))
                .add(tr.doc, buildInvisibleDecorations(tr.doc, range.from, range.to)),
            };
          },
        },

        props: {
          decorations: (state) => invisiblesKey.getState(state)?.decorations ?? DecorationSet.empty,
        },
      }),
    ];
  },
});

/** Whether the editor is drawing invisible characters at the moment. */
export function showsInvisibles(editor: Editor | null): boolean {
  if (!editor) return false;
  return invisiblesKey.getState(editor.state)?.enabled ?? false;
}

/**
 * Turns the markers on or off.
 *
 * Kept out of the undo history: this is a way of looking at the document, and
 * a user pressing undo straight afterwards means the sentence they just wrote.
 */
export function setShowInvisibles(editor: Editor | null, show: boolean): void {
  if (!editor) return;

  const state = invisiblesKey.getState(editor.state);
  if (!state || state.enabled === show) return;

  editor.view.dispatch(editor.state.tr.setMeta(invisiblesKey, show).setMeta('addToHistory', false));
}
