import { useCallback, useRef } from 'react';

import { showToast } from '../components/toast-store';
import { navigate } from './router';
import { useAccount } from './use-account';

export interface SignOutControl {
  /** Ends the session and leaves for the sign-in screen. Safe to call twice. */
  signOut: () => void;
  /** False when this build has no account service, so there is nothing to end. */
  available: boolean;
}

/**
 * Signing out, in one place.
 *
 * It is offered from the header and from the account screen, and those two
 * were never going to stay in step if each wrote its own version — the header's
 * used to navigate to the sign-in screen without ending anything, which left
 * the session in storage and the person signed back in on the next reload.
 *
 * The request that revokes the token server-side is deliberately not awaited.
 * The account is cleared before the provider's first await, so nobody is signed
 * in by the time this returns, while revocation takes as long as the network
 * takes — and an interface still showing somebody's name until an unreachable
 * server answers has not signed them out of anything they can see.
 */
export function useSignOut(): SignOutControl {
  const { signOut } = useAccount();
  const inFlight = useRef(false);

  const run = useCallback(() => {
    if (!signOut) {
      // No account service in this build, so there is no session to end — but
      // the sign-in screen is still where "sign out" should leave somebody.
      navigate('login');

      return;
    }

    if (inFlight.current) return;
    inFlight.current = true;

    void signOut()
      .catch(() => {
        /* The provider reports every failure it can describe. This is here so
           an unexpected one cannot become an unhandled rejection. */
      })
      .finally(() => {
        inFlight.current = false;
      });

    navigate('login');
    showToast('Signed out.', { tone: 'success' });
  }, [signOut]);

  return { signOut: run, available: signOut !== null };
}
