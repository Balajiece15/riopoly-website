import Razorpay from 'razorpay';

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

if (!keyId || !keySecret) {
  // Fail loudly on the server only; never expose the secret in the message.
  throw new Error(
    'Razorpay credentials missing: set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in the server environment.',
  );
}

// Server-only Razorpay client. NEVER import this into a "use client" module.
export const razorpay = new Razorpay({
  key_id: keyId,
  key_secret: keySecret,
});

export const RAZORPAY_PUBLIC_KEY_ID = keyId;
