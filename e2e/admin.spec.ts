import { test, expect, type Page } from '@playwright/test';
async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).not.toHaveURL(/login/);
}
test('Admin Create → Stock → Sell → Fulfil → Analyse and live brand changes', async ({
  page,
  browser,
}) => {
  test.setTimeout(180000);
  await login(page, 'admin@halden.test', 'Admin#12345');
  await page.goto('/admin/products/new');
  await page.getByLabel('Product name', { exact: true }).fill('Portfolio field case');
  await page.getByLabel('Slug (generated when blank)').fill('portfolio-field-case');
  await page
    .getByLabel('Description', { exact: true })
    .fill('<p>A durable <strong>everyday</strong> case, made for travel.</p>');
  await page.getByRole('combobox', { name: /^Category/ }).selectOption({ label: 'Personal audio' });
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aUj8AAAAASUVORK5CYII=',
    'base64',
  );
  await page
    .getByLabel('Upload images')
    .setInputFiles(
      [1, 2, 3].map((i) => ({ name: `case-${i}.png`, mimeType: 'image/png', buffer: png })),
    );
  await expect(page.locator('.media-grid img')).toHaveCount(3);
  await page.getByRole('button', { name: 'Move image 3 earlier' }).click();
  await page.getByLabel('Option 1 name').fill('Color');
  await page.getByLabel('Option 1 values').fill('Black, Sand, Blue');
  await page.getByRole('button', { name: 'Add option', exact: true }).click();
  await page.getByLabel('Option 2 name').fill('Storage');
  await page.getByLabel('Option 2 values').fill('128, 256');
  await page.getByRole('button', { name: 'Generate variants', exact: true }).click();
  for (let i = 1; i <= 6; i++) {
    await page.getByLabel(`Variant ${i} SKU`, { exact: true }).fill(`PORTFOLIO-${i}`);
    await page.getByLabel(`Variant ${i} price`, { exact: true }).fill('15000');
    await page.getByLabel(`Variant ${i} stock`, { exact: true }).fill('8');
  }
  await page.getByLabel('Specification 1 label').fill('Material');
  await page.getByLabel('Specification 1 value').fill('Recycled canvas');
  await page.getByLabel('Meta title', { exact: true }).fill('Portfolio field case');
  await page.getByLabel('Meta description', { exact: true }).fill('Durable everyday carry.');
  await page.getByRole('combobox', { name: /^Publication status/ }).selectOption('active');
  await page.getByRole('button', { name: 'Save product', exact: true }).click();
  await expect(page).toHaveURL(/admin\/products\/[a-f0-9]{24}$/);
  const productId = page.url().split('/').pop();
  expect(productId).toBeTruthy();
  await expect(page.getByRole('link', { name: 'Preview on storefront ↗' })).toBeVisible();
  await page.getByRole('link', { name: 'Inventory', exact: true }).click();
  await page.getByLabel('Search SKU or product').fill('PORTFOLIO-1');
  await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await page.getByRole('button', { name: 'Adjust PORTFOLIO-1', exact: true }).click();
  await page.getByLabel('Adjustment delta').fill('-5');
  await page.getByLabel('Adjustment note').fill('Pre-sale count adjustment');
  await page.getByRole('button', { name: 'Save adjustment', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('tbody tr').first()).toContainText('3');
  await page.getByRole('button', { name: 'Movement history', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Pre-sale count adjustment');
  await page.getByRole('button', { name: 'Close history' }).click();
  const context = await browser.newContext();
  const customer = await context.newPage();
  await login(customer, 'customer@halden.test', 'Customer#12345');
  await customer.goto('/products/portfolio-field-case');
  await expect(
    customer.getByRole('heading', { name: 'Portfolio field case', exact: true }),
  ).toBeVisible();
  await expect(customer.locator('.product-description strong')).toHaveText('everyday');
  await customer.getByRole('button', { name: 'Add to cart', exact: true }).click();
  await customer.getByRole('dialog').getByRole('link', { name: 'View cart and totals' }).click();
  await customer.getByRole('button', { name: 'Continue to checkout' }).click();
  await customer.getByRole('button', { name: 'Continue to shipping' }).click();
  await customer.getByRole('radio', { name: /Standard delivery/ }).check();
  await customer.getByRole('button', { name: 'Continue to payment' }).click();
  await customer.getByRole('radio', { name: 'Cash on delivery' }).check();
  await customer.getByRole('button', { name: 'Review order', exact: true }).click();
  await customer.getByRole('button', { name: 'Place order', exact: true }).click();
  await expect(customer).toHaveURL(/checkout\/success\/HLD-/);
  const number = customer.url().split('/').pop() ?? '';
  await page.getByRole('link', { name: 'Orders', exact: true }).click();
  await page.getByLabel('Order number or customer email').fill(number);
  await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await page.getByRole('link', { name: number, exact: true }).click();
  await page.getByRole('button', { name: 'Mark paid', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.locator('.badge')).toHaveText('paid');
  await page.getByRole('button', { name: 'Mark shipped', exact: true }).click();
  await page.getByLabel('Carrier', { exact: true }).fill('Portfolio Parcel');
  await page.getByLabel('Tracking number', { exact: true }).fill('PORTFOLIO-TRACK-001');
  await page.getByRole('button', { name: 'Confirm shipment', exact: true }).click();
  await expect(page.locator('.badge')).toHaveText('shipped');
  await page.getByRole('button', { name: 'Complete order', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.locator('.badge')).toHaveText('completed');
  await expect(page.getByRole('button', { name: 'Mark paid', exact: true })).toHaveCount(0);
  await customer.reload();
  await expect(customer.getByText('PORTFOLIO-TRACK-001', { exact: false })).toBeVisible();
  await expect(customer.locator('.badge')).toHaveText('completed');
  await page.getByRole('link', { name: 'Analytics', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Analytics', exact: true })).toBeVisible();
  await expect(page.getByText('Portfolio field case · 1 units', { exact: false })).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export orders CSV' }).click();
  expect((await downloadPromise).suggestedFilename()).toBe('orders.csv');
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Store name', { exact: true }).fill('Northline');
  await page.getByLabel('Tagline', { exact: true }).fill('Designed for everyday life.');
  await page.getByLabel('Primary theme colour').fill('#123456');
  await page.getByLabel('Accent theme colour').fill('#987654');
  await page.getByLabel('Enable wishlist', { exact: true }).uncheck();
  await page.getByRole('button', { name: 'Save settings', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Settings saved');
  await page.getByRole('link', { name: 'View storefront ↗' }).click();
  await expect(page.getByRole('link', { name: 'Northline', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /^Wishlist/ })).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--color-ink').trim(),
    ),
  ).toBe('#123456');
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Revenue over time', exact: true })).toBeVisible();
  for (const width of [360, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
  }
  await customer.goto('/admin');
  await expect(customer).not.toHaveURL(/\/admin/);
  await context.close();
});
