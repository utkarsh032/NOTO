import { RELEASES_URL } from '@noto/config';

import { Markdown } from '../components/Markdown';
import { Badge, ButtonLink, Card, PageHeader, Section } from '../components/primitives';
import { useReleases } from '../hooks/use-releases';
import { Link } from '../router';

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function ReleaseNotes() {
  const state = useReleases();

  return (
    <>
      <PageHeader
        eyebrow="Release notes"
        title="Every published release"
        lead="Read straight from the releases themselves, so what you see here is what was actually published."
      />

      <Section>
        {state.status === 'loading' ? (
          <Card>
            <p className="text-secondary text-sm">Loading releases…</p>
          </Card>
        ) : null}

        {state.status === 'unavailable' ? (
          <Card>
            <h2 className="text-primary text-base font-semibold">Releases could not be loaded</h2>
            <p className="text-secondary mt-2 text-sm">
              GitHub did not answer — it may be unreachable from your network, or the
              unauthenticated rate limit on its API may have been reached. The releases themselves
              are unaffected.
            </p>
            <div className="mt-4">
              <ButtonLink href={RELEASES_URL} tone="secondary">
                Open releases on GitHub
              </ButtonLink>
            </div>
          </Card>
        ) : null}

        {state.status === 'ready' && state.releases.length === 0 ? (
          <Card>
            <h2 className="text-primary text-base font-semibold">Nothing published yet</h2>
            <p className="text-secondary mt-2 text-sm">
              Noto has not cut its first release. The{' '}
              <Link href="/changelog" className="text-brand hover:underline">
                changelog
              </Link>{' '}
              tracks what is being built in the meantime.
            </p>
          </Card>
        ) : null}

        {state.status === 'ready' && state.releases.length > 0 ? (
          <div className="space-y-6">
            {state.releases.map((release) => {
              const published = formatDate(release.publishedAt);

              return (
                <Card key={release.tag}>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-primary text-lg font-semibold">{release.name}</h2>
                    {release.prerelease ? <Badge tone="accent">Prerelease</Badge> : null}
                    {published ? <span className="text-tertiary text-sm">{published}</span> : null}
                  </div>

                  <div className="mt-4">
                    {release.body.trim() ? (
                      <Markdown source={release.body} />
                    ) : (
                      <p className="text-secondary text-sm">
                        This release was published without notes.
                      </p>
                    )}
                  </div>

                  <div className="mt-5">
                    <a
                      href={release.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-brand text-sm hover:underline"
                    >
                      View {release.tag} on GitHub ↗
                    </a>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : null}
      </Section>
    </>
  );
}
