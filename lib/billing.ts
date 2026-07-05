import { prisma } from './prisma';
import { getActiveEntitlements, getCreditBalance, hasUnlimited } from './entitlements';

// Subscription states that still grant (or will grant) access.
const LIVE_SUB_STATUSES = ['authenticated', 'active', 'pending', 'halted'] as const;

/**
 * Everything the /billing dashboard needs, in one server-side call.
 * Access truth comes from the entitlement ledger, not from subscription rows.
 */
export async function getBillingSummary(userId: string) {
  const [entitlements, creditBalance, unlimited, subscription, orders] = await Promise.all([
    getActiveEntitlements(userId),
    getCreditBalance(userId),
    hasUnlimited(userId),
    prisma.subscription.findFirst({
      where: { userId, status: { in: [...LIVE_SUB_STATUSES] } },
      orderBy: { createdAt: 'desc' },
      include: { plan: true },
    }),
    prisma.order.findMany({
      where: { userId, status: { in: ['paid', 'refunded'] } },
      orderBy: { createdAt: 'desc' },
      include: { plan: true, invoice: true },
      take: 50,
    }),
  ]);

  return { entitlements, creditBalance, unlimited, subscription, orders };
}

export type BillingSummary = Awaited<ReturnType<typeof getBillingSummary>>;
