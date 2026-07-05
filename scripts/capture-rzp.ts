/** Manually capture an authorized Razorpay payment (test helper). */
import 'dotenv/config';
import { razorpay } from '../lib/razorpay';

async function main() {
  const paymentId = process.argv[2];
  if (!paymentId) {
    console.log('Usage: npm run capture:rzp -- <payment_id>');
    return;
  }
  const p = await razorpay.payments.fetch(paymentId);
  console.log('Before:', { id: p.id, status: p.status, amount: p.amount, currency: p.currency });

  if (p.status !== 'authorized') {
    console.log(`Payment is "${p.status}" (not authorized) — nothing to capture.`);
    return;
  }

  // With customer-fee-bearer, capture the ORDER amount (pass via arg); Razorpay adds the fee.
  const amount = process.argv[3] ? Number(process.argv[3]) : Number(p.amount);
  const captured = await razorpay.payments.capture(paymentId, amount, String(p.currency));
  console.log('After:', { id: captured.id, status: captured.status, amount: captured.amount });
}

main().catch((e) => console.error(e?.error ?? e));
