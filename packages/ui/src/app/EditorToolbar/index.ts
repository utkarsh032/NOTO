/**
 * The formatting controls for the document editor.
 *
 * Every button is a command id: the label and the shortcut hint come from the
 * registry in `@noto/core`, and the action from `@noto/editor`. Nothing about
 * what bold *is* lives here — this file decides only what the controls look
 * like and which order they come in.
 */

export * from './controls';
export * from './EditorToolbar';
export * from './use-fullscreen';
export * from './Separator';
export * from './prompts';
