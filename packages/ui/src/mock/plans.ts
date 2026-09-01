import type { ComponentType } from 'react';

import { CrownIcon, LeafIcon, RocketIcon, type IconProps } from '../components/icons';

/**
 * The three plans, and what separates them.
 *
 * Presentation data, like the rest of `mock/`: Noto has no billing service, so
 * nothing here charges anybody. It is shaped the way a price list from one
 * would be — an identifier, two prices, and a set of limits — so the screen
 * that renders it will not change when real numbers arrive behind it.
 *
 * The shape of the ladder is the argument the page has to make. Basic is a
 * complete local Noto rather than a crippled one, because Noto is local-first
 * and a free tier that could not hold your documents would contradict the
 * product. What the paid plans sell is everything that costs someone else money
 * — sync, hosted history, AI — which is also the honest reason they cost you.
 */

export type PlanId = 'basic' | 'pro' | 'pro-max';

export interface Plan {
  id: PlanId;
  name: string;
  /** One line on who the plan is for. */
  tagline: string;
  icon: ComponentType<IconProps>;
  /** In whole currency units per month. Zero is free, and reads as free. */
  monthlyPrice: number;
  /** What a year costs paid up front — two months less than twelve. */
  yearlyPrice: number;
  /** The one plan the page recommends. Exactly one is true. */
  isRecommended: boolean;
  /** The label on the card's button. */
  cta: string;
  /** Four or five lines, in the order they matter. Not the full table. */
  highlights: string[];
}

export const CURRENCY_SYMBOL = '$';

export const PLANS: Plan[] = [
  {
    id: 'basic',
    name: 'Basic',
    tagline: 'The whole local Noto, on every device you own.',
    icon: LeafIcon,
    monthlyPrice: 0,
    yearlyPrice: 0,
    isRecommended: false,
    cta: 'Your current plan',
    highlights: [
      'Unlimited local documents',
      'The full editor — tables, checklists, find and replace',
      'Quick Note, Quick Paste and the dock',
      'Import and export Markdown, HTML and text',
      'Local search across everything',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'Sync, history and AI, for one person who writes a lot.',
    icon: RocketIcon,
    monthlyPrice: 6,
    yearlyPrice: 60,
    isRecommended: true,
    cta: 'Upgrade to Pro',
    highlights: [
      'Sync across unlimited devices',
      '50 GB of synced storage',
      '90 days of version history',
      'Noto AI — rewrite, summarise, ask',
      'Priority email support',
    ],
  },
  {
    id: 'pro-max',
    name: 'Pro Max',
    tagline: 'For teams, archives, and people who never delete anything.',
    icon: CrownIcon,
    monthlyPrice: 14,
    yearlyPrice: 140,
    isRecommended: false,
    cta: 'Upgrade to Pro Max',
    highlights: [
      'Everything in Pro, without the ceilings',
      '2 TB of synced storage',
      'Unlimited version history',
      'Shared workspaces and guest links',
      'Noto AI on the largest models',
    ],
  },
];

/**
 * A row of the comparison table.
 *
 * A boolean is drawn as a tick or a dash; a string is drawn as it is written,
 * because "90 days" says more than a tick ever could.
 */
export interface PlanFeature {
  id: string;
  label: string;
  /** What the row actually means, for anyone the label does not reach. */
  hint?: string;
  values: Record<PlanId, string | boolean>;
}

export interface PlanFeatureGroup {
  id: string;
  title: string;
  features: PlanFeature[];
}

export const PLAN_FEATURES: PlanFeatureGroup[] = [
  {
    id: 'writing',
    title: 'Writing and capture',
    features: [
      {
        id: 'documents',
        label: 'Documents',
        values: { basic: 'Unlimited', pro: 'Unlimited', 'pro-max': 'Unlimited' },
      },
      {
        id: 'editor',
        label: 'The full editor',
        hint: 'Tables, checklists, code blocks, find and replace.',
        values: { basic: true, pro: true, 'pro-max': true },
      },
      {
        id: 'quick-note',
        label: 'Quick Note and the dock',
        hint: 'The capture window, and the edge handle that outlives the app window.',
        values: { basic: true, pro: true, 'pro-max': true },
      },
      {
        id: 'templates',
        label: 'Templates',
        values: { basic: 'Built-in', pro: 'Built-in + custom', 'pro-max': 'Built-in + custom' },
      },
      {
        id: 'offline',
        label: 'Works fully offline',
        values: { basic: true, pro: true, 'pro-max': true },
      },
    ],
  },
  {
    id: 'sync',
    title: 'Sync and devices',
    features: [
      {
        id: 'devices',
        label: 'Synced devices',
        values: { basic: 'This device', pro: 'Unlimited', 'pro-max': 'Unlimited' },
      },
      {
        id: 'storage',
        label: 'Synced storage',
        values: { basic: '—', pro: '50 GB', 'pro-max': '2 TB' },
      },
      {
        id: 'history',
        label: 'Version history',
        values: { basic: 'On this device', pro: '90 days', 'pro-max': 'Unlimited' },
      },
      {
        id: 'sharing',
        label: 'Shared workspaces',
        values: { basic: false, pro: false, 'pro-max': true },
      },
      {
        id: 'links',
        label: 'Public and guest links',
        values: { basic: false, pro: false, 'pro-max': true },
      },
    ],
  },
  {
    id: 'ai',
    title: 'Noto AI and Memory',
    features: [
      {
        id: 'ai-requests',
        label: 'AI requests',
        values: { basic: '—', pro: '1,000 / month', 'pro-max': 'Unlimited' },
      },
      {
        id: 'ai-models',
        label: 'Models',
        values: { basic: '—', pro: 'Standard', 'pro-max': 'Largest available' },
      },
      {
        id: 'memory',
        label: 'Noto Memory',
        hint: 'Clipboard history, captures and quick notes, searchable together.',
        values: { basic: 'Local', pro: 'Synced', 'pro-max': 'Synced' },
      },
      {
        id: 'ocr',
        label: 'Text from screenshots',
        values: { basic: false, pro: true, 'pro-max': true },
      },
    ],
  },
  {
    id: 'support',
    title: 'Support',
    features: [
      {
        id: 'channel',
        label: 'Support',
        values: {
          basic: 'Community',
          pro: 'Priority email',
          'pro-max': 'Priority email + onboarding',
        },
      },
      {
        id: 'response',
        label: 'First response',
        values: { basic: '—', pro: 'Within 2 business days', 'pro-max': 'Within 1 business day' },
      },
      {
        id: 'early',
        label: 'Early access to new features',
        values: { basic: false, pro: true, 'pro-max': true },
      },
    ],
  },
];

export type BillingCycle = 'monthly' | 'yearly';

/** What a plan costs on a given cycle, and what that works out to per month. */
export interface PlanPrice {
  /** What is charged, per billing cycle. */
  amount: number;
  /** What that is per month, for the line under the price. */
  perMonth: number;
  /** Whole percent saved by paying yearly. Zero on a free plan. */
  savingPercent: number;
}

export function planPrice(plan: Plan, cycle: BillingCycle): PlanPrice {
  if (plan.monthlyPrice === 0) return { amount: 0, perMonth: 0, savingPercent: 0 };

  const yearlyIfMonthly = plan.monthlyPrice * 12;
  const savingPercent = Math.round(((yearlyIfMonthly - plan.yearlyPrice) / yearlyIfMonthly) * 100);

  return cycle === 'monthly'
    ? { amount: plan.monthlyPrice, perMonth: plan.monthlyPrice, savingPercent }
    : { amount: plan.yearlyPrice, perMonth: plan.yearlyPrice / 12, savingPercent };
}

/** A whole number reads as itself; anything else keeps two decimal places. */
export function formatMoney(amount: number): string {
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
}
