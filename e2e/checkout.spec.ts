import { test, expect, type Page } from '@playwright/test';
async function registerAndAdd(page: Page) {
  await page.goto('/register');
  await page.getByLabel('First name').fill('Checkout');
  await page.getByLabel('Last name').fill('Tester');
  await page
    .getByLabel('Email', { exact: true })
    .fill(`checkout-${crypto.randomUUID()}@example.com`);
  await page.getByLabel('Password', { exact: true }).fill('ExamplePassword9');
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(page).not.toHaveURL(/register/);
  await page.goto('/shop');
  await page.getByLabel('Search products', { exact: true }).fill('headphones');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  const filtersButton = page.getByRole('button', { name: 'Filters', exact: true });
  if (await filtersButton.isVisible()) await filtersButton.click();
  await page.getByLabel('In stock only').check();
  await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await page.getByLabel('Sort by').selectOption('price');
  await expect(page).toHaveURL(/inStock=true/);
  await page
    .getByRole('heading', { name: 'Fold travel headphones', exact: true })
    .getByRole('link')
    .click();
  await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
  await page.getByRole('dialog').getByRole('link', { name: 'View cart and totals' }).click();
  await expect(page.locator('.item')).toHaveCount(1);
}
async function addressSteps(page: Page, shipping = 'Standard delivery') {
  await page.getByRole('button', { name: 'Continue to checkout' }).click();
  await page.getByLabel('Street address', { exact: true }).fill('10 Market Street');
  await page.getByLabel('City', { exact: true }).fill('Lahore');
  await page.getByLabel('State or region').fill('Punjab');
  await page.getByLabel('Postal code').fill('54000');
  await page.getByLabel('Country code (two letters)', { exact: true }).fill('PK');
  await page.getByLabel('Phone with country code').fill('+923001234567');
  await page.getByRole('button', { name: 'Continue to shipping' }).click();
  await page.getByRole('radio', { name: new RegExp(shipping) }).check();
  await page.getByRole('button', { name: 'Continue to payment' }).click();
}
async function cardReview(page: Page, number: string) {
  await page.getByLabel('Card number').fill(number);
  await page.getByLabel('Expiry').fill('12/30');
  await page.getByLabel('CVC').fill('123');
  await page.getByRole('button', { name: 'Review order', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Place order', exact: true })).toBeVisible();
}
test('search/filter shopping journey and discounted card checkout use MongoDB with no PAN or client prices', async ({
  page,
}) => {
  await registerAndAdd(page);
  await page.getByLabel('Discount code').fill('WELCOME10');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.getByText('Code WELCOME10')).toBeVisible();
  const bodies: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/v1/')) bodies.push(request.postData() ?? '');
  });
  await addressSteps(page, 'Express delivery');
  await cardReview(page, '4242 4242 4242 4242');
  let dropResponse = true;
  const submissionKeys: (string | undefined)[] = [];
  await page.route('**/api/v1/orders', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    submissionKeys.push(route.request().headers()['idempotency-key']);
    if (dropResponse) {
      dropResponse = false;
      const committed = await route.fetch();
      expect(committed.status()).toBe(201);
      await route.abort('failed');
    } else {
      await route.continue();
    }
  });
  await page.getByRole('button', { name: 'Place order', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Check pending order' })).toBeVisible();
  await page.getByRole('button', { name: 'Check pending order' }).click();
  await expect(page).toHaveURL(/checkout\/success\/HLD-/);
  expect(submissionKeys).toHaveLength(2);
  expect(submissionKeys[0]).toBeTruthy();
  expect(submissionKeys[1]).toBe(submissionKeys[0]);
  await expect(page.getByRole('heading', { name: 'Thank you for your order.' })).toBeVisible();
  expect(bodies.join('')).not.toMatch(/4242424242424242|"cvc"|"unitPrice"|"totals"/);
  await page.getByRole('link', { name: 'Order history', exact: true }).click();
  await expect(page.locator('app-order-history .panel')).toHaveCount(1);
  await page.getByRole('link', { name: /^Cart \(/ }).click();
  await expect(page.getByRole('heading', { name: 'Your cart is waiting.' })).toBeVisible();
});
test('declined payment preserves the cart and can be corrected to COD and cancelled', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await registerAndAdd(page);
  await addressSteps(page);
  await cardReview(page, '4000 0000 0000 0002');
  await page.getByRole('button', { name: 'Place order', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'declined' })).toBeVisible();
  await page.getByRole('button', { name: 'Edit payment', exact: true }).click();
  await page.getByRole('radio', { name: 'Cash on delivery' }).check();
  await page.getByRole('button', { name: 'Review order', exact: true }).click();
  await page.getByRole('button', { name: 'Place order', exact: true }).click();
  await expect(page).toHaveURL(/checkout\/success/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  page.once('dialog', (dialog) => {
    void dialog.accept();
  });
  await page.getByRole('button', { name: 'Cancel order', exact: true }).click();
  await expect(page.locator('.badge')).toHaveText('cancelled');
});
