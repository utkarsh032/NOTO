import path from 'node:path';

/**
 * The file types Noto registers for with the operating system.
 *
 * Deliberately the plain-text ones. Noto can open HTML and its own JSON, but
 * offering to be the application for every `.html` on the machine would be
 * taking something from the browser the user did not ask to give up.
 */
export const ASSOCIATED_EXTENSIONS = ['md', 'markdown', 'txt'] as const;

/** Longer than any link Noto makes, short enough that nobody pastes a document into one. */
const LINK_LIMIT = 2048;

/** What a launch was asked to open, before anything has been read. */
export interface LaunchTargets {
  files: string[];
  links: string[];
}

/** A `noto://` link worth passing on, or `null`. The renderer decides what it means. */
export function asNotoLink(value: string): string | null {
  if (value.length > LINK_LIMIT) return null;

  try {
    return new URL(value).protocol === 'noto:' ? value : null;
  } catch {
    return null;
  }
}

/** Whether a path names one of the associated file types. Case does not matter. */
export function isAssociatedFile(filePath: string): boolean {
  const extension = path.extname(filePath).slice(1).toLowerCase();
  return (ASSOCIATED_EXTENSIONS as readonly string[]).includes(extension);
}

/**
 * Sorts a command line into files and links.
 *
 * Windows and Linux hand Noto what to open on its command line — at first
 * launch in `process.argv`, and in the `second-instance` event after that. The
 * same list also holds the executable, Chromium's switches, Squirrel's
 * `--squirrel-firstrun` and, in development, the path of the application, so
 * this keeps only what could be a request: a `noto://` link, or a path to an
 * associated file. Whether that file exists is the caller's question.
 *
 * Relative paths are resolved against the directory the launch came from,
 * which for a second instance is not this process's own.
 */
export function launchTargets(argv: readonly string[], workingDirectory: string): LaunchTargets {
  const targets: LaunchTargets = { files: [], links: [] };

  // The first entry is always the executable.
  for (const argument of argv.slice(1)) {
    if (argument.startsWith('-')) continue;

    const link = asNotoLink(argument);
    if (link) {
      targets.links.push(link);
      continue;
    }

    if (isAssociatedFile(argument)) {
      targets.files.push(path.resolve(workingDirectory, argument));
    }
  }

  return targets;
}
