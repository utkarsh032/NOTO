/**
 * Guesses which download the visitor wants, so the download page can lead with
 * one button instead of a grid of twelve.
 *
 * This is a convenience, never a gate: every other platform stays visible and
 * one click away, because user-agent sniffing is a guess and sometimes a wrong
 * one.
 */

import type { Architecture, PlatformId } from '@noto/config';
import { useEffect, useState } from 'react';

export interface DetectedPlatform {
  id: PlatformId;
  arch: Architecture;
  /** False when detection fell back to a default rather than recognising the agent. */
  confident: boolean;
}

interface NavigatorUAData {
  platform?: string;
  getHighEntropyValues?: (hints: string[]) => Promise<{ architecture?: string; bitness?: string }>;
}

const UNKNOWN: DetectedPlatform = { id: 'windows', arch: 'x64', confident: false };

function detectSync(): DetectedPlatform {
  if (typeof navigator === 'undefined') return UNKNOWN;

  const ua = navigator.userAgent;
  const uaData = (navigator as Navigator & { userAgentData?: NavigatorUAData }).userAgentData;
  const platform = uaData?.platform ?? navigator.platform ?? '';

  // Mobile first: an iPad reports a macOS-like user agent, so touch support is
  // what separates it from a MacBook.
  if (/android/i.test(ua)) return { id: 'android', arch: 'arm64', confident: true };
  if (/iPhone|iPad|iPod/i.test(ua)) return { id: 'ios', arch: 'arm64', confident: true };
  if (/Mac/i.test(platform) && navigator.maxTouchPoints > 1) {
    return { id: 'ios', arch: 'arm64', confident: true };
  }

  if (/Win/i.test(platform) || /Windows/i.test(ua)) {
    // ARM64 Windows reports itself in the user agent string; x64 is the default.
    const arm = /ARM64|aarch64/i.test(ua);
    return { id: 'windows', arch: arm ? 'arm64' : 'x64', confident: true };
  }

  if (/Mac/i.test(platform) || /Mac OS X/i.test(ua)) {
    // Safari and Chrome both hide the CPU on macOS, so this is refined
    // asynchronously below where the browser supports it.
    return { id: 'macos', arch: 'arm64', confident: true };
  }

  if (/Linux|X11|CrOS/i.test(platform) || /Linux/i.test(ua)) {
    return { id: 'linux', arch: 'x64', confident: true };
  }

  return UNKNOWN;
}

export function useDetectedPlatform(): DetectedPlatform {
  const [detected, setDetected] = useState<DetectedPlatform>(detectSync);

  useEffect(() => {
    const uaData = (navigator as Navigator & { userAgentData?: NavigatorUAData }).userAgentData;
    if (!uaData?.getHighEntropyValues) return;

    let cancelled = false;

    uaData
      .getHighEntropyValues(['architecture', 'bitness'])
      .then((values) => {
        if (cancelled || !values.architecture) return;
        const arch: Architecture = /arm/i.test(values.architecture) ? 'arm64' : 'x64';
        setDetected((current) => (current.arch === arch ? current : { ...current, arch }));
      })
      .catch(() => {
        // The hint is optional; the synchronous guess remains.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return detected;
}
