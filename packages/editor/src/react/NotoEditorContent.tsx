import { type Editor, EditorContent } from '@tiptap/react';
import type { HTMLAttributes } from 'react';

export interface NotoEditorContentProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  editor: Editor | null;
}

/**
 * The writing surface for an editor the caller already owns.
 *
 * Split out from `NotoEditor` so a caller that needs the instance — to hang a
 * formatting toolbar off it, say — can create it with `useNotoEditor` and still
 * render the document the same way everywhere else does.
 *
 * Typography comes from the `noto-prose` class in the app stylesheet, so this
 * package does not depend on Tailwind.
 */
export function NotoEditorContent({ editor, className, ...props }: NotoEditorContentProps) {
  if (!editor) return null;

  return <EditorContent editor={editor} className={className ?? 'noto-prose'} {...props} />;
}
