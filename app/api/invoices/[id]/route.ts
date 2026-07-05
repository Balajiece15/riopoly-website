import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { getInvoiceSignedUrl } from '@/lib/storage';

export const runtime = 'nodejs';

/** Redirects to a short-lived signed URL for the user's own invoice PDF. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const invoice = await prisma.invoice.findUnique({ where: { id: params.id } });
  if (!invoice || invoice.userId !== user.id) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

  if (!invoice.pdfUrl) {
    return NextResponse.json(
      { error: 'Invoice PDF is still being generated. Try again in a moment.' },
      { status: 409 },
    );
  }

  const signedUrl = await getInvoiceSignedUrl(invoice.pdfUrl, 300);
  return NextResponse.redirect(signedUrl);
}
