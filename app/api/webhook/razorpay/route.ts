import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { razorpay } from '@/lib/razorpay';
import { getPlan } from '@/lib/plans';
import { createInvoiceForOrder } from '@/lib/invoice';
import { tryFulfillInvoice } from '@/lib/invoice-fulfillment';
import {
  grantOneTimeEntitlement,
  grantOrExtendSubscriptionEntitlement,
  revokeEntitlementForPayment,
} from '@/lib/entitlements';

export const runtime = 'nodejs';

// HMAC-SHA256 over the RAW body, timing-safe compared to x-razorpay-signature.
function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function toDate(unixSeconds?: number | null): Date | undefined {
  return unixSeconds ? new Date(unixSeconds * 1000) : undefined;
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-razorpay-signature');

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const eventId = req.headers.get('x-razorpay-event-id');
  if (!eventId) {
    return NextResponse.json({ error: 'Missing event id' }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const event: any = JSON.parse(rawBody);
  const type: string = event.event;

  // Idempotency: atomically claim this event id. Duplicate => already handled.
  try {
    await prisma.webhookEvent.create({
      data: { razorpayEventId: eventId, eventType: type, payload: event, status: 'received' },
    });
  } catch {
    return NextResponse.json({ status: 'duplicate' });
  }

  try {
    await handleEvent(type, event);
    await prisma.webhookEvent.update({
      where: { razorpayEventId: eventId },
      data: { status: 'processed', processedAt: new Date() },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    await prisma.webhookEvent
      .update({
        where: { razorpayEventId: eventId },
        data: { status: 'failed', error: message.slice(0, 500) },
      })
      .catch(() => undefined);
    // 5xx so Razorpay retries (at-least-once delivery).
    return NextResponse.json({ error: 'processing_failed' }, { status: 500 });
  }

  return NextResponse.json({ status: 'ok' });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleEvent(type: string, event: any): Promise<void> {
  switch (type) {
    case 'payment.authorized':
      return onPaymentAuthorized(event.payload.payment.entity);
    case 'payment.captured':
      return onPaymentCaptured(event.payload.payment.entity);
    case 'subscription.activated':
      return onSubscriptionActivated(event.payload.subscription.entity);
    case 'subscription.charged':
      return onSubscriptionCharged(event.payload);
    case 'subscription.halted':
      return onSubscriptionStatus(event.payload.subscription.entity, 'halted', true);
    case 'subscription.cancelled':
      return onSubscriptionStatus(event.payload.subscription.entity, 'cancelled', false);
    case 'subscription.completed':
      return onSubscriptionStatus(event.payload.subscription.entity, 'completed', false);
    case 'refund.processed':
      return onRefundProcessed(event.payload.refund.entity);
    default:
      return; // subscribed-but-unhandled events are acknowledged
  }
}

// Safety net for accounts on manual capture: auto-capture one-time order
// payments that come in only "authorized". Subscription payments are captured
// by Razorpay's recurring engine, so we never force-capture those here.
// Capturing then emits payment.captured, where fulfillment actually runs.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function onPaymentAuthorized(payment: any): Promise<void> {
  if (payment.captured || !payment.order_id) return;

  const order = await prisma.order.findUnique({
    where: { razorpayOrderId: payment.order_id },
    include: { payment: true },
  });
  if (!order || order.kind !== 'one_time' || order.payment) return;

  try {
    // Capture the ORDER amount; Razorpay adds any customer-borne fee on top.
    await razorpay.payments.capture(payment.id, order.amountPaise, order.currency);
  } catch (err) {
    const e = err as { error?: { description?: string }; message?: string };
    const desc = e?.error?.description ?? e?.message ?? '';
    // Benign races with dashboard auto-capture — captured already, nothing to do.
    if (/already.*captured/i.test(desc)) return;
    throw err;
  }
}

// One-time purchase paid. (Subscription payments are handled by subscription.* )
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function onPaymentCaptured(payment: any): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { razorpayOrderId: payment.order_id },
    include: { payment: true },
  });
  if (!order || order.kind !== 'one_time' || order.payment) return;

  const plan = getPlan(order.planId);

  const invoiceId = await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: { status: 'paid', razorpayPaymentId: payment.id },
    });
    const pay = await tx.payment.create({
      data: {
        orderId: order.id,
        razorpayPaymentId: payment.id,
        amountPaise: payment.amount,
        currency: payment.currency,
        method: payment.method ?? null,
        status: 'captured',
        capturedAt: new Date(),
        raw: payment,
      },
    });
    if (plan) {
      await grantOneTimeEntitlement(tx, {
        userId: order.userId,
        plan,
        orderId: order.id,
        paymentId: pay.id,
      });
    }
    const invoice = await createInvoiceForOrder(tx, {
      orderId: order.id,
      userId: order.userId,
      grossPaise: order.amountPaise,
    });
    return invoice.id;
  });

  await tryFulfillInvoice(invoiceId);
}

// First activation: mark active, set period, create the unlimited entitlement.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function onSubscriptionActivated(sub: any): Promise<void> {
  const local = await prisma.subscription.findUnique({
    where: { razorpaySubscriptionId: sub.id },
  });
  if (!local) return;

  const currentEnd = toDate(sub.current_end) ?? null;
  const plan = getPlan(local.planId);

  await prisma.$transaction(async (tx) => {
    await tx.subscription.update({
      where: { id: local.id },
      data: {
        status: 'active',
        currentStart: toDate(sub.current_start),
        currentEnd: currentEnd ?? undefined,
        chargeAt: toDate(sub.charge_at),
      },
    });
    if (plan && currentEnd) {
      await grantOrExtendSubscriptionEntitlement(tx, {
        userId: local.userId,
        plan,
        subscriptionId: local.id,
        currentEnd,
      });
    }
  });
}

// Each successful charge (incl. renewals): write Order + Payment + Invoice,
// extend the entitlement to the new period end.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function onSubscriptionCharged(payload: any): Promise<void> {
  const sub = payload.subscription?.entity;
  const payment = payload.payment?.entity;
  if (!sub) return;

  const local = await prisma.subscription.findUnique({
    where: { razorpaySubscriptionId: sub.id },
  });
  if (!local) return;

  const currentEnd = toDate(sub.current_end) ?? null;
  const plan = getPlan(local.planId);

  const invoiceId = await prisma.$transaction(async (tx) => {
    await tx.subscription.update({
      where: { id: local.id },
      data: {
        status: 'active',
        currentStart: toDate(sub.current_start),
        currentEnd: currentEnd ?? undefined,
        chargeAt: toDate(sub.charge_at),
        paidCount: { increment: 1 },
      },
    });

    let orderId: string | null = null;
    let paymentRowId: string | null = null;
    let newInvoiceId: string | null = null;

    if (payment) {
      const dup = await tx.payment.findUnique({ where: { razorpayPaymentId: payment.id } });
      if (!dup) {
        const order = await tx.order.create({
          data: {
            userId: local.userId,
            kind: 'subscription_cycle',
            planId: local.planId,
            subscriptionId: local.id,
            amountPaise: payment.amount,
            currency: payment.currency,
            status: 'paid',
            razorpaySubscriptionId: sub.id,
            razorpayPaymentId: payment.id,
            notes: { product: 'riopoly', sku: local.planId },
          },
        });
        const pay = await tx.payment.create({
          data: {
            orderId: order.id,
            razorpayPaymentId: payment.id,
            amountPaise: payment.amount,
            currency: payment.currency,
            method: payment.method ?? null,
            status: 'captured',
            capturedAt: new Date(),
            raw: payment,
          },
        });
        const invoice = await createInvoiceForOrder(tx, {
          orderId: order.id,
          userId: local.userId,
          grossPaise: order.amountPaise,
        });
        orderId = order.id;
        paymentRowId = pay.id;
        newInvoiceId = invoice.id;
      }
    }

    if (plan && currentEnd) {
      await grantOrExtendSubscriptionEntitlement(tx, {
        userId: local.userId,
        plan,
        subscriptionId: local.id,
        currentEnd,
        orderId,
        paymentId: paymentRowId,
      });
    }

    return newInvoiceId;
  });

  if (invoiceId) await tryFulfillInvoice(invoiceId);
}

// halted -> stop access now. cancelled/completed -> access continues to period end.
async function onSubscriptionStatus(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sub: any,
  status: 'halted' | 'cancelled' | 'completed',
  stopAccessNow: boolean,
): Promise<void> {
  const local = await prisma.subscription.findUnique({
    where: { razorpaySubscriptionId: sub.id },
  });
  if (!local) return;

  await prisma.$transaction(async (tx) => {
    await tx.subscription.update({
      where: { id: local.id },
      data: {
        status,
        cancelledAt: status === 'cancelled' ? new Date() : undefined,
        cancelAtCycleEnd: status === 'cancelled' ? true : undefined,
      },
    });
    if (stopAccessNow) {
      await tx.entitlement.updateMany({
        where: { sourceSubscriptionId: local.id, kind: 'unlimited', consumedAt: null },
        data: { expiresAt: new Date() },
      });
    }
  });
}

// Refund: mark payment/order refunded and void the originating entitlement.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function onRefundProcessed(refund: any): Promise<void> {
  const payment = await prisma.payment.findUnique({
    where: { razorpayPaymentId: refund.payment_id },
  });
  if (!payment) return;

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'refunded',
        refundedAt: new Date(),
        refundedPaise: { increment: refund.amount },
      },
    });
    await tx.order.update({ where: { id: payment.orderId }, data: { status: 'refunded' } });
    await revokeEntitlementForPayment(tx, payment.id);
  });
}
