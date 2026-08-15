import { GITHUB_URL, ISSUES_URL, UPDATE_CHANNELS } from '@noto/config';

import { ButtonLink, Card, DefinitionTable, PageHeader, Section } from '../components/primitives';
import { BUILD_COMMIT, BUILD_ENV, BUILD_VERSION } from '../env';

export function About() {
  return (
    <>
      <PageHeader
        eyebrow="About"
        title="About Noto"
        lead="A notes and document workspace built on the assumption that your writing belongs on your own device."
      />

      <Section title="Why Noto exists">
        <div className="text-muted max-w-2xl space-y-4">
          <p>
            Most note-taking applications treat a server as the real copy of your work and your
            device as a cache of it. That arrangement is convenient right up until the network is
            gone, the service is down, the subscription lapses, or the company shuts the product
            down — at which point the writing you did is somewhere you cannot reach.
          </p>
          <p>
            Noto inverts that. The copy on your device is the document. Everything else — sync,
            backup, sharing — is built on top of that, so removing any of it leaves a complete,
            working application rather than an empty shell.
          </p>
          <p>
            The consequence is that Noto needs no account, no subscription and no connection. It
            also means there is no server holding your documents, and nothing reporting what you
            write.
          </p>
        </div>
      </Section>

      <Section title="How Noto is built">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <h3 className="text-content text-sm font-semibold">One codebase</h3>
            <p className="text-muted mt-2 text-sm">
              A monorepo of shared packages — the editor, the storage contract, the design system,
              the domain types — with a thin application on top for each platform.
            </p>
          </Card>
          <Card>
            <h3 className="text-content text-sm font-semibold">Local storage everywhere</h3>
            <p className="text-muted mt-2 text-sm">
              SQLite on desktop and mobile, IndexedDB in the browser, behind one storage interface
              so the applications do not care which they are using.
            </p>
          </Card>
          <Card>
            <h3 className="text-content text-sm font-semibold">Released in the open</h3>
            <p className="text-muted mt-2 text-sm">
              Every installer is built by a public pipeline from a public tag, and published with
              checksums to GitHub Releases.
            </p>
          </Card>
        </div>
      </Section>

      <Section title="Release channels">
        <div className="grid gap-4 md:grid-cols-3">
          {Object.entries(UPDATE_CHANNELS).map(([id, channel]) => (
            <Card key={id}>
              <h3 className="text-content text-sm font-semibold">{channel.label}</h3>
              <p className="text-muted mt-2 text-sm">{channel.description}</p>
              <p className="text-subtle mt-3 font-mono text-xs">{channel.tagPattern}</p>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="This website">
        <div className="max-w-2xl">
          <DefinitionTable
            rows={[
              { label: 'Version', value: BUILD_VERSION },
              { label: 'Environment', value: BUILD_ENV },
              {
                label: 'Commit',
                value: BUILD_COMMIT ? (
                  <a
                    href={`${GITHUB_URL}/commit/${BUILD_COMMIT}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-accent font-mono hover:underline"
                  >
                    {BUILD_COMMIT.slice(0, 12)}
                  </a>
                ) : (
                  'local build'
                ),
              },
            ]}
          />
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href={GITHUB_URL} tone="secondary">
            Source on GitHub
          </ButtonLink>
          <ButtonLink href={ISSUES_URL} tone="secondary">
            Issues
          </ButtonLink>
        </div>
      </Section>
    </>
  );
}
