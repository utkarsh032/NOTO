#!/usr/bin/env node
/**
 * Copies the packages Electron Forge produced into a flat directory using the
 * canonical Noto release names.
 *
 *   node scripts/collect-desktop-artifacts.mjs \
 *     --platform win32 --arch x64 --version 1.0.0 --out build
 *
 * Forge writes each maker's output to its own nested directory with a name of
 * that maker's choosing. Release assets, by contrast, all sit in one flat list
 * on the GitHub Release page, so they need names that state the product,
 * version, platform and architecture on their own:
 *
 *   Noto-1.0.0-win-x64.exe
 *   Noto-1.0.0-mac-arm64.dmg
 *   Noto-1.0.0-linux-x64.AppImage
 */

import { copyFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Mirrors `outDir` in apps/desktop/forge.config.ts: when a build had to be
// redirected to a fresh output directory, collection has to follow it there.
const FORGE_OUT = process.env.NOTO_FORGE_OUT
  ? path.resolve(root, 'apps', 'desktop', process.env.NOTO_FORGE_OUT)
  : path.join(root, 'apps', 'desktop', 'out');

const MAKE_DIR = path.join(FORGE_OUT, 'make');

const PLATFORM_LABEL = { win32: 'win', darwin: 'mac', linux: 'linux' };

function fail(message) {
  process.stderr.write(`collect-desktop-artifacts: ${message}\n`);
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

function walk(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...walk(full));
    else found.push(full);
  }
  return found;
}

const { platform, arch, version, out } = parseArgs(process.argv.slice(2));
if (!platform || !arch || !version || !out) {
  fail('usage: --platform <win32|darwin|linux> --arch <x64|arm64> --version <x.y.z> --out <dir>');
}

const label = PLATFORM_LABEL[platform];
if (!label) fail(`unknown platform "${platform}"`);

const base = `Noto-${version}-${label}-${arch}`;

/**
 * Squirrel.Windows updates are driven by a `RELEASES` manifest and the `.nupkg`
 * files it names, all of which must keep the exact names Squirrel generated and
 * all of which live at the root of the release. Two architectures cannot both
 * own that manifest, so only x64 — the architecture the update service serves —
 * contributes it. arm64 ships as an installer download only.
 */
const isUpdateFeedArch = arch === 'x64';

/** @returns {string | null} the release asset name, or null to skip the file. */
function targetName(file) {
  const name = path.basename(file);
  const ext = path.extname(name).toLowerCase();

  if (name === 'RELEASES') return isUpdateFeedArch ? 'RELEASES' : null;

  switch (ext) {
    case '.nupkg':
      return isUpdateFeedArch ? name : null;
    case '.exe':
      return `${base}.exe`;
    case '.msi':
      return `${base}.msi`;
    case '.dmg':
      return `${base}.dmg`;
    case '.zip':
      // Squirrel.Mac consumes the zip; it is the macOS update payload as well
      // as a download for users who prefer not to mount a disk image.
      return `${base}.zip`;
    case '.appimage':
      return `${base}.AppImage`;
    case '.deb':
      return `${base}.deb`;
    case '.rpm':
      return `${base}.rpm`;
    default:
      return null;
  }
}

let files;
try {
  files = walk(MAKE_DIR);
} catch {
  fail(`no maker output at ${MAKE_DIR}. Did \`electron-forge make\` run?`);
}

const outDir = path.resolve(root, out);
mkdirSync(outDir, { recursive: true });

const collected = [];
const skipped = [];

for (const file of files) {
  const name = targetName(file);
  if (!name) {
    skipped.push(path.relative(MAKE_DIR, file));
    continue;
  }

  const destination = path.join(outDir, name);
  copyFileSync(file, destination);
  collected.push(`${name}  (${(statSync(destination).size / 1024 / 1024).toFixed(1)} MB)`);
}

if (collected.length === 0) {
  fail(`no recognised packages found under ${MAKE_DIR}. Skipped: ${skipped.join(', ') || 'none'}`);
}

process.stdout.write(`Collected ${collected.length} asset(s) into ${out}:\n`);
for (const line of collected.sort()) process.stdout.write(`  ${line}\n`);
if (skipped.length > 0) process.stdout.write(`Skipped: ${skipped.join(', ')}\n`);
