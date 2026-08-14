#!/usr/bin/env node
/**
 * Walks through preparing a release locally, so the only thing left to do is
 * push a tag.
 *
 *   pnpm release:prepare 1.0.0
 *
 * It sets the version everywhere, creates the release-notes stub if it is
 * missing, and then prints exactly which commands to run. It deliberately does
 * not commit, tag or push: publishing is irreversible, and the release notes
 * want a human's words in them before any of that happens.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fail(message) {
  process.stderr.write(`prepare-release: ${message}\n`);
  process.exit(1);
}

function run(command, args) {
  return execFileSync(command, args, { cwd: root, encoding: 'utf8' }).trim();
}

const version = process.argv[2];
if (!version) fail('usage: prepare-release.mjs <version>   e.g. 1.0.0 or 1.1.0-beta.1');

// A dirty tree here means the version bump would be committed together with
// unrelated work, which makes the release commit impossible to read later.
let status;
try {
  status = run('git', ['status', '--porcelain']);
} catch {
  fail('this does not look like a Git repository.');
}

if (status) {
  fail(`the working tree has uncommitted changes:\n${status}\n\nCommit or stash them first.`);
}

const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
if (branch !== 'main' && !branch.startsWith('release/') && !branch.startsWith('hotfix/')) {
  process.stderr.write(
    `prepare-release: warning — you are on "${branch}". Releases are normally prepared on a ` +
      `release/* branch and tagged from main.\n\n`,
  );
}

// 1. Version.
execFileSync(process.execPath, ['scripts/version.mjs', 'set', version], {
  cwd: root,
  stdio: 'inherit',
});

// 2. Release notes stub.
const notesDir = path.join(root, 'docs', 'releases');
const notesFile = path.join(notesDir, `${version}.md`);

if (!existsSync(notesFile)) {
  mkdirSync(notesDir, { recursive: true });
  writeFileSync(
    notesFile,
    [
      `## Highlights`,
      ``,
      `- `,
      ``,
      `## Improvements`,
      ``,
      `- `,
      ``,
      `## Bug fixes`,
      ``,
      `- `,
      ``,
    ].join('\n'),
    'utf8',
  );
  process.stdout.write(
    `\nCreated docs/releases/${version}.md — write the highlights before tagging.\n`,
  );
} else {
  process.stdout.write(`\ndocs/releases/${version}.md already exists; leaving it alone.\n`);
}

process.stdout.write(
  [
    ``,
    `Version set to ${version}. Next:`,
    ``,
    `  1. Write the release notes`,
    `       docs/releases/${version}.md`,
    ``,
    `  2. Add the summary to the website changelog`,
    `       apps/website/src/content/changelog.ts`,
    ``,
    `  3. Commit and open a pull request into main`,
    `       git checkout -b release/${version}`,
    `       git commit -am "chore(release): ${version}"`,
    `       git push -u origin release/${version}`,
    ``,
    `  4. Once it is merged, tag main — this is what starts the release`,
    `       git checkout main && git pull`,
    `       git tag v${version}`,
    `       git push origin v${version}`,
    ``,
  ].join('\n'),
);
