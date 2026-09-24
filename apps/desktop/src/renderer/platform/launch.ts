import { formatForFileName, parseRoute, receiveOpenedFiles, routeToHash } from '@noto/ui';

/**
 * What the operating system asked Noto to open, handed to the shared shell.
 *
 * Files go to the shell's queue, which makes documents of them once the
 * workspace is open. Links become routes: `noto://memory` opens Memory and
 * `noto://workspace/<id>` opens that document, the same links the phone
 * answers to.
 */

/**
 * The hash route a `noto://` link opens, or `null` when it names no screen.
 *
 * `noto://memory` puts the screen in the host and `noto:///memory` puts it in
 * the path; both are the same link. A link to something Noto has no screen for
 * opens nothing, rather than falling through to Home and looking like it
 * worked.
 */
export function routeHashFromLink(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'noto:') return null;

  const path = `${parsed.host}${parsed.pathname}`.replace(/^\/+/, '').replace(/\/+$/, '');
  if (path === '') return null;

  const route = parseRoute(`#/${path}`);
  if (route.name !== path.split('/')[0]) return null;

  return routeToHash(route);
}

async function takeLaunchRequests(): Promise<void> {
  const { files, links } = await window.notoLaunch.take();

  receiveOpenedFiles(
    files.map(({ path, name, text }) => ({
      file: { ref: path, label: path, name, format: formatForFileName(name) },
      text,
    })),
  );

  // Only the last link matters: each one replaces the screen the one before opened.
  const hash = links
    .map(routeHashFromLink)
    .filter((candidate): candidate is string => candidate !== null)
    .at(-1);
  if (hash) window.location.hash = hash;
}

/** Takes what is already waiting, then whatever arrives later. Returns the unsubscribe. */
export function subscribeToLaunchRequests(): () => void {
  const take = () => void takeLaunchRequests().catch(() => undefined);

  const unsubscribe = window.notoLaunch.onAvailable(take);
  take();

  return unsubscribe;
}
