import { useDetectedPlatform } from '../hooks/use-detected-platform';
import { useLatestRelease } from '../hooks/use-latest-release';
import { PLATFORM_LABEL } from '../platform-labels';
import { Badge, ButtonLink, Card, Container, Section } from '../components/primitives';
import { HIGHLIGHTS } from '../content/features';
import { WEB_APP_URL } from '../env';
import { Link } from '../router';

function Hero() {
  const platform = useDetectedPlatform();
  const release = useLatestRelease();

  const downloadable = platform.id !== 'web';

  return (
    <div className="border-border-subtle bg-surface-sunken border-b">
      <Container className="py-20 text-center sm:py-28">
        <h1 className="text-content mx-auto max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
          Your notes. Your workspace.
        </h1>

        <p className="text-muted mx-auto mt-6 max-w-2xl text-lg text-pretty">
          Noto is a local-first notes and document workspace. It works offline, it needs no account,
          and your documents stay on your device — on Windows, macOS, Linux, Android, iOS and in the
          browser.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <ButtonLink href={WEB_APP_URL}>Open Noto in your browser</ButtonLink>
          <ButtonLink href="/download" tone="secondary">
            {downloadable ? `Download for ${PLATFORM_LABEL[platform.id]}` : 'Download Noto'}
          </ButtonLink>
        </div>

        <p className="text-subtle mt-6 text-sm">
          {release.loading ? (
            'Checking for the latest version…'
          ) : release.stale ? (
            // No published release to point at, so say that rather than
            // present the build-time version as if it were downloadable.
            <>
              In development ·{' '}
              <Link href="/changelog" className="text-accent hover:underline">
                See what is being built
              </Link>
            </>
          ) : (
            <>
              Latest version {release.version} ·{' '}
              <Link href="/changelog" className="text-accent hover:underline">
                See what changed
              </Link>
            </>
          )}
        </p>
      </Container>
    </div>
  );
}

function Highlights() {
  return (
    <Section>
      <div className="grid gap-6 md:grid-cols-3">
        {HIGHLIGHTS.map((item) => (
          <Card key={item.title}>
            <h2 className="text-content text-base font-semibold">{item.title}</h2>
            <p className="text-muted mt-2 text-sm">{item.description}</p>
          </Card>
        ))}
      </div>
    </Section>
  );
}

function Platforms() {
  return (
    <Section
      title="Everywhere you write"
      description="One document model, shared by every application, so a note started on one device reads the same on the next."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { name: 'Windows', detail: 'Installer for x64 and ARM64, with automatic updates.' },
          { name: 'macOS', detail: 'Signed disk images for Apple Silicon and Intel.' },
          { name: 'Linux', detail: 'AppImage, plus .deb and .rpm packages.' },
          { name: 'Web', detail: 'Nothing to install. Works offline once loaded.' },
          { name: 'Android', detail: 'Google Play, with APK builds for testing.', planned: true },
          { name: 'iOS', detail: 'App Store, with TestFlight for early builds.', planned: true },
        ].map((platform) => (
          <Card key={platform.name} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <h3 className="text-content text-sm font-semibold">{platform.name}</h3>
              {platform.planned ? <Badge>Planned</Badge> : null}
            </div>
            <p className="text-muted text-sm">{platform.detail}</p>
          </Card>
        ))}
      </div>

      <div className="mt-8">
        <ButtonLink href="/download" tone="secondary">
          See all downloads
        </ButtonLink>
      </div>
    </Section>
  );
}

function LocalFirst() {
  return (
    <Section>
      <Card className="p-8 sm:p-10">
        <h2 className="text-content text-xl font-semibold tracking-tight sm:text-2xl">
          Local-first is not the same as offline mode
        </h2>
        <p className="text-muted mt-4 max-w-2xl">
          Most applications treat a server as the real copy of your work and the device as a cache.
          Noto is the other way round: the copy on your device <em>is</em> the document. Nothing has
          to be reachable for you to open, edit or search it, and no outage can take your writing
          away from you.
        </p>
        <p className="text-muted mt-4 max-w-2xl">
          Cloud sync is planned as a layer on top of that, not underneath it — so turning it off
          leaves a complete application rather than an empty one.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href="/features" tone="secondary">
            Explore the features
          </ButtonLink>
          <ButtonLink href="/faq" tone="secondary">
            Read the FAQ
          </ButtonLink>
        </div>
      </Card>
    </Section>
  );
}

export function Home() {
  return (
    <>
      <Hero />
      <Highlights />
      <Platforms />
      <LocalFirst />
    </>
  );
}
