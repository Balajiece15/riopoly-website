import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { razorpay } from '@/lib/razorpay';

export const runtime = 'nodejs';

/**
 * Cancel the user's active subscription AT CYCLE END.
 * Per refund policy ("cancel anytime; access continues until period end"),
 * we pass cancel_at_cycle_end so the current entitlement is honoured.
 * The authoritative status flip is applied by the subscription.cancelled webhook;
 * here we set cancelAtCycleEnd optimistically for immediate UI feedback.
 */
export async function POST() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const sub = await prisma.subscription.findFirst({
    where: { userId: user.id, status: { in: ['authenticated', 'active', 'pending', 'halted'] } },
    orderBy: { createdAt: 'desc' },
  });

  if (!sub) {
    return NextResponse.json({ error: 'No active subscription to cancel' }, { status: 404 });
  }

  try {
    // Second arg = cancelAtCycleEnd (true → keep access until current period end).
    await razorpay.subscriptions.cancel(sub.razorpaySubscriptionId, true);
  } catch (err) {
    console.error('[subscriptions/cancel] Razorpay cancel failed:', err);
    return NextResponse.json({ error: 'Could not cancel subscription. Please try again.' }, { status: 502 });
  }

  await prisma.subscription.update({
    where: { id: sub.id },
    data: { cancelAtCycleEnd: true },
  });

  return NextResponse.json({ ok: true });
}
