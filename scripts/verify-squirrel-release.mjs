#!/usr/bin/env node
/**
 * Proves that a collected Windows release is internally consistent before it is
 * published.
 *
 *   node scripts/verify-squirrel-release.mjs \
 *     --dir build/Production/stable/1.0.0 --version 1.0.0 --arch x64
 *
 * Squirrel.Windows does not read the installer when it updates an existing
 * installation. It fetches `RELEASES`, takes the SHA1 and byte count recorded
 * there, downloads the `.nupkg` named on that line, and refuses the update if
 * either value disagrees. That manifest is therefore the only thing standing
 * between a good build and a fleet that silently stops updating — and nothing
 * else in the pipeline ever reads it. A mismatch surfaces months later as
 * "nobody is upgrading", with no error anywhere.
 *
 * So the checks here recompute the hash exactly as Squirrel does — SHA1, hex,
 * upper case, over the whole `.nupkg` — rather than trusting that the maker
 * that wrote the file and the maker that wrote the manifest agreed.
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

function fail(message) {
  process.stderr.write(`verify-squirrel-release: ${message}\n`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i].startsWith('--')) fail(`unexpected argument "${argv[i]}"`);
    args[argv[i].slice(2)] = argv[i + 1];
  }
  return args;
}

const { dir, version, arch = 'x64' } = parseArgs(process.argv.slice(2));
if (!dir || !version) fail('usage: --dir <release dir> --version <x.y.z> [--arch x64]');

const releaseDir = path.resolve(dir);
if (!existsSync(releaseDir)) fail(`release directory not found: ${releaseDir}`);

/** Everything actually present, so a failure can say what WAS produced. */
const present = readdirSync(releaseDir);
const listing = present.length > 0 ? present.join(', ') : '(empty)';

// ── The installer, by exact name ─────────────────────────────────────────────
//
// Looked up by the name this version must have, never by a `*.exe` glob. A
// glob returns entries in directory order, so a leftover installer from an
// earlier version would be picked up and shipped under the new version's
// release notes without anything appearing to go wrong.
const installerName = `Noto-${version}-win-${arch}.exe`;
const installerPath = path.join(releaseDir, installerName);

if (!existsSync(installerPath)) {
  fail(
    `expected installer "${installerName}" but it is not in ${releaseDir}.\n` +
      `  Found: ${listing}\n` +
      `  Fix: confirm -Version matches the workspace version, and that the Squirrel maker ran.`,
  );
}

// ── The update manifest ──────────────────────────────────────────────────────
const releasesPath = path.join(releaseDir, 'RELEASES');
if (!existsSync(releasesPath)) {
  fail(
    `"RELEASES" is missing from ${releaseDir}.\n` +
      `  Found: ${listing}\n` +
      `  Without it every installed client stops receiving updates. Fix: check the ` +
      `Squirrel maker's output in apps/desktop/out/make.`,
  );
}

// electron-winstaller writes RELEASES with a UTF-8 BOM. Left in place it
// becomes part of the first hash field, so the comparison below would fail on a
// perfectly good build.
const manifest = readFileSync(releasesPath, 'utf8').replace(/^﻿/, '');

const entries = manifest
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => {
    const [hash, file, size] = line.split(/\s+/);
    return { hash, file, size: Number(size), line };
  });

if (entries.length === 0) fail(`"RELEASES" is empty. Expected at least one full package entry.`);

// A delta entry names a base version; only the full package is verified here,
// because that is what a fresh install and a first update both download.
const full = entries.filter((entry) => /-full\.nupkg$/i.test(entry.file));
if (full.length === 0) {
  fail(
    `"RELEASES" names no -full.nupkg entry.\n  Entries: ${entries.map((e) => e.file).join(', ')}`,
  );
}

let checked = 0;

for (const entry of full) {
  // ── The manifest must describe THIS version ──
  //
  // Squirrel derives the version it is offering from the package file name. If
  // the manifest carries a stale entry, clients are told an old build is the
  // newest one and will never move forward.
  if (!entry.file.includes(version)) {
    fail(
      `"RELEASES" advertises "${entry.file}", which is not version ${version}.\n` +
        `  This release would tell every client that a different version is the latest.\n` +
        `  Fix: clear apps/desktop/out and build again — this is a stale manifest.`,
    );
  }

  const packagePath = path.join(releaseDir, entry.file);
  if (!existsSync(packagePath)) {
    fail(
      `"RELEASES" names "${entry.file}" but that file was not collected into ${releaseDir}.\n` +
        `  Found: ${listing}\n` +
        `  Clients would follow the manifest to a 404. Fix: check the collect step.`,
    );
  }

  const actualSize = statSync(packagePath).size;
  if (actualSize !== entry.size) {
    fail(
      `size mismatch for "${entry.file}".\n` +
        `  RELEASES says: ${entry.size} bytes\n` +
        `  On disk:       ${actualSize} bytes\n` +
        `  Squirrel rejects a payload whose length disagrees with the manifest.`,
    );
  }

  // Recomputed the way Squirrel does it, not copied from the maker's own
  // output — the point of the check is to catch the case where those two
  // disagree.
  const actualHash = createHash('sha1')
    .update(readFileSync(packagePath))
    .digest('hex')
    .toUpperCase();

  if (actualHash !== (entry.hash || '').toUpperCase()) {
    fail(
      `SHA1 mismatch for "${entry.file}".\n` +
        `  RELEASES says: ${entry.hash}\n` +
        `  Recomputed:    ${actualHash}\n` +
        `  Every client would reject this update as corrupt. Do not publish this build.`,
    );
  }

  checked += 1;
  process.stdout.write(`  [OK] ${entry.file}  SHA1 ${actualHash}  ${actualSize} bytes\n`);
}

process.stdout.write(`  [OK] ${installerName}\n`);
process.stdout.write(
  `Verified ${checked} package entr${checked === 1 ? 'y' : 'ies'} against RELEASES.\n`,
);
