import { test, expect } from '@playwright/test';

test.describe('public pages', () => {
  test('home renders and links to login + billing', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
    // Home should offer a way into the app.
    const hasLink = await page.locator('a[href="/login"], a[href="/billing"]').count();
    expect(hasLink).toBeGreaterThan(0);
  });

  test('pricing shows all 7 SKUs with correct prices', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page.getByRole('heading', { name: 'Pricing' })).toBeVisible();

    for (const name of ['Pro · Monthly', 'Pro · Yearly', 'Agency · Monthly', 'Agency · Yearly', 'Single Project', 'Pack of 10', 'Pack of 50']) {
      await expect(page.getByRole('heading', { name })).toBeVisible();
    }

    const body = page.locator('body');
    for (const price of ['₹1,499', '₹14,999', '₹4,999', '₹49,999', '₹499', '₹3,999']) {
      await expect(body).toContainText(price);
    }

    // RBI AFA warning appears for the > ₹15k plan (agency-yearly) only.
    await expect(page.getByText(/extra bank authentication/i)).toHaveCount(1);

    // No-refund policy disclosed at point of sale, linking to /terms.
    await expect(page.locator('a[href="/terms"]').first()).toBeVisible();

    // Each plan has an actionable checkout button.
    const buttons = page.getByRole('button', { name: /Subscribe|Buy now/ });
    expect(await buttons.count()).toBe(7);
  });

  test('terms page states the no-refund policy and GST identity', async ({ page }) => {
    await page.goto('/terms');
    await expect(page.getByRole('heading', { name: /Terms of Service/i })).toBeVisible();
    await expect(page.locator('body')).toContainText(/no refunds/i);
    await expect(page.locator('body')).toContainText('33AALCG6598F1Z7');
    await expect(page.locator('body')).toContainText(/cancel anytime/i);
    await expect(page.locator('body')).toContainText(/net of non-refundable payment-processing/i);
  });

  test('login page shows the email magic-link form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /Sign in to RioPoly/i })).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign-in link/i })).toBeVisible();
  });

  test('billing redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/billing');
    await expect(page).toHaveURL(/\/login/);
  });

  test('login page surfaces sign-in errors inline', async ({ page }) => {
    await page.goto('/login?error=EmailSignin');
    await expect(page.getByText(/couldn't send the sign-in email/i)).toBeVisible();
    // The form is still shown so the user can retry.
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });
});

test.describe('API requires auth (no session cookie)', () => {
  test('orders/create returns 401', async ({ request }) => {
    const res = await request.post('/api/orders/create', { data: { sku: 'single-project' } });
    expect(res.status()).toBe(401);
  });

  test('subscriptions/create returns 401', async ({ request }) => {
    const res = await request.post('/api/subscriptions/create', { data: { sku: 'pro-monthly' } });
    expect(res.status()).toBe(401);
  });

  test('invoices/[id] returns 401', async ({ request }) => {
    const res = await request.get('/api/invoices/some-id', { maxRedirects: 0 });
    expect(res.status()).toBe(401);
  });

  test('webhook rejects unsigned requests with 401', async ({ request }) => {
    const res = await request.post('/api/webhook/razorpay', {
      headers: { 'x-razorpay-event-id': 'evt_fake', 'content-type': 'application/json' },
      data: { event: 'payment.captured' },
    });
    expect(res.status()).toBe(401);
  });
});
