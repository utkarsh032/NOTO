import { ISSUES_URL } from '@noto/config';

import { ButtonLink, Card, PageHeader, Section } from '../components/primitives';
import { FAQ } from '../content/faq';

export function Faq() {
  return (
    <>
      <PageHeader
        eyebrow="FAQ"
        title="Frequently asked questions"
        lead="Storage, privacy, installing and updating — the questions that come up most."
      />

      {FAQ.map((section) => (
        <Section key={section.title} title={section.title}>
          <div className="space-y-3">
            {section.entries.map((entry) => (
              <Card key={entry.question} className="p-0">
                <details className="group">
                  <summary className="text-content focus-visible:outline-accent cursor-pointer list-none px-5 py-4 text-sm font-medium marker:content-none focus-visible:outline-2 focus-visible:outline-offset-2">
                    <span className="flex items-center justify-between gap-4">
                      {entry.question}
                      <span
                        aria-hidden
                        className="text-subtle transition-transform group-open:rotate-45"
                      >
                        +
                      </span>
                    </span>
                  </summary>
                  <p className="text-muted px-5 pb-5 text-sm">{entry.answer}</p>
                </details>
              </Card>
            ))}
          </div>
        </Section>
      ))}

      <Section>
        <Card className="text-center">
          <h2 className="text-content text-base font-semibold">Still stuck?</h2>
          <p className="text-muted mx-auto mt-2 max-w-xl text-sm">
            Open an issue with your platform, your Noto version and what you did — that is usually
            enough to reproduce a problem straight away.
          </p>
          <div className="mt-5">
            <ButtonLink href={ISSUES_URL}>Report an issue</ButtonLink>
          </div>
        </Card>
      </Section>
    </>
  );
}
