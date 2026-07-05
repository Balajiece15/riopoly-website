/**
 * Inspect the most recent user's billing state end-to-end.
 * Usage: npm run check:billing            (latest user)
 *        npm run check:billing -- <email> (specific user)
 */
import 'dotenv/config';
import { prisma } from '../lib/prisma';
import { formatINR } from '../lib/plans';

async function main() {
  const email = process.argv[2];
  const user = email
    ? await prisma.user.findUnique({ where: { email } })
    : await prisma.user.findFirst({ orderBy: { createdAt: 'desc' } });

  if (!user) {
    console.log('No user found. Sign in at http://localhost:3000/login first.');
    return;
  }

  console.log(`\n=== USER ===\n${user.email} (${user.id})`);
  console.log(`billingState=${user.billingState ?? '—'} country=${user.billingCountry} gstin=${user.gstin ?? '—'}`);

  const subs = await prisma.subscription.findMany({ where: { userId: user.id }, include: { plan: true } });
  console.log(`\n=== SUBSCRIPTIONS (${subs.length}) ===`);
  for (const s of subs) {
    console.log(`- ${s.plan.displayName} | ${s.status} | end=${s.currentEnd?.toISOString() ?? '—'} | cancelAtCycleEnd=${s.cancelAtCycleEnd} | rzp=${s.razorpaySubscriptionId}`);
  }

  const ents = await prisma.entitlement.findMany({ where: { userId: user.id }, orderBy: { grantedAt: 'desc' } });
  console.log(`\n=== ENTITLEMENTS (${ents.length}) ===`);
  for (const e of ents) {
    console.log(`- ${e.kind} value=${e.value ?? '∞'} source=${e.source} expires=${e.expiresAt?.toISOString() ?? 'never'} consumed=${e.consumedAt ? 'yes' : 'no'}`);
  }

  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    include: { plan: true, payment: true, invoice: true },
  });
  console.log(`\n=== ORDERS (${orders.length}) ===`);
  for (const o of orders) {
    console.log(`- ${o.plan.displayName} | ${o.kind} | ${o.status} | ${formatINR(o.amountPaise)} | rzpOrder=${o.razorpayOrderId ?? '—'} pay=${o.razorpayPaymentId ?? '—'}`);
    if (o.invoice) {
      console.log(`    invoice ${o.invoice.invoiceNumber} | ${o.invoice.gstTreatment} | total=${formatINR(o.invoice.totalPaise)} | pdf=${o.invoice.pdfUrl ?? 'NOT YET'}`);
    }
  }

  const events = await prisma.webhookEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 10 });
  console.log(`\n=== RECENT WEBHOOK EVENTS (${events.length}) ===`);
  for (const ev of events) {
    console.log(`- ${ev.eventType} | ${ev.status} | ${ev.error ?? ''} | ${ev.createdAt.toISOString()}`);
  }
  console.log('');
}

main().finally(() => prisma.$disconnect());
