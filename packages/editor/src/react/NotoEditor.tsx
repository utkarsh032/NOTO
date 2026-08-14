import { EditorContent } from '@tiptap/react';

import { type UseNotoEditorOptions, useNotoEditor } from './use-noto-editor';

export interface NotoEditorProps extends UseNotoEditorOptions {
  className?: string;
}

/**
 * The shared rich-text surface used by the web and desktop applications.
 *
 * Typography is applied through the `noto-prose` class defined in the app
 * stylesheet, so the editor picks up the Noto design tokens without this
 * package depending on Tailwind.
 */
export function NotoEditor({ className, ...options }: NotoEditorProps) {
  const editor = useNotoEditor(options);

  if (!editor) return null;

  return <EditorContent editor={editor} className={className ?? 'noto-prose'} />;
}
