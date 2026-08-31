import { Directory, File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

/**
 * The platform actions a WebView cannot perform for itself.
 *
 * Everything else Noto does — the editor, the screens, storage — happens either
 * inside the WebView or over the SQL bridge. These two need the operating
 * system.
 */

/**
 * Hands a document to Android's print service.
 *
 * `window.print()` does nothing inside a WebView, so the interface serialises
 * the open document with `documentToHtml` and sends the markup here instead.
 * This is the one output in Noto that is not the same render as web and
 * desktop, which print the live page through the print stylesheet. Both are
 * built from the same document and styled to match, and PDF export on every
 * platform goes through print, so they stay comparable — but they are not
 * pixel-identical, and a change to one does not change the other.
 */
export async function printHtml(html: string): Promise<null> {
  await Print.printAsync({ html });
  return null;
}

export interface SaveFileRequest {
  fileName: string;
  contents: string;
  mimeType: string;
}

/**
 * Writes an exported document out and offers it to the share sheet.
 *
 * A phone has no download folder an application may write to unasked, so the
 * file goes to Noto's own cache — where Android is free to reclaim it once the
 * user has put it somewhere — and the share sheet is how it reaches another
 * application. A dismissed sheet is a decision, not a failure, and
 * `shareAsync` resolves either way.
 */
export async function saveFile({ fileName, contents, mimeType }: SaveFileRequest): Promise<null> {
  /*
   * The name is built from a slugified document title on the other side, so it
   * is already safe. It is checked again here because this is where a name
   * turns into a filesystem path, and that is the wrong place to be trusting
   * anything that came out of a document.
   */
  if (fileName.includes('/') || fileName.includes('\\') || fileName.includes('..')) {
    throw new Error(`Noto will not write a file named “${fileName}”.`);
  }

  const directory = new Directory(Paths.cache, 'exports');
  if (!directory.exists) directory.create({ intermediates: true });

  const file = new File(directory, fileName);
  file.create({ overwrite: true, intermediates: true });
  file.write(contents);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: fileName });
  }

  return null;
}
