import { SYSTEM_REQUIREMENTS } from '@noto/config';

import { Card, DefinitionTable, PageHeader, Section } from '../components/primitives';

export function SystemRequirements() {
  return (
    <>
      <PageHeader
        eyebrow="System requirements"
        title="What Noto needs"
        lead="Starting figures for a desktop application of Noto's shape. They will be revised against measurements from real installations rather than left as permanent guesses."
      />

      <Section>
        <div className="grid gap-6 md:grid-cols-2">
          {SYSTEM_REQUIREMENTS.map((requirement) => (
            <Card key={requirement.platform}>
              <h2 className="text-primary text-base font-semibold">{requirement.platform}</h2>
              <div className="mt-2">
                <DefinitionTable rows={requirement.rows} />
              </div>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="Notes">
        <div className="text-secondary max-w-2xl space-y-4">
          <p>
            Storage figures cover the application itself. Your documents are stored separately and
            grow with what you write — a large library of text documents is still measured in
            megabytes.
          </p>
          <p>
            Noto on Linux is published as an AppImage, a <code>.deb</code> and an <code>.rpm</code>{' '}
            for x64. Other architectures are not built today.
          </p>
          <p>
            The web application needs a browser with IndexedDB available. Private browsing modes
            often restrict it, and documents written in a private window will not survive it
            closing.
          </p>
        </div>
      </Section>
    </>
  );
}
