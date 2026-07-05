/** Fetch a Razorpay order + its payments to see capture status. */
import 'dotenv/config';
import { razorpay } from '../lib/razorpay';

async function main() {
  const orderId = process.argv[2];
  if (!orderId) {
    console.log('Usage: npm run check:rzp -- <order_id>');
    return;
  }
  const order = await razorpay.orders.fetch(orderId);
  console.log('ORDER:', {
    id: order.id,
    amount: order.amount,
    status: order.status,
    amount_paid: order.amount_paid,
    attempts: order.attempts,
  });

  const payments = await razorpay.orders.fetchPayments(orderId);
  console.log(`\nPAYMENTS (${payments.count}):`);
  for (const p of payments.items) {
    console.log('-', {
      id: p.id,
      status: p.status,
      amount: p.amount,
      method: p.method,
      captured: p.captured,
      error: p.error_description,
    });
  }
}

main().catch((e) => console.error(e));
