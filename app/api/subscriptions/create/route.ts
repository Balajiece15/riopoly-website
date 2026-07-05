import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { razorpay, RAZORPAY_PUBLIC_KEY_ID } from '@/lib/razorpay';
import { getSessionUser } from '@/lib/session';
import { getPlan } from '@/lib/plans';

export const runtime = 'nodejs';

const Body = z.object({ sku: z.string().min(1) });

// Number of billing cycles Razorpay requires up front. Long horizon = "until cancel".
const TOTAL_COUNT = { monthly: 120, yearly: 10 } as const;

// Subscription purchase: create a Razorpay Subscription + a local Subscription row.
// First charge + entitlement happen via the subscription.activated webhook.
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const plan = getPlan(parsed.data.sku);
  if (!plan || plan.kind !== 'subscription' || !plan.billingPeriod) {
    return NextResponse.json({ error: 'Unknown subscription SKU' }, { status: 400 });
  }

  // Need the Razorpay plan_id created by `npm run sync:plans`.
  const dbPlan = await prisma.plan.findUnique({ where: { id: plan.id } });
  const razorpayPlanId = plan.razorpayPlanId ?? dbPlan?.razorpayPlanId;
  if (!razorpayPlanId) {
    return NextResponse.json(
      { error: 'Plan not synced to Razorpay yet. Run: npm run sync:plans' },
      { status: 409 },
    );
  }

  let subscription;
  try {
    subscription = await razorpay.subscriptions.create({
      plan_id: razorpayPlanId,
      total_count: TOTAL_COUNT[plan.billingPeriod],
      quantity: 1,
      customer_notify: 1,
      notes: { product: 'riopoly', sku: plan.id, userId: user.id },
    });
  } catch (err) {
    const e = err as { error?: { description?: string }; message?: string };
    const description = e?.error?.description ?? e?.message ?? 'Razorpay rejected the subscription';
    console.error('[subscriptions/create] Razorpay error:', description);
    return NextResponse.json({ error: description }, { status: 502 });
  }

  await prisma.subscription.create({
    data: {
      userId: user.id,
      planId: plan.id,
      razorpaySubscriptionId: subscription.id,
      status: 'created',
    },
  });

  return NextResponse.json({
    type: 'subscription',
    keyId: RAZORPAY_PUBLIC_KEY_ID,
    subscriptionId: subscription.id,
    name: 'RioPoly',
    description: plan.displayName,
    prefill: { email: user.email },
    // UI hint: agency-yearly (> ₹15k) needs additional-factor auth on each renewal.
    additionalAuthOnRenewal: !!plan.highTicketAFA,
  });
}
