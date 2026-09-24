import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { app, safeStorage } from 'electron';

import { SESSION_CHANNELS } from '../shared/channels';
import { handleTrusted } from './security';

/**
 * The signed-in session, kept out of the renderer's reach.
 *
 * `apps/api` hands out a rotating refresh token that is good for 30 days, and
 * Backend_Node_Plan §9.5 is plain about where it goes: the operating system's
 * keychain, never `localStorage`. `safeStorage` is Electron's door to that —
 * DPAPI on Windows, the Keychain on macOS, libsecret on Linux — and what lands
 * on disk is only its ciphertext.
 *
 * Where no keychain is available (a Linux desktop with no secret service),
 * nothing is written at all. The session then lasts until the application
 * closes, which costs a sign-in per start — better than a plaintext token in
 * the user-data directory that any process running as the user could read.
 */

const FILE = 'session.bin';

/** A session is three short strings; anything larger is not one. */
const MAX_LENGTH = 16 * 1024;

function sessionPath(): string {
  return path.join(app.getPath('userData'), FILE);
}

async function load(): Promise<string | null> {
  if (!safeStorage.isEncryptionAvailable()) return null;

  try {
    return safeStorage.decryptString(await readFile(sessionPath()));
  } catch {
    // Missing, or written under a keychain that has since changed. Either way, none.
    return null;
  }
}

/** Answers whether the session was kept, so the renderer knows whether to say so. */
async function save(value: unknown): Promise<boolean> {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_LENGTH) {
    throw new Error('Refused session: not a session.');
  }

  if (!safeStorage.isEncryptionAvailable()) return false;

  await writeFile(sessionPath(), safeStorage.encryptString(value), { mode: 0o600 });

  return true;
}

async function clear(): Promise<void> {
  await rm(sessionPath(), { force: true });
}

export function registerSessionHandlers(): void {
  handleTrusted(SESSION_CHANNELS.load, () => load());
  handleTrusted(SESSION_CHANNELS.save, (_event, value: unknown) => save(value));
  handleTrusted(SESSION_CHANNELS.clear, () => clear());
}
