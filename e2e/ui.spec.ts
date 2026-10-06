import { test, expect } from '@playwright/test';
test('revamped storefront renders across breakpoints, supports guest shopping and recovers from API failure', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && m.text().startsWith('ERROR')) errors.push(m.text());
  });
  for (const [path, heading, name] of [
    ['/', 'Considered electronics', 'home'],
    ['/shop', 'Shop all products', 'catalogue'],
    ['/products/fold-headphones', 'Fold travel headphones', 'product'],
    ['/register', 'Register', 'register'],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    if (name !== 'register')
      await expect(page.locator('main app-product-card').first()).toBeVisible();
    for (const width of [360, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 960 });
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
        .toBe(true);
      if (width === 360 || width === 1440) {
        for (const image of await page.locator('main img:visible').all()) {
          await image.scrollIntoViewIfNeeded();
          await expect
            .poll(() =>
              image.evaluate(
                (node) =>
                  (node as HTMLImageElement).complete &&
                  (node as HTMLImageElement).naturalWidth > 0,
              ),
            )
            .toBe(true);
        }
        await page.evaluate(() => window.scrollTo(0, 0));
        if (name === 'home' && width === 1440)
          await page.screenshot({ path: info.outputPath('home-hero-1440.png') });
        const file = info.outputPath(`${name}-${width}.png`);
        await page.screenshot({ path: file, fullPage: true });
        await info.attach(`${name}-${width}`, { path: file, contentType: 'image/png' });
      }
    }
  }
  await page.goto('/products/fold-headphones');
  await page.setViewportSize({ width: 360, height: 960 });
  const sand = page.getByRole('button', { name: 'Sand', exact: true });
  await sand.scrollIntoViewIfNeeded();
  const beforeVariant = await page.evaluate(() => window.scrollY);
  await sand.click();
  await expect(page).toHaveURL(/variant=HLD-003-SAN/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(beforeVariant);
  await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Shopping cart' })).toBeVisible();
  await page.getByRole('link', { name: 'View cart and totals' }).click();
  await expect(page.locator('.item')).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  for (const width of [360, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
    await page.evaluate(() => window.scrollTo(0, 0));
    if (width === 360 || width === 1440)
      await page.screenshot({ path: info.outputPath(`cart-${width}.png`), fullPage: true });
  }
  await page.route('**/api/v1/products?*', (route) => route.abort());
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'We could not load the store' })).toBeVisible();
  await page.unroute('**/api/v1/products?*');
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Considered electronics', exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
