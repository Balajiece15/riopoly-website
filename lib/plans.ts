// =============================================================================
// RioPoly — Plan / SKU catalog (SINGLE SOURCE OF TRUTH)
//
// Adding or editing a SKU = edit THIS file only. Never hardcode prices in
// routes. The sync script (scripts/sync-plans.ts) pushes subscription SKUs to
// Razorpay Plans and snapshots every SKU into the local `Plan` table.
//
// Prices are GST-INCLUSIVE: `pricePaise` is the total amount charged; the
// invoice generator back-computes the 18% tax out of the gross (see Phase 5).
// All amounts are integer paise (₹1 = 100 paise).
// =============================================================================

export type PlanKind = 'one_time' | 'subscription';
export type EntitlementKind = 'credits' | 'unlimited' | 'feature_flag';
export type BillingPeriod = 'monthly' | 'yearly';

export interface PlanEntitlement {
  /** What this SKU grants when paid. */
  kind: EntitlementKind;
  /** Credit count for `credits`; null for `unlimited` / `feature_flag`. */
  value: number | null;
  /** Days until the granted entitlement expires; null = never expires. */
  validityDays: number | null;
}

export interface PlanDef {
  /** Stable SKU id — used as the Plan table PK and entitlement source tag. */
  id: string;
  kind: PlanKind;
  displayName: string;
  description: string;
  /** Total charged, GST-inclusive, in paise. */
  pricePaise: number;
  currency: 'INR';
  /** Subscriptions only. */
  billingPeriod?: BillingPeriod;
  entitlement: PlanEntitlement;
  /** Marketing bullets shown at checkout / pricing. */
  features: string[];
  /** Extra capability flags unlocked by this SKU (e.g. white-label, seats). */
  featureFlags?: string[];
  /**
   * Razorpay plan_id (subscriptions only). Leave undefined on first run; the
   * sync script creates the Razorpay Plan and prints the id to paste back here
   * for idempotent re-runs. (The local Plan table also stores it.)
   */
  razorpayPlanId?: string;
  /** True if cycle amount > ₹15,000 → RBI e-Mandate AFA on every renewal. */
  highTicketAFA?: boolean;
}

// ₹15,000 in paise — RBI additional-factor-auth threshold per cycle.
export const AFA_THRESHOLD_PAISE = 1_500_000;

// -----------------------------------------------------------------------------
// One-time SKUs (ad-hoc Razorpay Orders at checkout — NOT Razorpay Plans)
// -----------------------------------------------------------------------------
const ONE_TIME: PlanDef[] = [
  {
    id: 'single-project',
    kind: 'one_time',
    displayName: 'Single Project',
    description: '1 project credit. Never expires.',
    pricePaise: 49_900, // ₹499
    currency: 'INR',
    entitlement: { kind: 'credits', value: 1, validityDays: null },
    features: ['1 project credit', 'Branded PDF proposal', 'Never expires'],
  },
  {
    id: 'pack-10',
    kind: 'one_time',
    displayName: 'Pack of 10',
    description: '10 project credits. Valid 12 months.',
    pricePaise: 399_900, // ₹3,999
    currency: 'INR',
    entitlement: { kind: 'credits', value: 10, validityDays: 365 },
    features: ['10 project credits', 'Branded PDF proposals', 'Valid 12 months'],
  },
  {
    id: 'pack-50',
    kind: 'one_time',
    displayName: 'Pack of 50',
    description: '50 project credits. Valid 12 months.',
    pricePaise: 1_499_900, // ₹14,999
    currency: 'INR',
    entitlement: { kind: 'credits', value: 50, validityDays: 365 },
    features: ['50 project credits', 'Branded PDF proposals', 'Valid 12 months', 'Best value'],
  },
];

// -----------------------------------------------------------------------------
// Subscription SKUs (Razorpay Plans + Subscriptions API)
// -----------------------------------------------------------------------------
const SUBSCRIPTIONS: PlanDef[] = [
  {
    id: 'pro-monthly',
    kind: 'subscription',
    razorpayPlanId: 'plan_T3tULLTnEEaVlR',
    displayName: 'Pro · Monthly',
    description: 'Unlimited projects, branded PDFs, AI colour suggestions.',
    pricePaise: 149_900, // ₹1,499 / month
    currency: 'INR',
    billingPeriod: 'monthly',
    entitlement: { kind: 'unlimited', value: null, validityDays: null },
    features: ['Unlimited projects', 'Branded PDF proposals', 'AI colour suggestions'],
  },
  {
    id: 'pro-yearly',
    kind: 'subscription',
    razorpayPlanId: 'plan_T3tULdGx5Uu9jz',
    displayName: 'Pro · Yearly',
    description: 'Unlimited projects, branded PDFs, AI colour suggestions. Save 17%.',
    pricePaise: 1_499_900, // ₹14,999 / year (just under the ₹15k AFA threshold)
    currency: 'INR',
    billingPeriod: 'yearly',
    entitlement: { kind: 'unlimited', value: null, validityDays: null },
    features: ['Everything in Pro', 'Save 17% vs monthly', 'Annual billing'],
  },
  {
    id: 'agency-monthly',
    kind: 'subscription',
    razorpayPlanId: 'plan_T3tULsm1r45277',
    displayName: 'Agency · Monthly',
    description: 'Unlimited projects, white-label PDFs, 5 team seats.',
    pricePaise: 499_900, // ₹4,999 / month
    currency: 'INR',
    billingPeriod: 'monthly',
    entitlement: { kind: 'unlimited', value: null, validityDays: null },
    features: ['Unlimited projects', 'White-label PDFs', '5 team seats'],
    featureFlags: ['white_label', 'team_seats:5'],
  },
  {
    id: 'agency-yearly',
    kind: 'subscription',
    razorpayPlanId: 'plan_T3tUM8ZVDhEFKX',
    displayName: 'Agency · Yearly',
    description: 'Unlimited projects, white-label PDFs, 5 team seats. Annual billing.',
    pricePaise: 4_999_900, // ₹49,999 / year
    currency: 'INR',
    billingPeriod: 'yearly',
    entitlement: { kind: 'unlimited', value: null, validityDays: null },
    features: ['Everything in Agency', 'Annual billing', 'Priority support'],
    featureFlags: ['white_label', 'team_seats:5'],
    highTicketAFA: true, // > ₹15,000/cycle → extra auth on every renewal
  },
];

// -----------------------------------------------------------------------------
// Free tier — NOT purchasable, no Razorpay, no Entitlement row. These are the
// default limits applied when a user has no active paid entitlement.
// -----------------------------------------------------------------------------
export const FREE_TIER = {
  maxSavedProjects: 1,
  watermarkedExports: true,
  pdfDownload: false,
  unlimitedPreview: true,
} as const;

// -----------------------------------------------------------------------------
// Catalog + helpers
// -----------------------------------------------------------------------------
export const PLANS: PlanDef[] = [...ONE_TIME, ...SUBSCRIPTIONS];

const PLANS_BY_ID: Record<string, PlanDef> = Object.fromEntries(
  PLANS.map((p) => [p.id, p]),
);

export function getPlan(id: string): PlanDef | undefined {
  return PLANS_BY_ID[id];
}

export function getPlanOrThrow(id: string): PlanDef {
  const plan = PLANS_BY_ID[id];
  if (!plan) throw new Error(`Unknown plan SKU: ${id}`);
  return plan;
}

export function getOneTimePlans(): PlanDef[] {
  return PLANS.filter((p) => p.kind === 'one_time');
}

export function getSubscriptionPlans(): PlanDef[] {
  return PLANS.filter((p) => p.kind === 'subscription');
}

/** Razorpay Plan `period` + `interval` for a subscription SKU. */
export function razorpayInterval(plan: PlanDef): { period: 'monthly' | 'yearly'; interval: number } {
  if (plan.kind !== 'subscription' || !plan.billingPeriod) {
    throw new Error(`Plan ${plan.id} is not a subscription`);
  }
  return { period: plan.billingPeriod, interval: 1 };
}

/** Pretty ₹ string from paise (display only). */
export function formatINR(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(paise / 100);
}
