import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { razorpay, RAZORPAY_PUBLIC_KEY_ID } from '@/lib/razorpay';
import { getSessionUser } from '@/lib/session';
import { getPlan } from '@/lib/plans';

export const runtime = 'nodejs';

const Body = z.object({ sku: z.string().min(1) });

// One-time purchase: create a Razorpay Order + a local Order row (status=created).
// Entitlements are granted later by the webhook (payment.captured) — never here.
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
  if (!plan || plan.kind !== 'one_time') {
    return NextResponse.json({ error: 'Unknown one-time SKU' }, { status: 400 });
  }

  let rzpOrder;
  try {
    rzpOrder = await razorpay.orders.create({
      amount: plan.pricePaise,
      currency: plan.currency,
      receipt: `rio_${user.id.slice(0, 8)}_${Date.now()}`,
      notes: { product: 'riopoly', sku: plan.id, userId: user.id, kind: 'one_time' },
    });
  } catch (err) {
    const e = err as { error?: { description?: string }; message?: string };
    const description = e?.error?.description ?? e?.message ?? 'Razorpay rejected the order';
    console.error('[orders/create] Razorpay error:', description);
    return NextResponse.json({ error: description }, { status: 502 });
  }

  await prisma.order.create({
    data: {
      userId: user.id,
      kind: 'one_time',
      planId: plan.id,
      amountPaise: plan.pricePaise,
      currency: plan.currency,
      status: 'created',
      razorpayOrderId: rzpOrder.id,
      notes: { product: 'riopoly', sku: plan.id },
    },
  });

  return NextResponse.json({
    type: 'one_time',
    keyId: RAZORPAY_PUBLIC_KEY_ID,
    orderId: rzpOrder.id,
    amount: plan.pricePaise,
    currency: plan.currency,
    name: 'RioPoly',
    description: plan.displayName,
    prefill: { email: user.email },
  });
}
