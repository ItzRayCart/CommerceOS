import { test, expect } from '@playwright/test';

test('account profile, address book, errors and password change work on mobile and desktop', async ({
  page,
  request,
}, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const email = `account-${crypto.randomUUID()}@example.com`;
  await page.goto('/register');
  await page.getByLabel('First name', { exact: true }).fill('Avery');
  await page.getByLabel('Last name', { exact: true }).fill('Gray');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('ExamplePassword9');
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole('heading', { name: 'Personal details', exact: true })).toBeVisible();
  for (const width of [360, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    if (width === 360 || width === 1440)
      await page.screenshot({ path: info.outputPath(`account-${width}.png`), fullPage: true });
  }
  await page.getByLabel('First name', { exact: true }).fill('Morgan');
  await page.getByLabel('Phone number', { exact: true }).fill('invalid');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Use 7–15 digits, with an optional + country code.')).toBeVisible();
  await page.getByLabel('Phone number', { exact: true }).fill('+16175550100');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Your profile has been saved.' }),
  ).toBeVisible();
  await page.getByLabel('Phone number', { exact: true }).fill('');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Your profile has been saved.' }),
  ).toBeVisible();
  const sidebar = page.locator('.account-sidebar');
  await sidebar.getByRole('link', { name: /Address book/ }).click();
  await expect(page).toHaveURL(/\/account\/addresses$/);
  await expect(page.getByRole('heading', { name: 'Address book', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add address', exact: true }).click();
  await page.getByLabel('Address label').fill('Home');
  await page.getByLabel('Full name', { exact: true }).fill('Morgan Gray');
  await page.getByLabel('Address line 1').fill('12 Main Street');
  await page.getByLabel('Address line 2 (optional)').fill('Apartment 2');
  await page.getByLabel('City', { exact: true }).fill('Boston');
  await page.getByLabel('State / region').fill('MA');
  await page.getByLabel('Postal code').fill('02108');
  await page.getByLabel('Country code', { exact: true }).fill('us');
  await page.getByLabel('Delivery phone').fill('+16175550100');
  await page.getByRole('button', { name: 'Save address' }).click();
  const address = page.locator('.address-card');
  await expect(address).toHaveCount(1);
  await expect(address.getByText('Default', { exact: true })).toBeVisible();
  await address.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Address line 1').fill('24 Main Street');
  await page.getByRole('button', { name: 'Save address' }).click();
  await expect(address).toContainText('24 Main Street');
  await page.setViewportSize({ width: 360, height: 960 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await page.screenshot({ path: info.outputPath('address-book-360.png'), fullPage: true });
  await address.getByRole('button', { name: 'Remove', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Remove Home?' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Keep address' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(address).toHaveCount(1);
  await address.getByRole('button', { name: 'Remove', exact: true }).click();
  await page.route('**/api/v1/me/addresses/*', (route) =>
    route.request().method() === 'DELETE'
      ? route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: { message: 'Unavailable' } }),
        })
      : route.continue(),
  );
  await dialog.getByRole('button', { name: 'Remove address', exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveText(
    'The store is temporarily unavailable. Please try again shortly.',
  );
  await expect(address).toHaveCount(1);
  await page.unroute('**/api/v1/me/addresses/*');
  await dialog.getByRole('button', { name: 'Remove address', exact: true }).click();
  await expect(address).toHaveCount(0);
  await expect(dialog).not.toBeVisible();
  await sidebar.getByRole('link', { name: /Your orders/ }).click();
  await expect(page.getByRole('heading', { name: 'Order history', exact: true })).toBeVisible();
  await page.goto('/account?tab=security');
  await expect(
    page.getByRole('heading', { name: 'Sign-in & security', exact: true }),
  ).toBeVisible();
  await page.getByLabel('Current password').fill('WrongPassword9');
  await page.getByLabel('New password', { exact: true }).fill('UpdatedPassword8');
  await page.getByLabel('Confirm new password').fill('DifferentPassword8');
  await page.getByRole('button', { name: 'Update password' }).click();
  await expect(page.getByText("The passwords don't match.")).toBeVisible();
  await page.getByLabel('Confirm new password').fill('UpdatedPassword8');
  await page.getByRole('button', { name: 'Update password' }).click();
  await expect(page.getByRole('alert')).toHaveText('Current password is incorrect');
  const oldCookie = (await page.context().cookies()).find((cookie) => cookie.httpOnly);
  expect(oldCookie).toBeTruthy();
  await page.getByLabel('Current password').fill('ExamplePassword9');
  await page.getByRole('button', { name: 'Update password' }).click();
  await expect(page).toHaveURL(/\/login/);
  const expired = await request.post('/api/v1/auth/refresh', {
    headers: { Cookie: `${oldCookie!.name}=${oldCookie!.value}` },
    data: {},
  });
  expect(expired.status()).toBe(401);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('UpdatedPassword8');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/\/account/);
  expect(errors).toEqual([]);
});
