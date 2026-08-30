#!/usr/bin/env node
/**
 * Keeps every release-facing version number in the workspace on one value.
 *
 * Noto releases as a single product, so the root manifest, the four apps, the
 * Expo app config and the `APP_VERSION` the interface displays all carry the
 * same semantic version. The release pipeline calls `set` from the pushed tag;
 * `check` is the guard that stops a tag being cut against a manifest that was
 * never bumped.
 *
 *   node scripts/version.mjs get
 *   node scripts/version.mjs set 1.0.0
 *   node scripts/version.mjs check 1.0.0
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Manifests that carry the product version. Workspace packages under */
/** `packages/` are internal and stay at 0.0.0; they are consumed by path. */
const MANIFESTS = [
  'package.json',
  'apps/web/package.json',
  'apps/website/package.json',
  'apps/desktop/package.json',
  'apps/mobile/package.json',
];

const EXPO_CONFIG = 'apps/mobile/app.json';

/**
 * The same version as a source constant, because the shared UI shows it and
 * cannot import a manifest on every platform.
 */
const APP_CONSTANT = 'packages/config/src/app.ts';
const APP_CONSTANT_PATTERN = /(export const APP_VERSION = ')([^']*)(';)/;

const ALL_FILES = [...MANIFESTS, EXPO_CONFIG, APP_CONSTANT];

// Semantic versioning, with the optional prerelease and build parts that the
// beta and nightly channels rely on.
const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

function fail(message) {
  process.stderr.write(`version: ${message}\n`);
  process.exit(1);
}

function readJson(relative) {
  return JSON.parse(readFileSync(path.join(root, relative), 'utf8'));
}

function writeJson(relative, value) {
  // Every manifest in this repository is Prettier-formatted: two spaces and a
  // trailing newline. Matching that keeps `set` out of the formatting diff.
  writeFileSync(path.join(root, relative), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

/**
 * Google Play requires a versionCode that only ever increases, and Apple wants
 * the same of CFBundleVersion. Deriving both from the semantic version keeps
 * them monotonic without a separate counter to forget to bump.
 */
function androidVersionCode(version) {
  const [major, minor, patch] = version.split('-')[0].split('.').map(Number);
  // Google Play rejects a versionCode below 1, which 0.0.0 would otherwise produce.
  return Math.max(1, major * 1_000_000 + minor * 1_000 + patch);
}

function readAppConstant() {
  const source = readFileSync(path.join(root, APP_CONSTANT), 'utf8');
  const match = source.match(APP_CONSTANT_PATTERN);
  if (!match) fail(`could not find APP_VERSION in ${APP_CONSTANT}.`);
  return match[2];
}

function writeAppConstant(version) {
  const file = path.join(root, APP_CONSTANT);
  const source = readFileSync(file, 'utf8');
  writeFileSync(file, source.replace(APP_CONSTANT_PATTERN, `$1${version}$3`), 'utf8');
}

function get() {
  return readJson('package.json').version;
}

function set(version) {
  if (!SEMVER.test(version)) fail(`"${version}" is not a valid semantic version.`);

  for (const manifest of MANIFESTS) {
    const json = readJson(manifest);
    json.version = version;
    writeJson(manifest, json);
  }

  const expo = readJson(EXPO_CONFIG);
  expo.expo.version = version;
  expo.expo.android = { ...expo.expo.android, versionCode: androidVersionCode(version) };
  expo.expo.ios = { ...expo.expo.ios, buildNumber: String(androidVersionCode(version)) };
  writeJson(EXPO_CONFIG, expo);

  writeAppConstant(version);

  // `JSON.stringify` and Prettier disagree about when a short array fits on one
  // line, and CI checks formatting. Re-formatting here keeps a version bump from
  // failing the very pipeline it is preparing. Best-effort: a release build that
  // sets the version on a runner does not need the result to be pretty.
  try {
    execFileSync('node', ['node_modules/prettier/bin/prettier.cjs', '--write', ...ALL_FILES], {
      cwd: root,
      stdio: 'ignore',
    });
  } catch {
    process.stderr.write('version: could not run Prettier; run `pnpm format` before committing.\n');
  }

  process.stdout.write(`${version}\n`);
}

function check(expected) {
  const mismatched = [];

  for (const manifest of MANIFESTS) {
    const actual = readJson(manifest).version;
    if (actual !== expected) mismatched.push(`${manifest}: ${actual}`);
  }

  const expoVersion = readJson(EXPO_CONFIG).expo.version;
  if (expoVersion !== expected) mismatched.push(`${EXPO_CONFIG}: ${expoVersion}`);

  const appVersion = readAppConstant();
  if (appVersion !== expected) mismatched.push(`${APP_CONSTANT}: ${appVersion}`);

  if (mismatched.length > 0) {
    fail(
      `expected every manifest to be ${expected}, but found:\n  ${mismatched.join('\n  ')}\n` +
        `Run \`pnpm version:set ${expected}\` and commit the result.`,
    );
  }

  process.stdout.write(`${expected}\n`);
}

const [command, argument] = process.argv.slice(2);

switch (command) {
  case 'get':
    process.stdout.write(`${get()}\n`);
    break;
  case 'set':
    if (!argument) fail('set requires a version, e.g. `set 1.0.0`.');
    set(argument);
    break;
  case 'check':
    if (!argument) fail('check requires a version, e.g. `check 1.0.0`.');
    check(argument);
    break;
  default:
    fail('usage: version.mjs <get|set|check> [version]');
}
