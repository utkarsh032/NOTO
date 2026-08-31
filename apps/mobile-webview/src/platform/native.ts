import type { NotoDocument } from '@noto/types';
import { documentToHtml, setDownloadHandler, setPrintHandler } from '@noto/ui';

import { onNativeEvent, requestFromNative, type BridgeInsets } from './bridge';

type Printable = Pick<NotoDocument, 'title' | 'content'> | null;

let printable: Printable = null;

/**
 * Tells the print handler which document is open.
 *
 * `setPrintHandler` takes no arguments — on web the browser prints whatever is
 * on screen — so the document has to reach the handler some other way. A module
 * variable kept current by the shell is the smallest thing that works, and
 * there is only ever one open document to track.
 */
export function setPrintableDocument(document: Printable): void {
  printable = document;
}

/**
 * Installs the platform actions a WebView cannot perform for itself.
 *
 * Printing: `window.print()` does nothing in an Android WebView, so the
 * document is serialised and handed to the system print service natively. This
 * is the one place mobile output is not pixel-identical to web and desktop —
 * those print the live page through the print stylesheet, while this prints the
 * standalone HTML that `documentToHtml` already produces for export. The two
 * are built from the same document and styled to match, but they are not the
 * same render.
 *
 * Saving: an anchor download has nowhere to go on Android, so the file crosses
 * to the native side, is written to the app's cache and offered to the share
 * sheet — which is how a phone hands a file to another application.
 */
export function installNativeHandlers(): () => void {
  setPrintHandler(async () => {
    if (!printable) return;
    await requestFromNative<void>('print', { html: documentToHtml(printable) });
  });

  setDownloadHandler(async ({ fileName, contents, mimeType }) => {
    await requestFromNative<void>('file.save', { fileName, contents, mimeType });
  });

  return () => {
    setPrintHandler(null);
    setDownloadHandler(null);
  };
}

/**
 * Mirrors the device's safe-area insets into CSS custom properties.
 *
 * `env(safe-area-inset-*)` is not answered for the system bars inside an
 * Android WebView, so the sizes are measured natively and pushed in. The
 * initial values are zero, which is right: an inset that has not arrived yet
 * should cost no layout rather than guess at one.
 */
export function installSafeAreaInsets(): () => void {
  const apply = (insets: BridgeInsets) => {
    const style = window.document.documentElement.style;
    style.setProperty('--noto-safe-top', `${insets.top}px`);
    style.setProperty('--noto-safe-bottom', `${insets.bottom}px`);
    style.setProperty('--noto-safe-left', `${insets.left}px`);
    style.setProperty('--noto-safe-right', `${insets.right}px`);
  };

  return onNativeEvent<BridgeInsets>('insets', apply);
}
