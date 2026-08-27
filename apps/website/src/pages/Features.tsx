import { Badge, Card, PageHeader, Section } from '../components/primitives';
import { FEATURE_GROUPS } from '../content/features';

export function Features() {
  return (
    <>
      <PageHeader
        eyebrow="Features"
        title="What Noto does"
        lead="A writing surface, somewhere to keep what you write, and applications on every platform you use. Anything marked planned is on the roadmap rather than in your hands today."
      />

      {FEATURE_GROUPS.map((group) => (
        <Section key={group.title} title={group.title} description={group.summary}>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {group.features.map((feature) => (
              <Card key={feature.title} className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-primary text-sm font-semibold">{feature.title}</h3>
                  {feature.status === 'planned' ? <Badge>Planned</Badge> : null}
                </div>
                <p className="text-secondary text-sm">{feature.description}</p>
                {feature.detail ? <p className="text-tertiary text-sm">{feature.detail}</p> : null}
              </Card>
            ))}
          </div>
        </Section>
      ))}
    </>
  );
}
