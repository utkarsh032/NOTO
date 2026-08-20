import { PLATFORMS, RELEASES_URL, downloadUrl, type PlatformId } from '@noto/config';

import { Badge, ButtonLink, Card, Container, PageHeader, Section } from '../components/primitives';
import { WEB_APP_URL } from '../env';
import { useDetectedPlatform } from '../hooks/use-detected-platform';
import { useLatestRelease } from '../hooks/use-latest-release';
import { Link } from '../router';

/**
 * Whether GitHub confirmed a published release.
 *
 * The build-time version is not evidence of one: the site is deployed from the
 * same commit that a release mk is cut from, so it always knows a version number
 * whether or not installers exist for it. Only a successful API response means
 * there is something to download — anything else and the page must say so
 * rather than link at files that were never published.
 */
function hasPublishedRelease(release: { loading: boolean; stale: boolean }): boolean {
  return !release.loading && !release.stale;
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function PlatformCard({
  platformId,
  version,
  highlighted,
}: {
  platformId: PlatformId;
  version: string;
  highlighted?: boolean;
}) {
  const platform = PLATFORMS.find((candidate) => candidate.id === platformId);
  if (!platform) return null;

  return (
    <Card className={highlighted ? 'border-accent' : undefined}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-content text-base font-semibold">{platform.label}</h3>
        {highlighted ? <Badge tone="accent">Detected</Badge> : null}
      </div>

      <ul className="mt-4 space-y-2">
        {platform.packages.map((pkg) => {
          const href = pkg.file
            ? downloadUrl(version, pkg.file(version))
            : pkg.href === '/'
              ? WEB_APP_URL
              : pkg.href;

          return (
            <li key={pkg.label} className="flex items-center justify-between gap-3">
              <span className="text-muted text-sm">
                {pkg.label}
                {pkg.note ? <span className="text-subtle ml-2 text-xs">{pkg.note}</span> : null}
              </span>

              {href ? (
                <a
                  href={href}
                  className="border-border-strong text-content hover:bg-surface-sunken shrink-0 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors"
                  {...(pkg.file ? {} : { target: '_blank', rel: 'noreferrer noopener' })}
                >
                  {pkg.file ? `.${pkg.format}` : 'Open'}
                </a>
              ) : (
                <Badge>Soon</Badge>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function PrimaryDownload({ version }: { version: string }) {
  const detected = useDetectedPlatform();
  const platform = PLATFORMS.find((candidate) => candidate.id === detected.id);

  // The stores are not open yet, and the web application needs no download, so
  // those visitors are pointed at the thing that does work for them.
  if (!platform || detected.id === 'web' || detected.id === 'android' || detected.id === 'ios') {
    return (
      <Card className="text-center">
        <p className="text-muted text-sm">
          {detected.id === 'web'
            ? 'Noto runs in your browser with nothing to install.'
            : 'The mobile applications are not published yet. In the meantime, Noto runs in your mobile browser.'}
        </p>
        <div className="mt-4">
          <ButtonLink href={WEB_APP_URL}>Open Noto in your browser</ButtonLink>
        </div>
      </Card>
    );
  }

  // Prefer the package matching the detected architecture; fall back to the
  // first one, which is the recommended build for that platform.
  const preferred =
    platform.packages.find((pkg) => pkg.arch === detected.arch && pkg.file) ?? platform.packages[0];

  const file = preferred?.file?.(version);

  return (
    <Card className="border-accent text-center">
      <p className="text-subtle text-sm">Detected platform</p>
      <p className="text-content mt-1 text-2xl font-semibold">
        {platform.label}
        <span className="text-muted ml-2 text-base font-normal">{detected.arch}</span>
      </p>

      {file ? (
        <>
          <div className="mt-6">
            <ButtonLink href={downloadUrl(version, file)} download>
              Download for {platform.label}
            </ButtonLink>
          </div>
          <p className="text-subtle mt-3 font-mono text-xs break-all">{file}</p>
        </>
      ) : null}

      {!detected.confident ? (
        <p className="text-subtle mt-4 text-xs">
          We could not identify your system with confidence — check the full list below.
        </p>
      ) : null}
    </Card>
  );
}

function NothingReleasedYet() {
  return (
    <Section>
      <Card className="text-center">
        <h2 className="text-content text-lg font-semibold">No release published yet</h2>
        <p className="text-muted mx-auto mt-3 max-w-xl">
          Noto has not cut its first versioned release. The applications are being built in the open
          — you can run them from source today, and this page will list installers as soon as there
          is something to install.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <ButtonLink href={WEB_APP_URL}>Open the web app</ButtonLink>
          <ButtonLink href={RELEASES_URL} tone="secondary">
            Watch releases on GitHub
          </ButtonLink>
        </div>
      </Card>
    </Section>
  );
}

export function Download() {
  const release = useLatestRelease();
  const detected = useDetectedPlatform();
  const published = formatDate(release.publishedAt);

  return (
    <>
      <PageHeader
        eyebrow="Download"
        title="Get Noto"
        lead={
          release.loading
            ? 'Looking up the latest version…'
            : hasPublishedRelease(release)
              ? `Version ${release.version}${published ? `, released ${published}` : ''}.`
              : 'Noto is still working towards its first release.'
        }
      />

      {!hasPublishedRelease(release) ? (
        <NothingReleasedYet />
      ) : (
        <>
          <Section>
            <div className="mx-auto max-w-md">
              <PrimaryDownload version={release.version} />
            </div>
          </Section>

          <Section
            title="All platforms"
            description="Every package published with this release. The web application always runs the latest version and needs no download."
          >
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {PLATFORMS.map((platform) => (
                <PlatformCard
                  key={platform.id}
                  platformId={platform.id}
                  version={release.version}
                  highlighted={platform.id === detected.id}
                />
              ))}
            </div>
          </Section>

          <Section title="Before you install">
            <Container className="px-0">
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <h3 className="text-content text-sm font-semibold">Check the download</h3>
                  <p className="text-muted mt-2 text-sm">
                    Every release publishes{' '}
                    <a
                      href={downloadUrl(release.version, 'SHA256SUMS.txt')}
                      className="text-accent hover:underline"
                    >
                      SHA256SUMS.txt
                    </a>
                    , so you can confirm the file you have is the file that was built.
                  </p>
                </Card>

                <Card>
                  <h3 className="text-content text-sm font-semibold">Security warnings</h3>
                  <p className="text-muted mt-2 text-sm">
                    A new installer has no reputation with SmartScreen or Gatekeeper yet, so your
                    system may warn you the first time. The{' '}
                    <Link href="/faq" className="text-accent hover:underline">
                      FAQ
                    </Link>{' '}
                    explains what to expect.
                  </p>
                </Card>

                <Card>
                  <h3 className="text-content text-sm font-semibold">Will it run?</h3>
                  <p className="text-muted mt-2 text-sm">
                    See the{' '}
                    <Link href="/requirements" className="text-accent hover:underline">
                      system requirements
                    </Link>{' '}
                    for what Noto needs on each platform.
                  </p>
                </Card>
              </div>
            </Container>
          </Section>
        </>
      )}
    </>
  );
}
