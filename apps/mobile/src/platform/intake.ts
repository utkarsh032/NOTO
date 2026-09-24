import * as Linking from 'expo-linking';
import { clearSharedPayloads, getSharedPayloads } from 'expo-sharing';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

/**
 * What the phone hands Noto from outside, forwarded to the interface as is.
 *
 * The same shape as `IntakeItem` in `@noto/mobile-webview`, which decides what
 * each item means. Nothing is interpreted here: the page is where routes and
 * Memory live, and one place deciding is easier to trust than two.
 */
export type IntakeItem =
  | { type: 'link'; url: string }
  | { type: 'share'; shareType: string; value: string; mimeType?: string };

/**
 * Collects tapped `noto://` links and shares from other applications, and holds
 * them until the page takes them.
 *
 * On a cold start the link or share is what launched Noto, so it arrives long
 * before the interface has loaded and opened storage. So the page pulls: it
 * asks for everything held (`intake.take`) once it is ready, and again each
 * time `poke` tells it something new arrived. A poke sent while the page is
 * reloading is simply lost, and nothing held goes with it.
 *
 * Shares are read with `getSharedPayloads` rather than `useIncomingShare`: the
 * hook also resolves every shared URL over the network, which Noto does not
 * need, and it ignores a second share identical to the first.
 */
export function useNativeIntake(poke: () => void): () => IntakeItem[] {
  const held = useRef<IntakeItem[]>([]);

  const hold = useCallback(
    (items: IntakeItem[]) => {
      if (items.length === 0) return;
      held.current.push(...items);
      poke();
    },
    [poke],
  );

  const takeShares = useCallback(() => {
    const payloads = getSharedPayloads();
    if (payloads.length === 0) return;

    // Cleared first, so a share is never taken twice if handing it on throws.
    clearSharedPayloads();
    hold(
      payloads.map((payload) => ({
        type: 'share',
        shareType: payload.shareType,
        value: payload.value,
        mimeType: payload.mimeType,
      })),
    );
  }, [hold]);

  useEffect(() => {
    let active = true;

    void Linking.getInitialURL().then((url) => {
      if (active && url) hold([{ type: 'link', url }]);
    });
    takeShares();

    // A share into a running Noto arrives as a `noto://expo-sharing` link, and
    // one into a backgrounded Noto as the application becoming active.
    const links = Linking.addEventListener('url', ({ url }) => {
      hold([{ type: 'link', url }]);
      takeShares();
    });
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') takeShares();
    });

    return () => {
      active = false;
      links.remove();
      appState.remove();
    };
  }, [hold, takeShares]);

  /** Everything held so far, handed over once. */
  return useCallback(() => {
    const items = held.current;
    held.current = [];
    return items;
  }, []);
}
