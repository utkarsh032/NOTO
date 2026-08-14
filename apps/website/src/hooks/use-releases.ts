/**
 * Fetches the list of published GitHub releases for the release-notes page.
 *
 * The notes themselves are written by the release pipeline and stored on the
 * release, so this page renders whatever is authoritative rather than a copy
 * that would have to be kept in step by hand.
 */

import { GITHUB_SLUG, RELEASES_URL } from '@noto/config';
import { useEffect, useState } from 'react';

export interface ReleaseSummary {
  tag: string;
  name: string;
  body: string;
  publishedAt: string | null;
  prerelease: boolean;
  url: string;
}

export type ReleasesState =
  | { status: 'loading' }
  | { status: 'ready'; releases: ReleaseSummary[] }
  | { status: 'unavailable' };

interface GitHubRelease {
  tag_name?: string;
  name?: string;
  body?: string;
  published_at?: string;
  prerelease?: boolean;
  draft?: boolean;
  html_url?: string;
}

/** Unauthenticated requests are rate-limited, so this asks once for a page. */
const RELEASES_API_URL = `https://api.github.com/repos/${GITHUB_SLUG}/releases?per_page=20`;

export function useReleases(): ReleasesState {
  const [state, setState] = useState<ReleasesState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetch(RELEASES_API_URL, {
          signal: controller.signal,
          headers: { Accept: 'application/vnd.github+json' },
        });

        if (!response.ok) {
          setState({ status: 'unavailable' });
          return;
        }

        const data = (await response.json()) as GitHubRelease[];

        setState({
          status: 'ready',
          releases: data
            // A draft release is not published; it should not appear here even
            // if the API happens to return it.
            .filter((release) => !release.draft && release.tag_name)
            .map((release) => ({
              tag: release.tag_name as string,
              name: release.name || (release.tag_name as string),
              body: release.body ?? '',
              publishedAt: release.published_at ?? null,
              prerelease: Boolean(release.prerelease),
              url: release.html_url ?? RELEASES_URL,
            })),
        });
      } catch {
        setState({ status: 'unavailable' });
      }
    }

    void load();
    return () => controller.abort();
  }, []);

  return state;
}
