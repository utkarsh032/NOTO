#!/usr/bin/env node
/**
 * Runs a command, then kills and retries it if it stops making progress.
 *
 *   node scripts/run-with-retry.mjs --timeout 15 --attempts 2 -- \
 *     pnpm --filter @noto/desktop exec electron-forge make --arch=arm64
 *
 * Packaging is the one release step that hangs rather than fails. `hdiutil`,
 * which backs the DMG maker, intermittently stops responding on the hosted
 * macOS runners: no output, no exit code, nothing in the log. v1.1.2 was lost
 * exactly that way — macOS arm64 sat in `make` for 45 minutes while the other
 * four platforms finished in under three. The job timeout that eventually
 * fired marked the job *cancelled*, a cancelled job cancelled the run, and the
 * skipped publish step threw away four working installers.
 *
 * A job-level `timeout-minutes` cannot fix that. It fires once, at the very
 * end, and cancels — which is precisely the outcome that costs the release. To
 * survive a hang the retry has to happen inside the step, so each attempt needs
 * a deadline of its own.
 */

import { spawn, spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

const argv = process.argv.slice(2);
const split = argv.indexOf('--');

if (split === -1 || split === argv.length - 1) {
  console.error(
    'Usage: run-with-retry.mjs [--timeout <minutes>] [--attempts <n>] -- <command> [args...]',
  );
  process.exit(2);
}

/** Reads a numeric flag from the portion of argv before the `--` separator. */
function flag(name, fallback) {
  const at = argv.indexOf(name);
  if (at === -1 || at >= split) return fallback;
  const value = Number(argv[at + 1]);
  if (!Number.isFinite(value) || value <= 0) {
    console.error(`${name} expects a positive number, got "${argv[at + 1]}".`);
    process.exit(2);
  }
  return value;
}

const timeoutMinutes = flag('--timeout', 15);
const attempts = flag('--attempts', 2);
const [command, ...args] = argv.slice(split + 1);

const windows = process.platform === 'win32';

/** Kills the attempt and everything it spawned. */
function terminate(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;

  if (windows) {
    // Node cannot signal a Windows process tree; taskkill can.
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    return;
  }

  // The attempt has its own process group, so the negated pid reaches every
  // grandchild rather than only the wrapper.
  try {
    process.kill(-child.pid, 'SIGKILL');
  } catch {
    // Already gone between the deadline firing and the signal landing.
  }
}

/**
 * Unmounts anything a killed attempt left behind.
 *
 * A DMG build that dies part-way leaves its volume mounted, and the next
 * attempt then fails attaching a name that is already taken — which would turn
 * a retryable hang into a hard failure on the second attempt.
 */
function detachStaleVolumes() {
  if (process.platform !== 'darwin') return;

  for (const volume of readdirSync('/Volumes')) {
    if (!volume.startsWith('Noto')) continue;
    console.log(`Detaching the volume /Volumes/${volume} left behind by the killed attempt.`);
    spawnSync('hdiutil', ['detach', `/Volumes/${volume}`, '-force'], { stdio: 'inherit' });
  }
}

/** Quotes an argument for cmd.exe, which understands only double quotes. */
function quote(value) {
  return /[\s"^&|<>]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function spawnAttempt() {
  if (!windows) {
    // Its own process group, so a kill reaches hdiutil and every other
    // grandchild rather than only the wrapper.
    return spawn(command, args, { stdio: 'inherit', detached: true });
  }

  // `pnpm` is a `.cmd` shim, which Node refuses to spawn without a shell. A
  // shell takes one command line rather than an argv array — handing it both
  // makes Node concatenate them unescaped, which is the DEP0190 deprecation.
  return spawn([command, ...args].map(quote).join(' '), { stdio: 'inherit', shell: true });
}

function runOnce() {
  return new Promise((resolve) => {
    let timedOut = false;

    const child = spawnAttempt();

    const deadline = setTimeout(() => {
      timedOut = true;
      console.error(`::warning::No exit after ${timeoutMinutes} minutes. Killing the attempt.`);
      terminate(child);
    }, timeoutMinutes * 60_000);

    child.on('error', (error) => {
      clearTimeout(deadline);
      resolve({ ok: false, reason: error.message });
    });

    child.on('close', (code, signal) => {
      clearTimeout(deadline);
      if (timedOut) resolve({ ok: false, reason: `no exit within ${timeoutMinutes} minutes` });
      else if (code === 0) resolve({ ok: true });
      else resolve({ ok: false, reason: signal ? `killed by ${signal}` : `exit status ${code}` });
    });
  });
}

for (let attempt = 1; attempt <= attempts; attempt += 1) {
  if (attempt > 1) console.log(`\nAttempt ${attempt} of ${attempts}: ${command} ${args.join(' ')}`);

  const result = await runOnce();
  if (result.ok) process.exit(0);

  console.error(`::warning::Attempt ${attempt} of ${attempts} failed: ${result.reason}.`);

  if (attempt === attempts) {
    console.error(`::error::\`${command}\` failed after ${attempts} attempts.`);
    process.exit(1);
  }

  detachStaleVolumes();
}
