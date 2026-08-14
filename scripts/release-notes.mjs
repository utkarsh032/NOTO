#!/usr/bin/env node
/**
 * Composes the body of a GitHub Release.
 *
 *   node scripts/release-notes.mjs --version 1.0.0 --channel stable \
 *     --repository owner/NOTO --assets staging --out notes.md
 *
 * The handwritten part of the notes lives in `docs/releases/<version>.md` and
 * is written during release preparation. Everything mechanical — the download
 * table, the checksums note, the system requirements — is generated here from
 * the assets that were actually built, so the notes cannot promise a download
 * that does not exist. GitHub's own generated changelog is appended by the
 * workflow below whatever this produces.
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fail(message) {
  process.stderr.write(`release-notes: ${message}\n`);
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

const { version, channel, repository, assets, out } = parseArgs(process.argv.slice(2));
if (!version || !channel || !repository || !assets || !out) {
  fail(
    'usage: --version <x.y.z> --channel <name> --repository <owner/repo> --assets <dir> --out <file>',
  );
}

const downloadBase = `https://github.com/${repository}/releases/download/v${version}`;

/** Assets are grouped the way the download page groups them. */
const GROUPS = [
  {
    title: 'Windows',
    rows: [
      { label: 'Installer (x64)', match: (n) => n === `Noto-${version}-win-x64.exe` },
      { label: 'Installer (ARM64)', match: (n) => n === `Noto-${version}-win-arm64.exe` },
    ],
  },
  {
    title: 'macOS',
    rows: [
      { label: 'Disk image (Apple Silicon)', match: (n) => n === `Noto-${version}-mac-arm64.dmg` },
      { label: 'Disk image (Intel)', match: (n) => n === `Noto-${version}-mac-x64.dmg` },
      { label: 'Archive (Apple Silicon)', match: (n) => n === `Noto-${version}-mac-arm64.zip` },
      { label: 'Archive (Intel)', match: (n) => n === `Noto-${version}-mac-x64.zip` },
    ],
  },
  {
    title: 'Linux',
    rows: [
      { label: 'AppImage (x64)', match: (n) => n === `Noto-${version}-linux-x64.AppImage` },
      { label: 'Debian package (x64)', match: (n) => n === `Noto-${version}-linux-x64.deb` },
      { label: 'RPM package (x64)', match: (n) => n === `Noto-${version}-linux-x64.rpm` },
    ],
  },
  {
    title: 'Android',
    rows: [
      { label: 'APK (testing)', match: (n) => n === `Noto-${version}-android.apk` },
      { label: 'App bundle (Play Store)', match: (n) => n === `Noto-${version}-android.aab` },
    ],
  },
];

const present = new Set(readdirSync(path.resolve(root, assets)));

const sections = [];

// ── Handwritten notes ────────────────────────────────────────────────────────
const handwritten = path.join(root, 'docs', 'releases', `${version}.md`);
if (existsSync(handwritten)) {
  sections.push(readFileSync(handwritten, 'utf8').trim());
} else {
  sections.push(
    `_No handwritten notes were provided for this release. Add \`docs/releases/${version}.md\` ` +
      `before tagging to describe the highlights in your own words._`,
  );
}

if (channel !== 'stable') {
  sections.push(
    `> **This is a ${channel} release.** It is published for testing on the \`${channel}\` update ` +
      `channel and is not offered to users on \`stable\`.`,
  );
}

// ── Downloads ────────────────────────────────────────────────────────────────
const downloadLines = ['## Downloads', ''];
let anyDownload = false;

for (const group of GROUPS) {
  const available = group.rows.filter((row) => [...present].some((name) => row.match(name)));
  if (available.length === 0) continue;

  anyDownload = true;
  downloadLines.push(`### ${group.title}`, '', '| Package | File |', '| --- | --- |');
  for (const row of available) {
    const name = [...present].find((candidate) => row.match(candidate));
    downloadLines.push(`| ${row.label} | [${name}](${downloadBase}/${name}) |`);
  }
  downloadLines.push('');
}

if (anyDownload) {
  downloadLines.push(
    'The web application needs no download and is always at the latest version.',
    '',
  );
  sections.push(downloadLines.join('\n').trim());
}

// ── Verification ─────────────────────────────────────────────────────────────
if (present.has('SHA256SUMS.txt')) {
  sections.push(
    [
      '## Verifying a download',
      '',
      `Checksums for every asset are published as [SHA256SUMS.txt](${downloadBase}/SHA256SUMS.txt).`,
      '',
      '```bash',
      'sha256sum --check --ignore-missing SHA256SUMS.txt',
      '```',
    ].join('\n'),
  );
}

// ── Updating ─────────────────────────────────────────────────────────────────
sections.push(
  [
    '## Updating',
    '',
    'Windows and macOS installations update themselves: Noto checks for a new version on ' +
      'startup, downloads it in the background, and applies it on the next restart.',
    '',
    'On Linux, replace the AppImage or install the new `.deb`/`.rpm` through your package manager.',
  ].join('\n'),
);

// ── System requirements ──────────────────────────────────────────────────────
sections.push(
  [
    '## System requirements',
    '',
    '| Platform | Requirements |',
    '| --- | --- |',
    '| Windows | Windows 10 or later, x64 or ARM64, 4 GB RAM, 500 MB storage |',
    '| macOS | A supported modern macOS version, Apple Silicon or Intel, 4 GB RAM, 500 MB storage |',
    '| Linux | x64, 4 GB RAM, 500 MB storage |',
    '| Web | A current version of Chrome, Edge, Firefox or Safari |',
    '',
    `Full details: [System requirements](https://github.com/${repository}/blob/main/docs/releases/system-requirements.md)`,
  ].join('\n'),
);

writeFileSync(path.resolve(root, out), `${sections.join('\n\n---\n\n')}\n`, 'utf8');
process.stdout.write(`Wrote release notes for ${version} (${channel}) to ${out}\n`);
