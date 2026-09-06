import { describe, expect, it } from 'vitest';

import { loginRouteFor, returnRouteFrom, routeAccess } from './router';
import { decideRoute } from './use-route-guard';

/*
 * The decision table, rather than the hook around it.
 *
 * What is worth pinning down here is which combinations of route and account
 * are allowed, waited on, or turned away — the React wiring is three lines and
 * has no cases in it.
 */

describe('routeAccess', () => {
  it('leaves the work public', () => {
    // Noto is local-first. Everything on this list is somebody's own device,
    // and requiring an account to reach it would invent a gate the product
    // does not have.
    for (const name of ['home', 'workspace', 'documents', 'quick-note', 'search'] as const) {
      expect(routeAccess(name)).toBe('public');
    }
  });

  it('keeps the account screen private and the sign-in screen anonymous', () => {
    expect(routeAccess('account')).toBe('private');
    expect(routeAccess('login')).toBe('anonymous');
  });
});

describe('decideRoute', () => {
  it('allows a public route whoever is there', () => {
    expect(decideRoute({ name: 'home' }, 'signed-out', false).verdict).toBe('allow');
    expect(decideRoute({ name: 'documents' }, 'signed-in', true).verdict).toBe('allow');
    expect(decideRoute({ name: 'settings' }, 'unavailable', false).verdict).toBe('allow');
    expect(decideRoute({ name: 'workspace' }, 'restoring', false).verdict).toBe('allow');
  });

  it('sends a signed-out visitor from the account screen to sign in', () => {
    const { verdict, destination } = decideRoute({ name: 'account' }, 'signed-out', false);

    expect(verdict).toBe('redirecting');
    // Carrying where they were going, so the sign-in lands them back on it.
    expect(destination).toEqual({ name: 'login', param: 'account' });
  });

  it('waits rather than turning somebody away while their session comes back', () => {
    // The reload case. Answering "not signed in" here would throw a signed-in
    // person off their own account screen every time they refreshed it.
    expect(decideRoute({ name: 'account' }, 'restoring', false).verdict).toBe('wait');
    expect(decideRoute({ name: 'account' }, 'signing-in', false).verdict).toBe('wait');
  });

  it('lets the account screen explain itself when there is no account service', () => {
    // A build with no cloud credentials has nothing to sign into, so a redirect
    // to the sign-in form would only be a longer way of saying so.
    expect(decideRoute({ name: 'account' }, 'unavailable', false).verdict).toBe('allow');
  });

  it('does not trust a status without a user behind it', () => {
    // `signed-in` with no profile is a half-loaded state, not an account.
    expect(decideRoute({ name: 'account' }, 'signed-in', false).verdict).toBe('redirecting');
  });

  it('admits somebody who is actually signed in', () => {
    expect(decideRoute({ name: 'account' }, 'signed-in', true).verdict).toBe('allow');
  });

  it('moves a signed-in person off the sign-in screen', () => {
    const { verdict, destination } = decideRoute({ name: 'login' }, 'signed-in', true);

    expect(verdict).toBe('redirecting');
    expect(destination).toEqual({ name: 'home' });
  });

  it('returns a signed-in person to the screen they were asking for', () => {
    const decision = decideRoute({ name: 'login', param: 'account' }, 'signed-in', true);

    expect(decision.destination).toEqual({ name: 'account' });
  });

  it('leaves the sign-in screen alone for everybody else', () => {
    expect(decideRoute({ name: 'login' }, 'signed-out', false).verdict).toBe('allow');
    expect(decideRoute({ name: 'login' }, 'signing-in', false).verdict).toBe('allow');
    expect(decideRoute({ name: 'login' }, 'restoring', false).verdict).toBe('allow');
    expect(decideRoute({ name: 'login' }, 'unavailable', false).verdict).toBe('allow');
  });
});

describe('the round trip through sign-in', () => {
  it('carries a private route there and back', () => {
    const login = loginRouteFor({ name: 'account' });

    expect(login).toEqual({ name: 'login', param: 'account' });
    expect(returnRouteFrom(login)).toEqual({ name: 'account' });
  });

  it('does not carry the sign-in screen into itself', () => {
    expect(loginRouteFor({ name: 'login', param: 'account' })).toEqual({ name: 'login' });
  });

  it('falls back to Home rather than looping or trusting the hash', () => {
    // The return route comes off the address bar, so it is somebody else's
    // input: anything that is not a route Noto has goes to Home.
    expect(returnRouteFrom({ name: 'login' })).toEqual({ name: 'home' });
    expect(returnRouteFrom({ name: 'login', param: 'nonsense' })).toEqual({ name: 'home' });
    expect(returnRouteFrom({ name: 'login', param: 'login' })).toEqual({ name: 'home' });
  });
});
