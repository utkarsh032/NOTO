/**
 * Printing a document.
 *
 * What actually prints is decided by the print stylesheet, not by this module:
 * the sidebar, the header, the tab bar, the toolbar and the find bar are all
 * marked to disappear, leaving the document itself on the page. That is what
 * makes the web and desktop output identical, and it is why there is no second
 * render path to keep in step with the editor.
 *
 * `window.print()` is the whole implementation on web. Desktop registers its
 * own handler, because Electron's renderer has no print preview of its own and
 * the main process can hand the job to the operating system properly.
 */

export type PrintHandler = () => void | Promise<void>;

let handler: PrintHandler | null = null;

/**
 * Installs the platform's print implementation, replacing any previous one.
 *
 * Registered rather than passed down for the same reason the editor's
 * interactive-command handler is: exactly one exists per running application,
 * it is set once at startup, and threading it through every component between
 * the shell and the toolbar would be ceremony around a constant.
 */
export function setPrintHandler(next: PrintHandler | null): void {
  handler = next;
}

/**
 * Sends the open document to the printer.
 *
 * Failure is reported but not raised: a print dialog the user dismissed and a
 * printer that is not there both arrive here, and neither is a reason to take
 * down the editor around them.
 */
export async function printDocument(): Promise<void> {
  try {
    if (handler) {
      await handler();
      return;
    }

    window.print();
  } catch (error) {
    console.error('Noto could not print the document.', error);
  }
}
