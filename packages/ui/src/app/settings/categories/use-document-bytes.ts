import { useMemo } from 'react';

import { useNotoData } from '../../data-context';

/** Roughly how much the workspace's documents take up on this device. */
export function useDocumentBytes(): number {
  const { documents } = useNotoData();

  return useMemo(
    () =>
      (documents ?? []).reduce(
        (total, document) => total + JSON.stringify(document.content).length,
        0,
      ),
    [documents],
  );
}
