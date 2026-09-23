import { navigate, showToast, useMemoryCapture, useNotoData } from '@noto/ui';
import { useEffect, useRef } from 'react';

import { onNativeEvent, requestFromNative } from './bridge';
import { captureFromShare, routeHashFromLink, type IntakeItem } from './intake';

/**
 * Receives what the phone hands Noto — tapped `noto://` links and shares from
 * other applications — and acts on it.
 *
 * The native side holds everything until this takes it, which on a cold start
 * matters: the link or share is what launched the application, long before
 * storage was open. So this takes once storage is ready, and again whenever an
 * `intake` event says something new has arrived.
 */
export function NativeIntake() {
  const { database, workspace } = useNotoData();
  const capture = useMemoryCapture();
  const ready = Boolean(database && workspace);

  // The listener outlives renders, so it reads the latest capture from here.
  const captureRef = useRef(capture);
  useEffect(() => {
    captureRef.current = capture;
  }, [capture]);

  useEffect(() => {
    if (!ready) return;

    const take = () => {
      requestFromNative<IntakeItem[]>('intake.take')
        .then((items) => receive(items, captureRef.current))
        .catch((error: unknown) => {
          console.error('Noto could not take shared items.', error);
        });
    };

    const unsubscribe = onNativeEvent<null>('intake', take);
    take();

    return unsubscribe;
  }, [ready]);

  return null;
}

async function receive(
  items: IntakeItem[],
  capture: ReturnType<typeof useMemoryCapture>,
): Promise<void> {
  let saved = 0;

  for (const item of items) {
    if (item.type === 'link') {
      const hash = routeHashFromLink(item.url);
      if (hash) window.location.hash = hash;
      continue;
    }

    const input = captureFromShare(item);
    if (!input) continue;

    try {
      if (await capture(input)) saved += 1;
    } catch (error) {
      console.error('Noto could not save a shared item.', error);
      showToast('Noto could not save what was shared.', { tone: 'error' });
    }
  }

  if (saved > 0) {
    showToast(saved === 1 ? 'Saved to Memory' : `${saved} items saved to Memory`, {
      tone: 'success',
    });
    navigate('memory');
  }
}
