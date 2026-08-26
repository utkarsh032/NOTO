/**
 * URL handling for the links and images a document can contain.
 *
 * Document content is user data that later gets rendered as HTML, exported and
 * — once §7 sync lands — shared. A `javascript:` href pasted into a note would
 * be a stored cross-site scripting bug, so schemes are checked against an
 * allowlist here rather than trusted anywhere downstream.
 */

/** Schemes a link may point at. */
const LINK_SCHEMES = ['http:', 'https:', 'mailto:', 'tel:'];

/** Schemes an image may load from. `data:` is allowed so a pasted image survives. */
const IMAGE_SCHEMES = ['http:', 'https:', 'data:'];

/** Matches a value that already carries a scheme, e.g. `https:` or `mailto:`. */
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/iu;

function parse(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

/**
 * Cleans up a URL typed into the link dialog, or returns `null` when it cannot
 * be made into a safe one.
 *
 * A bare host is the common case — people type `noto.app`, not
 * `https://noto.app` — so a value with no scheme gets `https://`. An explicit
 * scheme is never rewritten, only accepted or rejected.
 */
export function normalizeLinkHref(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;

  const candidate = HAS_SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`;

  const url = parse(candidate);
  if (!url) return null;
  if (!LINK_SCHEMES.includes(url.protocol)) return null;

  // `https://` on its own parses, and would produce a link to nowhere.
  if (url.protocol.startsWith('http') && url.hostname === '') return null;

  return url.href;
}

/** The same check for image sources, which may also be inline `data:` URIs. */
export function normalizeImageSrc(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;

  const candidate = HAS_SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`;

  // `new URL` accepts any `data:` payload, so the media type is checked here
  // instead: `data:text/html` is a script vector, `data:image/*` is a picture.
  if (/^data:/iu.test(candidate)) {
    return /^data:image\/[a-z0-9.+-]+[;,]/iu.test(candidate) ? candidate : null;
  }

  const url = parse(candidate);
  if (!url) return null;
  if (!IMAGE_SCHEMES.includes(url.protocol)) return null;
  if (url.hostname === '') return null;

  return url.href;
}
