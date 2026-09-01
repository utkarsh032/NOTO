import { APP_NAME } from '@noto/config';
import { useState } from 'react';

import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { SegmentedControl } from '../../components/SegmentedControl';
import { showToast } from '../../components/toast-store';
import { CheckIcon, InfoIcon, MinusIcon } from '../../components/icons';
import {
  CURRENCY_SYMBOL,
  PLANS,
  PLAN_FEATURES,
  formatMoney,
  planPrice,
  type BillingCycle,
  type Plan,
  type PlanId,
} from '../../mock/plans';
import { cn } from '../../utils/cn';
import { PageContainer } from '../PageContainer';
import { useAccount } from '../use-account';

/** Nothing here can charge anybody yet, and the screen says so rather than pretending. */
const NOT_CONNECTED = `${APP_NAME} has no billing service yet, so nothing was charged.`;

/** Which plan the account is actually on. Everything above it is an upgrade. */
const CURRENT_PLAN: PlanId = 'basic';

/**
 * Plans & Pricing.
 *
 * Three cards for the decision and one table for the argument. The cards are
 * what somebody scanning makes their mind up from, so each carries a price, a
 * sentence and five lines; the table underneath is for the person who has
 * already half-decided and wants to know exactly where the ceiling is.
 *
 * Two rules hold the page together. The recommended plan is raised rather than
 * recoloured — one brand-tinted card among three neutrals, because if every
 * card shouts none of them does — and no row of the table is allowed to say
 * only "yes" or "no" when it could say "90 days" instead.
 */
export function PlansScreen() {
  const { plan: currentPlan } = useAccount();
  const [cycle, setCycle] = useState<BillingCycle>('yearly');

  /* Every plan saves the same fraction by the year; Pro is the one on the page. */
  const yearlySaving = planPrice(PLANS[1]!, 'yearly').savingPercent;

  return (
    <PageContainer
      title="Plans & Pricing"
      subtitle={`You are on ${currentPlan.name}. ${APP_NAME} keeps working offline on every plan — what you pay for is everything that leaves this device.`}
      actions={
        <div className="flex flex-col items-end gap-1.5">
          <SegmentedControl
            label="Billing period"
            value={cycle}
            onChange={setCycle}
            options={[
              { value: 'monthly', label: 'Monthly', content: 'Monthly' },
              { value: 'yearly', label: 'Yearly', content: 'Yearly' },
            ]}
          />
          <span className="text-tertiary text-caption">Save {yearlySaving}% paying yearly</span>
        </div>
      }
    >
      <section aria-label="Plans" className="grid gap-5 lg:grid-cols-3">
        {PLANS.map((plan) => (
          <PlanCard key={plan.id} plan={plan} cycle={cycle} />
        ))}
      </section>

      <section aria-labelledby="noto-compare-heading" className="mt-12">
        <h2 id="noto-compare-heading" className="text-primary text-h2">
          Compare every feature
        </h2>
        <p className="text-secondary text-body mt-1.5">
          Where a plan has a limit, the limit is written out. A tick means there is no number to
          give.
        </p>

        <ComparisonTable />
      </section>

      <p className="text-tertiary text-caption border-default mt-10 flex items-start gap-2 rounded-lg border border-dashed p-4">
        <InfoIcon className="mt-px h-4 w-4 shrink-0" />
        <span>
          Prices are shown in US dollars, excluding any tax your country adds. {APP_NAME} has no
          billing service connected yet, so these buttons describe a plan rather than buy one — and
          nothing you have written is ever held behind one. Your documents are on this device, in a
          format you can export at any time, on every plan including the free one.
        </span>
      </p>
    </PageContainer>
  );
}

interface PlanCardProps {
  plan: Plan;
  cycle: BillingCycle;
}

function PlanCard({ plan, cycle }: PlanCardProps) {
  const price = planPrice(plan, cycle);
  const isCurrent = plan.id === CURRENT_PLAN;
  const Glyph = plan.icon;

  return (
    <article
      className={cn(
        'relative flex flex-col rounded-2xl border p-6 transition-shadow',
        plan.isRecommended
          ? 'border-brand-subtle bg-brand-soft shadow-[var(--noto-shadow-md)]'
          : 'border-default bg-surface hover:shadow-[var(--noto-shadow-sm)]',
      )}
    >
      {plan.isRecommended ? (
        <Badge tone="brand" className="absolute -top-2.5 left-6 shadow-sm">
          Most popular
        </Badge>
      ) : null}

      <header className="flex items-center gap-2.5">
        <span
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-lg',
            plan.isRecommended ? 'bg-brand text-on-brand' : 'bg-surface-tertiary text-secondary',
          )}
        >
          <Glyph className="h-5 w-5" />
        </span>
        <h2 className="text-primary text-h3 flex-1">{plan.name}</h2>
        {isCurrent ? <Badge tone="neutral">Current</Badge> : null}
      </header>

      <p className="text-secondary text-body-sm mt-3 min-h-10">{plan.tagline}</p>

      <p className="mt-5 flex items-baseline gap-1.5">
        <span className="text-primary text-display">
          {price.amount === 0 ? 'Free' : `${CURRENCY_SYMBOL}${formatMoney(price.amount)}`}
        </span>
        {price.amount === 0 ? null : (
          <span className="text-tertiary text-body-sm">{cycle === 'yearly' ? '/year' : '/mo'}</span>
        )}
      </p>

      {/* The line holds its height on the free plan too, so the three buttons
          below stay on one line across the row. */}
      <p className="text-tertiary text-caption mt-1 min-h-[18px]">
        {price.amount === 0
          ? 'Free forever. No card, no account.'
          : cycle === 'yearly'
            ? `${CURRENCY_SYMBOL}${formatMoney(price.perMonth)} a month, billed yearly`
            : `${CURRENCY_SYMBOL}${formatMoney(plan.yearlyPrice)} a year saves ${price.savingPercent}%`}
      </p>

      <Button
        variant={plan.isRecommended ? 'primary' : 'secondary'}
        className="mt-5 w-full"
        disabled={isCurrent}
        onClick={() => showToast(NOT_CONNECTED)}
      >
        {plan.cta}
      </Button>

      <ul className="mt-6 flex flex-col gap-2.5">
        {plan.highlights.map((highlight) => (
          <li key={highlight} className="text-secondary text-body-sm flex items-start gap-2.5">
            <CheckIcon
              className={cn(
                'mt-0.5 h-4 w-4 shrink-0',
                plan.isRecommended ? 'text-brand-strong' : 'text-brand',
              )}
            />
            {highlight}
          </li>
        ))}
      </ul>
    </article>
  );
}

/**
 * The full comparison.
 *
 * One table rather than three lists side by side, because the question it
 * answers is a comparison and a screen reader should hear it as one: each row
 * is a feature, each column a plan, and the feature name is the row's header.
 *
 * The recommended column is tinted the whole way down rather than only in its
 * header, which is what lets the eye stay in the right column while reading
 * across twenty rows of it.
 */
function ComparisonTable() {
  return (
    <div className="noto-scroll-x border-default bg-surface mt-6 overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[640px] border-collapse text-left">
        <caption className="sr-only">Features included with each plan</caption>

        <thead>
          <tr className="border-default bg-surface-secondary border-b">
            <th scope="col" className="text-tertiary text-caption px-5 py-3 font-medium">
              Feature
            </th>
            {PLANS.map((plan) => (
              <th
                key={plan.id}
                scope="col"
                className={cn(
                  'text-primary text-body-sm w-[18%] px-5 py-3 text-center font-semibold',
                  plan.isRecommended && 'text-brand-strong',
                )}
              >
                {plan.name}
              </th>
            ))}
          </tr>
        </thead>

        {PLAN_FEATURES.map((group) => (
          <tbody key={group.id}>
            <tr>
              <th
                scope="colgroup"
                colSpan={PLANS.length + 1}
                className="text-tertiary text-caption border-default bg-surface-secondary/60 border-y px-5 py-2 font-medium tracking-wide uppercase"
              >
                {group.title}
              </th>
            </tr>

            {group.features.map((feature) => (
              <tr key={feature.id} className="border-default border-b last:border-b-0">
                <th scope="row" className="px-5 py-3 font-normal">
                  <span className="text-primary text-body-sm block">{feature.label}</span>
                  {feature.hint ? (
                    <span className="text-tertiary text-caption mt-0.5 block">{feature.hint}</span>
                  ) : null}
                </th>

                {PLANS.map((plan) => (
                  <td
                    key={plan.id}
                    className={cn(
                      'px-5 py-3 text-center',
                      plan.isRecommended && 'bg-brand-soft/40',
                    )}
                  >
                    <FeatureValue value={feature.values[plan.id]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}

/**
 * One cell.
 *
 * The tick and the dash are decorative — the sentence a screen reader needs is
 * in the visually hidden text beside them, because "tick" in the middle of a
 * row of ticks tells nobody which plan they are in.
 */
function FeatureValue({ value }: { value: string | boolean }) {
  if (value === true) {
    return (
      <>
        <CheckIcon className="text-brand mx-auto h-4.5 w-4.5" />
        <span className="sr-only">Included</span>
      </>
    );
  }

  if (value === false) {
    return (
      <>
        <MinusIcon className="text-disabled mx-auto h-4 w-4" />
        <span className="sr-only">Not included</span>
      </>
    );
  }

  return <span className="text-secondary text-body-sm">{value}</span>;
}
