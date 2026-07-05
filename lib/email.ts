import { Resend } from 'resend';
import { formatINR } from './plans';

const EMAIL_FROM = process.env.EMAIL_FROM ?? 'RioPoly <onboarding@resend.dev>';

function resendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  return new Resend(process.env.RESEND_API_KEY);
}

export async function sendInvoiceEmail(args: {
  to: string;
  invoiceNumber: string;
  totalPaise: number;
  lineItemName: string;
  pdf: Buffer;
}): Promise<{ sent: boolean; reason?: string }> {
  const resend = resendClient();
  if (!resend) {
    return { sent: false, reason: 'RESEND_API_KEY not set' };
  }

  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: args.to,
    subject: `Your RioPoly invoice ${args.invoiceNumber}`,
    html: `
      <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:auto;color:#1e293b">
        <h2 style="color:#4f46e5">Thanks for your purchase</h2>
        <p>Your payment for <strong>${args.lineItemName}</strong> was successful.</p>
        <p>Invoice <strong>${args.invoiceNumber}</strong> · Total <strong>${formatINR(args.totalPaise)}</strong></p>
        <p>Your tax invoice is attached as a PDF.</p>
        <p style="color:#64748b;font-size:13px">RioPoly · Visualize. Propose. Close.</p>
      </div>`,
    attachments: [{ filename: `${args.invoiceNumber}.pdf`, content: args.pdf }],
  });

  if (error) return { sent: false, reason: error.message };
  return { sent: true };
}
