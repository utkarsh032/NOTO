import { RELEASES_URL } from '@noto/config';

import { Badge, ButtonLink, Card, PageHeader, Section } from '../components/primitives';
import { CHANGELOG, CHANGE_KIND_LABEL, type ChangeKind } from '../content/changelog';
import { Link } from '../router';

const KIND_ORDER: ChangeKind[] = ['added', 'improved', 'changed', 'fixed', 'removed'];

function formatDate(iso: string | null): string {
  if (!iso) return 'Unreleased';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function Changelog() {
  return (
    <>
      <PageHeader
        eyebrow="Changelog"
        title="What changed, and when"
        lead="A summary of every version. For the full notes attached to a release, see the release notes page."
      />

      <Section>
        <div className="space-y-6">
          {CHANGELOG.map((entry) => {
            const grouped = KIND_ORDER.map((kind) => ({
              kind,
              items: entry.changes.filter((change) => change.kind === kind),
            })).filter((group) => group.items.length > 0);

            return (
              <Card key={entry.version}>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-content text-lg font-semibold">{entry.version}</h2>
                  {entry.date === null ? <Badge tone="accent">In progress</Badge> : null}
                  <span className="text-subtle text-sm">{formatDate(entry.date)}</span>
                </div>

                <p className="text-muted mt-2">{entry.summary}</p>

                <div className="mt-5 space-y-4">
                  {grouped.map((group) => (
                    <div key={group.kind}>
                      <h3 className="text-subtle text-xs font-semibold tracking-wide uppercase">
                        {CHANGE_KIND_LABEL[group.kind]}
                      </h3>
                      <ul className="mt-2 space-y-1.5">
                        {group.items.map((change) => (
                          <li
                            key={change.description}
                            className="text-muted ml-5 list-disc text-sm"
                          >
                            {change.description}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/releases" tone="secondary">
            Full release notes
          </ButtonLink>
          <ButtonLink href={RELEASES_URL} tone="secondary">
            Releases on GitHub
          </ButtonLink>
        </div>

        <p className="text-subtle mt-6 text-sm">
          Looking for the downloads of a specific version? The{' '}
          <Link href="/download" className="text-accent hover:underline">
            download page
          </Link>{' '}
          always points at the latest stable release.
        </p>
      </Section>
    </>
  );
}
