import { createClient } from '@supabase/supabase-js';

// Server-only Supabase client using the SERVICE ROLE key (bypasses RLS).
// NEVER import this into a client component.
const url = process.env.SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const INVOICE_BUCKET = 'invoices';

function client() {
  if (!url || !serviceRole) {
    throw new Error('Supabase storage not configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }
  return createClient(url, serviceRole, { auth: { persistSession: false } });
}

/** Upload (or overwrite) an invoice PDF. Returns the storage path. */
export async function uploadInvoicePdf(path: string, pdf: Buffer): Promise<string> {
  const supabase = client();
  const { error } = await supabase.storage
    .from(INVOICE_BUCKET)
    .upload(path, pdf, { contentType: 'application/pdf', upsert: true });
  if (error) throw new Error(`Invoice upload failed: ${error.message}`);
  return path;
}

/** Time-limited signed URL for a stored invoice (private bucket). */
export async function getInvoiceSignedUrl(path: string, expiresInSeconds = 3600): Promise<string> {
  const supabase = client();
  const { data, error } = await supabase.storage
    .from(INVOICE_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error || !data) throw new Error(`Signed URL failed: ${error?.message ?? 'unknown'}`);
  return data.signedUrl;
}

/** Idempotently ensure the private invoices bucket exists. */
export async function ensureInvoiceBucket(): Promise<void> {
  const supabase = client();
  const { data } = await supabase.storage.getBucket(INVOICE_BUCKET);
  if (!data) {
    const { error } = await supabase.storage.createBucket(INVOICE_BUCKET, { public: false });
    if (error && !/already exists/i.test(error.message)) {
      throw new Error(`Could not create bucket: ${error.message}`);
    }
  }
}
