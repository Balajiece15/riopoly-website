import type { Prisma } from '@prisma/client';
import { computeGstInclusive, gstTreatmentFor } from './gst';

/** Indian fiscal year (Apr 1 – Mar 31); labelled by its starting calendar year. */
export function fiscalYearFor(date = new Date()): number {
  const month = date.getMonth(); // 0 = Jan
  const year = date.getFullYear();
  return month >= 3 ? year : year - 1;
}

/**
 * Create a GST invoice for an order, allocating a sequential
 * GTA-RIO-YYYY-NNNNN number. MUST run inside the same transaction as the
 * Order/Payment writes. A transaction-scoped advisory lock serializes
 * numbering so two concurrent webhooks can't grab the same sequence.
 */
export async function createInvoiceForOrder(
  tx: Prisma.TransactionClient,
  params: { orderId: string; userId: string; grossPaise: number },
) {
  const user = await tx.user.findUnique({ where: { id: params.userId } });
  const treatment = gstTreatmentFor(user?.billingState, user?.billingCountry);
  const g = computeGstInclusive(params.grossPaise, treatment);
  const fy = fiscalYearFor();

  // Serialize invoice numbering for this fiscal year within the transaction.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${fy})`;
  const count = await tx.invoice.count({ where: { fiscalYear: fy } });
  const seq = count + 1;
  const invoiceNumber = `GTA-RIO-${fy}-${String(seq).padStart(5, '0')}`;

  return tx.invoice.create({
    data: {
      orderId: params.orderId,
      userId: params.userId,
      invoiceNumber,
      fiscalYear: fy,
      seq,
      taxablePaise: g.taxablePaise,
      cgstPaise: g.cgstPaise,
      sgstPaise: g.sgstPaise,
      igstPaise: g.igstPaise,
      totalPaise: g.totalPaise,
      gstTreatment: g.treatment,
      placeOfSupplyState: user?.billingState ?? null,
      customerGstin: user?.gstin ?? null,
      currency: 'INR',
      // pdfUrl is filled in Phase 5 (render + upload to Supabase Storage).
    },
  });
}
