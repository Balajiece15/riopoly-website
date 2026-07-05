import { test, expect } from '@playwright/test';

test.describe('billing dashboard (authenticated)', () => {
  test('shows the signed-in user and access summary', async ({ page }) => {
    await page.goto('/billing');
    await expect(page).toHaveURL(/\/billing/);
    await expect(page.getByRole('heading', { name: 'Billing' })).toBeVisible();
    await expect(page.locator('body')).toContainText('request@gotoanalyze.com');
    // From the verified one-time purchase the user has at least 1 credit (or unlimited).
    await expect(page.locator('body')).toContainText(/project credit|Unlimited/i);
  });

  test('lists the paid order with a downloadable invoice', async ({ page }) => {
    await page.goto('/billing');
    await expect(page.getByText('Order history')).toBeVisible();
    await expect(page.locator('body')).toContainText('Single Project');
    await expect(page.locator('body')).toContainText(/GTA-RIO-\d{4}-\d{5}/);
    await expect(page.locator('a[href^="/api/invoices/"]').first()).toBeVisible();
  });

  test('invoice download returns a PDF', async ({ page }) => {
    await page.goto('/billing');
    const link = page.locator('a[href^="/api/invoices/"]').first();
    const href = await link.getAttribute('href');
    expect(href).toBeTruthy();

    // Route redirects (302) to a signed Supabase URL; request follows it to the PDF.
    const res = await page.request.get(href!);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('application/pdf');
  });

  test('CTAs link to pricing', async ({ page }) => {
    await page.goto('/billing');
    await expect(page.locator('a[href="/pricing"]').first()).toBeVisible();
    await expect(page.locator('a[href="/terms"]').first()).toBeVisible();
  });
});

test.describe('one-time checkout initiation', () => {
  test('clicking Buy now creates an order and opens Razorpay', async ({ page }) => {
    await page.goto('/pricing');

    const orderReq = page.waitForResponse(
      (r) => r.url().includes('/api/orders/create') && r.request().method() === 'POST',
      { timeout: 20_000 },
    );

    // One-time plans are the only "Buy now" buttons (subscriptions say "Subscribe");
    // Single Project is the first one.
    await page.getByRole('button', { name: 'Buy now' }).first().click();

    const res = await orderReq;
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.orderId).toMatch(/^order_/);
    expect(body.type).toBe('one_time');

    // Razorpay Checkout injects its overlay (.razorpay-container + iframe).
    await expect(
      page.locator('.razorpay-container, iframe.razorpay-checkout-frame').first(),
    ).toBeVisible({ timeout: 20_000 });
  });
});
