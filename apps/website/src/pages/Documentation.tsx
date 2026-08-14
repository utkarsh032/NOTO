import { Card, PageHeader, Section } from '../components/primitives';
import { DOC_SECTIONS } from '../content/docs';
import { Link } from '../router';

export function Documentation() {
  return (
    <>
      <PageHeader
        eyebrow="Documentation"
        title="Documentation"
        lead="Noto's documentation lives in the repository, next to the code it describes. This page is the index."
      />

      {DOC_SECTIONS.map((section) => (
        <Section key={section.title} title={section.title} description={section.description}>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {section.links.map((link) => (
              <Card key={link.title}>
                <Link
                  href={link.href}
                  className="text-content hover:text-accent text-sm font-semibold"
                >
                  {link.title}
                  {link.href.startsWith('/') ? null : (
                    <span aria-hidden className="text-subtle ml-1">
                      ↗
                    </span>
                  )}
                </Link>
                <p className="text-muted mt-2 text-sm">{link.description}</p>
              </Card>
            ))}
          </div>
        </Section>
      ))}
    </>
  );
}
