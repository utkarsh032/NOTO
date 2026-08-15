/**
 * Asks GitHub for the newest published release.
 *
 * The version baked in at build time is always available and is used as the
 * answer until (and unless) the API responds. That ordering matters: the
 * download page must be useful with no network round-trip, on a blocked
 * corporate network, and after GitHub's unauthenticated rate limit is hit.
 */

import { LATEST_RELEASE_API_URL, LATEST_RELEASE_URL } from '@noto/config';
import { useEffect, useState } from 'react';

import { BUILD_VERSION } from '../env';

export interface LatestRelease {
  /** Semantic version without the leading `v`. */
  version: string;
  /** ISO 8601 publication timestamp, when known. */
  publishedAt: string | null;
  /** Release page on GitHub. */
  url: string;
  /** Names of the assets attached to the release. */
  assets: string[];
  /** True while the request is still outstanding. */
  loading: boolean;
  /** True when the version shown is the build-time fallback. */
  stale: boolean;
}

interface GitHubRelease {
  tag_name?: string;
  html_url?: string;
  published_at?: string;
  assets?: { name?: string }[];
}

const FALLBACK: LatestRelease = {
  version: BUILD_VERSION,
  publishedAt: null,
  url: LATEST_RELEASE_URL,
  assets: [],
  loading: true,
  stale: true,
};

export function useLatestRelease(): LatestRelease {
  const [release, setRelease] = useState<LatestRelease>(FALLBACK);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetch(LATEST_RELEASE_API_URL, {
          signal: controller.signal,
          headers: { Accept: 'application/vnd.github+json' },
        });

        // 404 means nothing has been released yet, 403 means rate-limited.
        // Neither is an error worth showing a visitor.
        if (!response.ok) {
          setRelease((current) => ({ ...current, loading: false }));
          return;
        }

        const data = (await response.json()) as GitHubRelease;
        const version = data.tag_name?.replace(/^v/, '');
        if (!version) {
          setRelease((current) => ({ ...current, loading: false }));
          return;
        }

        setRelease({
          version,
          publishedAt: data.published_at ?? null,
          url: data.html_url ?? LATEST_RELEASE_URL,
          assets: (data.assets ?? []).map((asset) => asset.name ?? '').filter(Boolean),
          loading: false,
          stale: false,
        });
      } catch {
        // Aborted, offline, or blocked — the build-time version stands.
        setRelease((current) => ({ ...current, loading: false }));
      }
    }

    void load();
    return () => controller.abort();
  }, []);

  return release;
}
