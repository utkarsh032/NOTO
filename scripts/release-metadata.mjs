#!/usr/bin/env node
/**
 * Turns a pushed Git tag into the facts the release pipeline needs, printed as
 * GitHub Actions output lines.
 *
 *   node scripts/release-metadata.mjs v1.0.0
 *   tag=v1.0.0
 *   version=1.0.0
 *   channel=stable
 *   prerelease=false
 *
 * The channel comes from the prerelease identifier, which is what gives Noto
 * its stable / beta / nightly update channels without a second source of truth:
 *
 *   v1.0.0            -> stable
 *   v1.1.0-beta.2     -> beta
 *   v1.2.0-nightly.7  -> nightly
 */

import { execFileSync } from 'node:child_process';

const TAG = /^v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/;

function fail(message) {
  process.stderr.write(`release-metadata: ${message}\n`);
  process.exit(1);
}

const tag = process.argv[2];
if (!tag) fail('usage: release-metadata.mjs <tag>');

const matched = TAG.exec(tag);
if (!matched) {
  fail(`"${tag}" is not a release tag. Tags must look like v1.0.0 or v1.1.0-beta.2.`);
}

const version = matched[1];
const prereleaseId = version.includes('-') ? version.split('-')[1].split('.')[0] : '';

let channel;
switch (prereleaseId) {
  case '':
    channel = 'stable';
    break;
  case 'beta':
  case 'rc':
    channel = 'beta';
    break;
  case 'nightly':
  case 'alpha':
    channel = 'nightly';
    break;
  default:
    fail(
      `unknown prerelease identifier "${prereleaseId}". Use beta, rc, alpha or nightly so the ` +
        `update channel can be resolved.`,
    );
}

// The manifests are the contract with the built artifacts; a tag that does not
// match them would publish installers whose in-app version is wrong.
try {
  execFileSync(process.execPath, ['scripts/version.mjs', 'check', version], { stdio: 'pipe' });
} catch (error) {
  const detail = error.stderr?.toString().trim() || error.message;
  fail(`tag ${tag} does not match the workspace manifests.\n${detail}`);
}

process.stdout.write(
  [
    `tag=${tag}`,
    `version=${version}`,
    `channel=${channel}`,
    `prerelease=${channel === 'stable' ? 'false' : 'true'}`,
    '',
  ].join('\n'),
);
