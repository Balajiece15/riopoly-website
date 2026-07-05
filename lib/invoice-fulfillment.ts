import { prisma } from './prisma';
import { renderInvoicePdf, type InvoiceData } from './invoice-pdf';
import { uploadInvoicePdf } from './storage';
import { sendInvoiceEmail } from './email';
import { getPlanOrThrow } from './plans';

/**
 * Render the invoice PDF, store it in Supabase, save the path, and email it.
 * Best-effort: never throws into the webhook (a failure here must not cause
 * Razorpay to re-deliver and re-create orders). Safe to re-run.
 */
export async function fulfillInvoice(invoiceId: string): Promise<void> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { order: { include: { plan: true } }, user: true },
  });
  if (!invoice) return;

  const data: InvoiceData = {
    invoiceNumber: invoice.invoiceNumber,
    issuedAt: invoice.issuedAt,
    gstTreatment: invoice.gstTreatment,
    placeOfSupplyState: invoice.placeOfSupplyState,
    taxablePaise: invoice.taxablePaise,
    cgstPaise: invoice.cgstPaise,
    sgstPaise: invoice.sgstPaise,
    igstPaise: invoice.igstPaise,
    totalPaise: invoice.totalPaise,
    buyer: {
      name: invoice.user.name,
      email: invoice.user.email,
      state: invoice.user.billingState,
      gstin: invoice.customerGstin,
    },
    lineItemName: invoice.order?.plan?.displayName ?? getPlanOrThrow(invoice.order.planId).displayName,
  };

  const pdf = await renderInvoicePdf(data);
  const path = `${invoice.fiscalYear}/${invoice.invoiceNumber}.pdf`;

  await uploadInvoicePdf(path, pdf);
  await prisma.invoice.update({ where: { id: invoice.id }, data: { pdfUrl: path } });

  await sendInvoiceEmail({
    to: invoice.user.email,
    invoiceNumber: invoice.invoiceNumber,
    totalPaise: invoice.totalPaise,
    lineItemName: data.lineItemName,
    pdf,
  });
}

/** Wrap fulfillInvoice so webhook handlers can fire-and-forget safely. */
export async function tryFulfillInvoice(invoiceId: string): Promise<void> {
  try {
    await fulfillInvoice(invoiceId);
  } catch (err) {
    console.error(`[invoice] fulfillment failed for ${invoiceId}:`, err);
  }
}
