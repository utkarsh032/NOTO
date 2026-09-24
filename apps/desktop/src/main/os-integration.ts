import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

import { app } from 'electron';

import { ASSOCIATED_EXTENSIONS } from './launch-arguments';

/**
 * Telling the operating system what Noto opens.
 *
 * macOS and Linux read it from the package: `forge.config.ts` writes the
 * document types and the `noto` scheme into the application bundle's
 * Info.plist and into the `.desktop` entry the deb and rpm install. Windows
 * has no such manifest for a Squirrel install, so it is written into the
 * registry here, when Squirrel runs Noto with `--squirrel-install`, and taken
 * out again on `--squirrel-uninstall`.
 *
 * Everything goes under HKEY_CURRENT_USER, where a per-user Squirrel install
 * may write without asking for elevation, and Noto is added to "Open with"
 * rather than made the default. Taking over `.txt` from Notepad is the user's
 * decision to make in Settings, not an installer's to make for them.
 */

export const LINK_SCHEME = 'noto';

const PROG_ID = 'Noto.Document';

/** A registry key under the current user's file classes. */
function classesKey(...parts: string[]): string {
  return ['HKCU', 'Software', 'Classes', ...parts].join('\\');
}

/**
 * The executable to register.
 *
 * Squirrel installs each version in its own `app-x.y.z` folder and keeps a
 * small stub of the same name one level up that always launches the newest.
 * Registering the versioned path would break at the first update.
 */
function stableExecutable(): string {
  const stub = path.resolve(path.dirname(process.execPath), '..', path.basename(process.execPath));
  return existsSync(stub) ? stub : process.execPath;
}

function reg(args: string[]): void {
  try {
    execFileSync('reg.exe', args, { stdio: 'ignore', windowsHide: true });
  } catch {
    // A key that is already there or already gone. Neither should stop an install.
  }
}

function registerFileTypes(executable: string): void {
  const command = `"${executable}" "%1"`;

  const application = ['Applications', path.basename(executable)];

  reg(['add', classesKey(PROG_ID), '/ve', '/d', 'Noto document', '/f']);
  reg(['add', classesKey(PROG_ID, 'DefaultIcon'), '/ve', '/d', `${executable},0`, '/f']);
  reg(['add', classesKey(PROG_ID, 'shell', 'open', 'command'), '/ve', '/d', command, '/f']);
  reg(['add', classesKey(...application, 'shell', 'open', 'command'), '/ve', '/d', command, '/f']);

  for (const extension of ASSOCIATED_EXTENSIONS) {
    reg([
      'add',
      classesKey(`.${extension}`, 'OpenWithProgids'),
      '/v',
      PROG_ID,
      '/t',
      'REG_NONE',
      '/f',
    ]);
    reg([
      'add',
      classesKey(...application, 'SupportedTypes'),
      '/v',
      `.${extension}`,
      '/d',
      '',
      '/f',
    ]);
  }
}

function unregisterFileTypes(executable: string): void {
  for (const extension of ASSOCIATED_EXTENSIONS) {
    reg(['delete', classesKey(`.${extension}`, 'OpenWithProgids'), '/v', PROG_ID, '/f']);
  }

  reg(['delete', classesKey('Applications', path.basename(executable)), '/f']);
  reg(['delete', classesKey(PROG_ID), '/f']);
  reg(['delete', classesKey(LINK_SCHEME), '/f']);
}

/**
 * Runs Noto's part of a Squirrel install, update or uninstall. Windows only.
 *
 * Called before `electron-squirrel-startup` quits the process, which it does
 * for every one of these events: Squirrel is waiting on it, and runs nothing
 * else until it exits.
 */
export function handleSquirrelEvent(argv: readonly string[]): void {
  if (process.platform !== 'win32') return;

  const executable = stableExecutable();

  switch (argv[1]) {
    case '--squirrel-install':
    case '--squirrel-updated':
      registerFileTypes(executable);
      app.setAsDefaultProtocolClient(LINK_SCHEME, executable);
      break;
    case '--squirrel-uninstall':
      unregisterFileTypes(executable);
      break;
    default:
      break;
  }
}

/**
 * Claims `noto://` at every launch.
 *
 * Cheap, and it repairs a registration another install or an older version
 * overwrote. Only a packaged build does it: from source, the "application" is
 * Electron itself pointed at a folder, and registering that would leave links
 * opening a development checkout long after it was deleted.
 */
export function claimLinkScheme(): void {
  if (!app.isPackaged) return;

  if (process.platform === 'win32') {
    app.setAsDefaultProtocolClient(LINK_SCHEME, stableExecutable());
  } else {
    app.setAsDefaultProtocolClient(LINK_SCHEME);
  }
}
