/**
 * The links in Noto's emails, as `apps/api` writes them:
 * `#/auth/verify?token=…` and `#/auth/reset?token=…`.
 */

export type AuthLinkKind = 'verify' | 'reset';

/** `verify?token=abc` → `{ kind: 'verify', token: 'abc' }`. */
export function parseAuthLink(param: string | undefined): {
  kind: AuthLinkKind | null;
  token: string | null;
} {
  const [head = '', query = ''] = (param ?? '').split('?');
  const kind = head === 'verify' || head === 'reset' ? head : null;
  const token = new URLSearchParams(query).get('token');

  return { kind, token: token && token.length > 0 ? token : null };
}
