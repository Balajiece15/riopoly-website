import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import type { PlanDef } from './plans';

// "Does this user have access right now?" is answered ONLY from the ledger.

export async function getActiveEntitlements(userId: string) {
  const now = new Date();
  return prisma.entitlement.findMany({
    where: {
      userId,
      consumedAt: null,
      grantedAt: { lte: now },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: { expiresAt: 'asc' },
  });
}

export async function hasUnlimited(userId: string): Promise<boolean> {
  const now = new Date();
  const row = await prisma.entitlement.findFirst({
    where: {
      userId,
      kind: 'unlimited',
      consumedAt: null,
      grantedAt: { lte: now },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
  });
  return Boolean(row);
}

export async function getCreditBalance(userId: string): Promise<number> {
  const now = new Date();
  const rows = await prisma.entitlement.findMany({
    where: {
      userId,
      kind: 'credits',
      consumedAt: null,
      value: { gt: 0 },
      grantedAt: { lte: now },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: { value: true },
  });
  return rows.reduce((sum, r) => sum + (r.value ?? 0), 0);
}

/**
 * Consume one project credit for a user. Unlimited users always pass without
 * spending. Returns true if access is granted, false if out of credits.
 */
export async function consumeCredit(userId: string, projectId: string): Promise<boolean> {
  if (await hasUnlimited(userId)) return true;

  return prisma.$transaction(async (tx) => {
    const now = new Date();
    // Spend the soonest-expiring credit first (Postgres sorts NULLs last on ASC).
    const credit = await tx.entitlement.findFirst({
      where: {
        userId,
        kind: 'credits',
        consumedAt: null,
        value: { gt: 0 },
        grantedAt: { lte: now },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { expiresAt: 'asc' },
    });
    if (!credit) return false;

    const newValue = (credit.value ?? 0) - 1;
    await tx.entitlement.update({
      where: { id: credit.id },
      data: { value: newValue, consumedAt: newValue <= 0 ? now : null },
    });
    await tx.project.update({ where: { id: projectId }, data: { entitlementId: credit.id } });
    return true;
  });
}

// ---------------------------------------------------------------------------
// Grant / revoke helpers — called from the webhook inside its transaction.
// ---------------------------------------------------------------------------

export async function grantOneTimeEntitlement(
  tx: Prisma.TransactionClient,
  args: { userId: string; plan: PlanDef; orderId: string; paymentId: string },
) {
  const { plan } = args;
  const expiresAt = plan.entitlement.validityDays
    ? new Date(Date.now() + plan.entitlement.validityDays * 86_400_000)
    : null;

  return tx.entitlement.create({
    data: {
      userId: args.userId,
      kind: 'credits',
      value: plan.entitlement.value,
      source: `one_time:${plan.id}`,
      sourceOrderId: args.orderId,
      sourcePaymentId: args.paymentId,
      expiresAt,
    },
  });
}

/**
 * Create the unlimited entitlement on first activation, or extend its
 * expiry on each renewal. One row per subscription, expiresAt = period end.
 */
export async function grantOrExtendSubscriptionEntitlement(
  tx: Prisma.TransactionClient,
  args: {
    userId: string;
    plan: PlanDef;
    subscriptionId: string;
    currentEnd: Date;
    orderId?: string | null;
    paymentId?: string | null;
  },
) {
  const existing = await tx.entitlement.findFirst({
    where: {
      userId: args.userId,
      kind: 'unlimited',
      sourceSubscriptionId: args.subscriptionId,
      consumedAt: null,
    },
    orderBy: { grantedAt: 'desc' },
  });

  if (existing) {
    return tx.entitlement.update({
      where: { id: existing.id },
      data: { expiresAt: args.currentEnd },
    });
  }

  return tx.entitlement.create({
    data: {
      userId: args.userId,
      kind: 'unlimited',
      value: null,
      source: `subscription:${args.plan.id}`,
      sourceSubscriptionId: args.subscriptionId,
      sourceOrderId: args.orderId ?? null,
      sourcePaymentId: args.paymentId ?? null,
      expiresAt: args.currentEnd,
    },
  });
}

/** Refund: void any entitlement that originated from this payment. */
export async function revokeEntitlementForPayment(
  tx: Prisma.TransactionClient,
  paymentRowId: string,
) {
  await tx.entitlement.updateMany({
    where: { sourcePaymentId: paymentRowId, consumedAt: null },
    data: { consumedAt: new Date() },
  });
}
