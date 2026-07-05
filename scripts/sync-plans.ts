// =============================================================================
// One-shot sync: lib/plans.ts  ->  Razorpay Plans  ->  local Plan table
//
// Run:  npm run sync:plans
//
// Idempotent:
//   - Subscription SKUs: a Razorpay Plan is created only if we don't already
//     have a plan_id (from lib/plans.ts `razorpayPlanId`, else the local Plan
//     table). Existing ids are reused — re-running never duplicates.
//   - One-time SKUs: snapshotted into the Plan table only (no Razorpay Plan).
//
// After the FIRST run, paste any newly-printed plan_ids into lib/plans.ts so
// the catalog file stays the source of truth.
//
// Uses TEST keys when your .env has rzp_test_… — always dry-run in Test mode
// before pointing at Live.
// =============================================================================

import 'dotenv/config';
import { prisma } from '../lib/prisma';
import { razorpay } from '../lib/razorpay';
import {
  PLANS,
  getSubscriptionPlans,
  razorpayInterval,
  type PlanDef,
} from '../lib/plans';

function mode(): 'TEST' | 'LIVE' {
  return process.env.RAZORPAY_KEY_ID?.startsWith('rzp_live_') ? 'LIVE' : 'TEST';
}

async function resolveRazorpayPlanId(plan: PlanDef): Promise<{ id: string; created: boolean }> {
  // 1) Prefer the id pinned in lib/plans.ts.
  if (plan.razorpayPlanId) {
    return { id: plan.razorpayPlanId, created: false };
  }

  // 2) Fall back to a previously-synced id in the local Plan table.
  const existing = await prisma.plan.findUnique({ where: { id: plan.id } });
  if (existing?.razorpayPlanId) {
    return { id: existing.razorpayPlanId, created: false };
  }

  // 3) Create a fresh Razorpay Plan.
  const { period, interval } = razorpayInterval(plan);
  const created = await razorpay.plans.create({
    period,
    interval,
    item: {
      name: plan.displayName,
      amount: plan.pricePaise,
      currency: plan.currency,
      description: plan.description,
    },
    notes: { product: 'riopoly', sku: plan.id },
  });

  return { id: created.id, created: true };
}

async function upsertLocalPlan(plan: PlanDef, razorpayPlanId: string | null) {
  await prisma.plan.upsert({
    where: { id: plan.id },
    create: {
      id: plan.id,
      kind: plan.kind,
      displayName: plan.displayName,
      description: plan.description,
      pricePaise: plan.pricePaise,
      currency: plan.currency,
      billingPeriod: plan.billingPeriod ?? null,
      creditValue: plan.entitlement.kind === 'credits' ? plan.entitlement.value : null,
      creditValidityDays: plan.entitlement.validityDays,
      entitlementKind: plan.entitlement.kind,
      razorpayPlanId,
      active: true,
    },
    update: {
      kind: plan.kind,
      displayName: plan.displayName,
      description: plan.description,
      pricePaise: plan.pricePaise,
      currency: plan.currency,
      billingPeriod: plan.billingPeriod ?? null,
      creditValue: plan.entitlement.kind === 'credits' ? plan.entitlement.value : null,
      creditValidityDays: plan.entitlement.validityDays,
      entitlementKind: plan.entitlement.kind,
      // Only overwrite the id when we have one (never clobber with null).
      ...(razorpayPlanId ? { razorpayPlanId } : {}),
      active: true,
    },
  });
}

async function main() {
  console.log(`\nRioPoly plan sync — Razorpay mode: ${mode()}\n`);

  const newlyCreated: { sku: string; planId: string }[] = [];

  // One-time SKUs: snapshot only.
  for (const plan of PLANS.filter((p) => p.kind === 'one_time')) {
    await upsertLocalPlan(plan, null);
    console.log(`  one-time   ${plan.id.padEnd(16)} → Plan table ✓`);
  }

  // Subscription SKUs: ensure a Razorpay Plan, then snapshot.
  for (const plan of getSubscriptionPlans()) {
    const { id, created } = await resolveRazorpayPlanId(plan);
    await upsertLocalPlan(plan, id);
    if (created) newlyCreated.push({ sku: plan.id, planId: id });
    console.log(
      `  subscription ${plan.id.padEnd(14)} → ${id} ${created ? '(created)' : '(reused)'}`,
    );
  }

  if (newlyCreated.length) {
    console.log('\n⚠️  Paste these new plan_ids into lib/plans.ts (razorpayPlanId) for idempotent re-runs:\n');
    for (const { sku, planId } of newlyCreated) {
      console.log(`    ${sku}: razorpayPlanId: '${planId}',`);
    }
  }

  console.log('\nDone.\n');
}

main()
  .catch((err) => {
    console.error('Plan sync failed:', err?.message ?? err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
