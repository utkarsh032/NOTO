import { ButtonLink, PageHeader, Section } from '../components/primitives';

export function NotFound() {
  return (
    <>
      <PageHeader
        eyebrow="404"
        title="That page does not exist"
        lead="The link may be out of date, or the page may have moved."
      />

      <Section>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/">Back to the home page</ButtonLink>
          <ButtonLink href="/download" tone="secondary">
            Download Noto
          </ButtonLink>
          <ButtonLink href="/docs" tone="secondary">
            Documentation
          </ButtonLink>
        </div>
      </Section>
    </>
  );
}
