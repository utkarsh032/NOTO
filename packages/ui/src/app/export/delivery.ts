import { slugify } from '@noto/core';
import type { NotoDocument } from '@noto/types';

import { documentToDocx } from '../docx';
import { EXPORT_FORMATS, type ExportFormat } from './formats';
import { serialiseDocument } from './serialise';

/* -------------------------------------------------------------------------- */
/* Delivery                                                                   */
/* -------------------------------------------------------------------------- */

/** A file Noto is ready to hand over, once a platform decides how. */
export interface DownloadRequest {
  /** The name Noto would give the file, extension included. */
  fileName: string;
  /** The serialised document: text, or bytes for a binary format. */
  contents: string | Uint8Array;
  mimeType: string;
  format: ExportFormat;
}

export type DownloadHandler = (request: DownloadRequest) => void | Promise<void>;

let downloadHandler: DownloadHandler | null = null;

/**
 * Installs the platform's save implementation, replacing any previous one.
 *
 * Registered rather than passed down, for the same reason the print handler is:
 * exactly one exists per running application and it is set once at startup.
 *
 * Web and desktop leave this unset — an anchor download is the right answer in
 * a browser tab and in Electron's renderer alike. Mobile sets it, because a
 * WebView has nowhere to download *to*: the file has to cross into the native
 * side to reach the share sheet.
 */
export function setDownloadHandler(next: DownloadHandler | null): void {
  downloadHandler = next;
}

/**
 * Hands the file to the platform.
 *
 * An object URL and a synthetic click, unless a handler is installed: that is
 * the only route that works identically in a browser tab and inside Electron's
 * renderer, and it never sends the document anywhere. The URL is revoked on the
 * next tick, once the download has been handed off.
 *
 * The return value says the export was *accepted*, not that it finished. A
 * handler runs on its own; the anchor path has never reported completion
 * either, since a browser download outlives the click that started it.
 */
export function downloadDocument(
  document: Pick<NotoDocument, 'title' | 'content'>,
  format: ExportFormat,
): boolean {
  const info = EXPORT_FORMATS.find((candidate) => candidate.id === format);
  if (!info?.supported) return false;

  const contents =
    format === 'docx' ? documentToDocx(document) : serialiseDocument(document, format);
  const fileName = `${slugify(document.title || 'untitled') || 'untitled'}.${info.extension}`;

  deliverFile({ fileName, contents, mimeType: info.mimeType, format });

  return true;
}

/**
 * Hands a finished file to the platform, by whichever route it has.
 *
 * Separate from `downloadDocument` because export is not the only thing that
 * ends in a download: a browser without a file picker saves a document the same
 * way, and on a phone both have to cross into the native side to reach the
 * share sheet. One delivery, whatever asked for it.
 */
export function deliverFile(request: DownloadRequest): void {
  // Captured before the await: a handler torn down mid-export would otherwise
  // turn into a silent no-op, after the dialog has already said "Exported".
  const handler = downloadHandler;

  if (handler) {
    void (async () => {
      try {
        await handler(request);
      } catch (error) {
        // A dismissed share sheet arrives here alongside a real failure, and
        // neither is a reason to take the editor down around them.
        console.error('Noto could not export the document.', error);
      }
    })();

    return;
  }

  const blob =
    typeof request.contents === 'string'
      ? new Blob([request.contents], { type: `${request.mimeType};charset=utf-8` })
      : new Blob([request.contents as Uint8Array<ArrayBuffer>], { type: request.mimeType });
  const url = URL.createObjectURL(blob);

  const anchor = window.document.createElement('a');
  anchor.href = url;
  anchor.download = request.fileName;
  window.document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  setTimeout(() => URL.revokeObjectURL(url), 0);
}
