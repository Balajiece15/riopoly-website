// One-shot: create the private "invoices" bucket in Supabase Storage.
// Run: npm run setup:storage  (needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)

import 'dotenv/config';
import { ensureInvoiceBucket, INVOICE_BUCKET } from '../lib/storage';

ensureInvoiceBucket()
  .then(() => console.log(`✔ Storage bucket "${INVOICE_BUCKET}" is ready.`))
  .catch((err) => {
    console.error('Storage setup failed:', err?.message ?? err);
    process.exitCode = 1;
  });
