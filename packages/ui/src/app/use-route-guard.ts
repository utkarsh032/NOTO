import { useEffect } from 'react';

import type { AccountValue } from './account-context';
import { loginRouteFor, replaceRoute, returnRouteFrom, routeAccess, type Route } from './router';
import { useAccount } from './use-account';

/**
 * What the shell should do with the route it has.
 *
 * `wait` is the state that makes the rest of this honest. Whether somebody is
 * signed in is not known at the first render — a session left in storage takes
 * a round trip to come back — so a guard that only answered yes or no would
 * have to guess, and it would guess wrong on every reload of a private screen.
 */
export type RouteVerdict = 'allow' | 'wait' | 'redirecting';

export interface RouteDecision {
  verdict: RouteVerdict;
  /** Where to go. Non-null exactly when the verdict is `redirecting`. */
  destination: Route | null;
}

const ALLOW: RouteDecision = { verdict: 'allow', destination: null };
const WAIT: RouteDecision = { verdict: 'wait', destination: null };

/**
 * Whether a route may be rendered, given who is signed in.
 *
 * Pure, and separate from the hook that applies it, because this is the part
 * with the interesting cases in it: a session still coming back, a build with
 * no account service, somebody already signed in asking for the sign-in form.
 */
export function decideRoute(
  route: Route,
  status: AccountValue['status'],
  hasUser: boolean,
): RouteDecision {
  const access = routeAccess(route.name);
  const signedIn = status === 'signed-in' && hasUser;

  if (access === 'public') return ALLOW;

  if (access === 'anonymous') {
    // Nothing here for somebody who is already signed in.
    return signedIn ? { verdict: 'redirecting', destination: returnRouteFrom(route) } : ALLOW;
  }

  if (signedIn) return ALLOW;

  /*
   * With no account service there is nothing to sign into, and so nothing to
   * protect: sending someone to a form that cannot work is a worse answer than
   * the screen's own explanation of why it is empty. This is the normal state
   * of a build shipped without cloud credentials, not a misconfiguration.
   */
  if (status === 'unavailable') return ALLOW;

  /*
   * `restoring` is the reload case and `signing-in` settles on its own in a
   * moment. Neither is an answer to "is this person signed in", so the route
   * waits rather than bouncing somebody who turns out to be signed in half a
   * second later.
   */
  if (status === 'restoring' || status === 'signing-in') return WAIT;

  return { verdict: 'redirecting', destination: loginRouteFor(route) };
}

/**
 * Keeps the route and the account in agreement.
 *
 * Noto has exactly one private screen and one anonymous one, so this is small
 * on purpose — but it is centralised on purpose too. A screen that checks for
 * itself is a screen that can forget to, and the one that forgets is the one
 * that shows the last person's devices to whoever opens it next.
 *
 * Redirects replace the history entry rather than push one: a screen you were
 * not allowed to be on is not somewhere the Back button should return you to.
 */
export function useRouteGuard(route: Route): RouteVerdict {
  const { status, user } = useAccount();

  const { verdict, destination } = decideRoute(route, status, user !== null);

  /*
   * The destination is passed to the effect as its two primitive parts, so it
   * re-runs when the redirect actually changes rather than on every render
   * that produces an equal-but-new object.
   */
  const name = destination?.name ?? null;
  const param = destination?.param ?? null;

  /*
   * Redirecting is an effect rather than something done while rendering: a
   * hash change mid-render is a second render's worth of work decided halfway
   * through the first one.
   */
  useEffect(() => {
    if (name === null) return;

    replaceRoute(param === null ? { name } : { name, param });
  }, [name, param]);

  return verdict;
}
