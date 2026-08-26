import { NotoEditorContent } from './NotoEditorContent';
import { type UseNotoEditorOptions, useNotoEditor } from './use-noto-editor';

export interface NotoEditorProps extends UseNotoEditorOptions {
  className?: string;
}

/**
 * A self-contained rich-text surface, for callers that do not need the editor
 * instance themselves. Where a toolbar or menu has to act on the document, use
 * `useNotoEditor` with `NotoEditorContent` instead.
 */
export function NotoEditor({ className, ...options }: NotoEditorProps) {
  const editor = useNotoEditor(options);

  return <NotoEditorContent editor={editor} className={className} />;
}
