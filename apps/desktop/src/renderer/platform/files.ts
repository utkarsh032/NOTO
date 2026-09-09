import { formatForFileName, type LocalFileGateway } from '@noto/ui';

/**
 * Files on disk, as the shared shell sees them on the desktop.
 *
 * A thin translation and nothing more. The main process owns the dialogs and
 * the file system; the shell owns what Save, Save As and Open mean and what to
 * say about them; and this maps one vocabulary onto the other. A file's `ref`
 * here is simply its path, which is also what the user is shown — a document
 * saved to `C:\Users\…\notes.md` should say so, not just "notes.md".
 */
export const desktopLocalFileGateway: LocalFileGateway = {
  // Electron writes to a real path, so a chosen file stays chosen.
  canWriteInPlace: true,

  async open() {
    const opened = await window.notoFiles.open();
    if (!opened) return null;

    return opened.map(({ path, name, text }) => ({
      file: { ref: path, label: path, name, format: formatForFileName(name) },
      text,
    }));
  },

  async saveAs(target) {
    const chosen = await window.notoFiles.saveAs(target.suggestedName);
    if (!chosen) return null;

    // The extension the user typed in the dialog is how they asked for a format.
    const format = formatForFileName(chosen.name);

    const result = await window.notoFiles.write(chosen.path, target.serialise(format));
    if (!result.written) throw new Error(result.reason ?? 'Noto could not write the file.');

    return { ref: chosen.path, label: chosen.path, name: chosen.name, format };
  },

  async read(file) {
    const result = await window.notoFiles.read(file.ref);
    if (result.text === null) throw new Error(result.reason ?? 'Noto could not read that file.');

    return result.text;
  },

  async write(file, contents) {
    const result = await window.notoFiles.write(file.ref, contents);
    if (!result.written) throw new Error(result.reason ?? 'Noto could not write the file.');
  },
};
