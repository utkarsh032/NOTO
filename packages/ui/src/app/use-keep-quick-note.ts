import { useCallback } from 'react';

import { showToast } from '../components/toast-store';
import { useMemoryCapture } from './memory/use-memory';
import { readQuickNoteDraft, writeQuickNoteDraft } from './quick-note-draft';

/**
 * Keeps a quick note: into Memory, as a note, and the draft is cleared.
 *
 * This is what Save means in every Quick Note surface — the floating window,
 * the Quick Notes screen and the desktop dock. A thought is not a document
 * until somebody decides it is; "Save as document" is the separate, second
 * action for when it has become one. Resolves `true` when the note was kept.
 */
export function useKeepQuickNote(): (text: string, source?: string) => Promise<boolean> {
  const capture = useMemoryCapture();

  return useCallback(
    async (text: string, source = 'Quick Note') => {
      const value = text.trim();
      if (value === '') return false;

      const kept = await capture({ kind: 'note', content: value, source });
      if (!kept) {
        showToast('Noto is still opening your workspace. Try again in a moment.');
        return false;
      }

      // Only if the draft is still the note that was kept. The save is
      // asynchronous, and whatever was typed while it ran is a new note.
      if (readQuickNoteDraft().trim() === value) writeQuickNoteDraft('');
      showToast('Kept in Quick Notes', { tone: 'success' });
      return true;
    },
    [capture],
  );
}
