import { parseRoute, routeToHash, type MemoryCapture } from '@noto/ui';

/**
 * What the phone hands Noto from outside: a `noto://` link someone tapped, or
 * something shared into Noto from another application.
 *
 * The native side forwards both unchanged and this side decides what they
 * mean. A link or a share comes from another application, so nothing in it is
 * trusted beyond what is checked here.
 */
export type IntakeItem =
  | { type: 'link'; url: string }
  | { type: 'share'; shareType: string; value: string; mimeType?: string };

/**
 * The hash route a `noto://` link opens, or `null` when it names no screen.
 *
 * `noto://memory`, `noto://quick-note` and `noto://workspace/<id>` open those
 * screens. Anything else — including `noto://expo-sharing`, which is how a
 * share arrives and is handled on its own — opens nothing, rather than falling
 * through to Home and looking like it worked.
 */
export function routeHashFromLink(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'noto:') return null;

  // `noto://memory/link` puts the screen in the host; `noto:///memory/link`
  // puts it in the path. Both are the same link.
  const path = `${parsed.host}${parsed.pathname}`.replace(/^\/+/, '').replace(/\/+$/, '');
  if (path === '') return null;

  const route = parseRoute(`#/${path}`);
  if (route.name !== path.split('/')[0]) return null;

  return routeToHash(route);
}

/** A single http(s) URL and nothing else, normalised; otherwise `null`. */
function asWebUrl(text: string): string | null {
  const value = text.trim();
  if (value === '' || /\s/.test(value)) return null;

  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * What a share becomes in Memory, or `null` for a kind Noto does not take.
 *
 * A web address — shared as one, or as text that is only a URL, which is how
 * most browsers on Android send a page — is kept as a link. Other text is a
 * note. Files and images are not accepted yet; the application only registers
 * for text and URLs, so reaching here with one is a mistake, not a user action.
 */
export function captureFromShare(
  item: Extract<IntakeItem, { type: 'share' }>,
): MemoryCapture | null {
  if (item.shareType !== 'text' && item.shareType !== 'url') return null;
  if (item.value.trim() === '') return null;

  const url = asWebUrl(item.value);
  if (url) return { kind: 'link', content: '', url, source: 'Shared' };

  // A `url` share that is not a web address (a `mailto:`, say) is not a link
  // Noto can open, so it is kept as the text it is.
  return { kind: 'note', content: item.value, source: 'Shared' };
}
