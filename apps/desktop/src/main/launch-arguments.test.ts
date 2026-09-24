import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { asNotoLink, isAssociatedFile, launchTargets } from './launch-arguments';

describe('launchTargets', () => {
  const cwd = path.resolve('/work');

  it('keeps associated files and noto links, and drops everything else', () => {
    const targets = launchTargets(
      [
        'noto.exe',
        '--squirrel-firstrun',
        '--allow-file-access-from-files',
        '.',
        'notes.md',
        path.resolve('/docs/todo.TXT'),
        'noto://memory',
        'report.pdf',
        'https://example.com',
      ],
      cwd,
    );

    expect(targets.files).toEqual([path.join(cwd, 'notes.md'), path.resolve('/docs/todo.TXT')]);
    expect(targets.links).toEqual(['noto://memory']);
  });

  it('never treats the executable itself as a file to open', () => {
    expect(launchTargets(['readme.md'], cwd)).toEqual({ files: [], links: [] });
  });
});

describe('asNotoLink', () => {
  it('accepts only the noto scheme', () => {
    expect(asNotoLink('noto://workspace/abc')).toBe('noto://workspace/abc');
    expect(asNotoLink('file:///etc/passwd')).toBeNull();
    expect(asNotoLink('not a url')).toBeNull();
  });

  it('refuses a link long enough to be a document', () => {
    expect(asNotoLink(`noto://memory/${'x'.repeat(4096)}`)).toBeNull();
  });
});

describe('isAssociatedFile', () => {
  it('matches the registered extensions in any case', () => {
    expect(isAssociatedFile('a.md')).toBe(true);
    expect(isAssociatedFile('a.Markdown')).toBe(true);
    expect(isAssociatedFile('a.txt')).toBe(true);
    expect(isAssociatedFile('a.html')).toBe(false);
    expect(isAssociatedFile('md')).toBe(false);
  });
});
