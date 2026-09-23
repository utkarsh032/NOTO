import type { MemoryItem } from '@noto/types';

import { showToast } from '../../components/toast-store';
import type { MemoryCapture } from './use-memory';

/** Text that is one http(s) URL and nothing else. */
function asLink(text: string): string | null {
  const value = text.trim();
  if (/\s/.test(value)) return null;

  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

/** What a piece of clipboard text becomes in Memory: a link, or a clipping. */
export function clipboardCapture(text: string, source: string | null = null): MemoryCapture {
  const url = asLink(text);

  return url
    ? { kind: 'link', content: '', url, source }
    : { kind: 'clipboard', content: text, source };
}

/**
 * Saves whatever text is on the clipboard into Memory.
 *
 * Reading the clipboard needs a user gesture and, in some browsers, a
 * permission prompt; either refusal is reported rather than swallowed, because
 * a capture that silently did nothing is the thing Memory must never do.
 */
export async function captureClipboard(
  capture: (input: MemoryCapture) => Promise<MemoryItem | null>,
): Promise<void> {
  let text: string;
  try {
    text = (await navigator.clipboard?.readText()) ?? '';
  } catch {
    showToast('Noto was not allowed to read the clipboard.', { tone: 'error' });
    return;
  }

  if (text.trim() === '') {
    showToast('The clipboard has no text to save.');
    return;
  }

  const input = clipboardCapture(text, 'Clipboard');
  const item = await capture(input);
  if (!item) return;

  showToast(input.kind === 'link' ? 'Link saved to Memory' : 'Clipboard saved to Memory', {
    tone: 'success',
  });
}
