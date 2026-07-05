import { test, expect } from '@playwright/test';

// These run with the seeded session cookie (storageState), so the API sees an
// authenticated user.

test('orders/create (authed) returns a Razorpay order', async ({ request }) => {
  const res = await request.post('/api/orders/create', { data: { sku: 'single-project' } });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.type).toBe('one_time');
  expect(body.orderId).toMatch(/^order_/);
  expect(body.amount).toBe(49900);
  expect(body.keyId).toMatch(/^rzp_/);
});

test('orders/create rejects an unknown SKU with 400', async ({ request }) => {
  const res = await request.post('/api/orders/create', { data: { sku: 'does-not-exist' } });
  expect(res.status()).toBe(400);
});

test('subscriptions/create (authed) either succeeds or fails gracefully', async ({ request }) => {
  const res = await request.post('/api/subscriptions/create', { data: { sku: 'pro-monthly' } });
  // After the Razorpay fee-bearer switch this should be 200; until then it must
  // fail GRACEFULLY with a JSON error (not a 500 crash with an empty body).
  if (res.status() === 200) {
    const body = await res.json();
    expect(body.type).toBe('subscription');
    expect(body.subscriptionId).toMatch(/^sub_/);
  } else {
    expect(res.status()).toBe(502);
    const body = await res.json();
    expect(body.error).toMatch(/fee bearer|invoices disabled/i);
  }
});

test('subscriptions/create rejects a one-time SKU with 400', async ({ request }) => {
  const res = await request.post('/api/subscriptions/create', { data: { sku: 'single-project' } });
  expect(res.status()).toBe(400);
});

test('invoices/[id] returns 404 for a non-existent invoice', async ({ request }) => {
  const res = await request.get('/api/invoices/nonexistent-id', { maxRedirects: 0 });
  expect(res.status()).toBe(404);
});
