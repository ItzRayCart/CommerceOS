import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
test('collections support horizontal browsing, complete pagination, keyboard access and partial retry', async ({
  page,
  request,
}, info) => {
  test.setTimeout(120000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Premium', exact: true })).toBeVisible();
  const premium = page.getByRole('region', { name: 'Premium', exact: true });
  const track = premium.getByRole('list', { name: 'Premium products', exact: true });
  await expect(track.getByRole('listitem')).toHaveCount(8);
  for (const width of [360, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    await expect.poll(() => track.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  }
  await expect(
    premium.getByRole('button', { name: 'Previous Premium products', exact: true }),
  ).toBeDisabled();
  await premium.getByRole('button', { name: 'Next Premium products', exact: true }).click();
  await expect.poll(() => track.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  await track.focus();
  await track.press('Home');
  await expect.poll(() => track.evaluate((el) => el.scrollLeft)).toBe(0);
  await track.press('End');
  await expect(
    premium.getByRole('button', { name: 'Next Premium products', exact: true }),
  ).toBeDisabled();
  const end = await track.evaluate((el) => el.scrollLeft);
  await track.press('ArrowLeft');
  await expect.poll(() => track.evaluate((el) => el.scrollLeft)).toBeLessThan(end);
  await track.press('Home');
  await track.hover();
  await page.mouse.wheel(400, 0);
  await expect.poll(() => track.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  const best = page.getByRole('region', { name: 'Best Selling', exact: true });
  const bestList = best.getByRole('list', { name: 'Best Selling products' });
  await expect(bestList.getByRole('listitem')).toHaveCount(8);
  for (const count of [16, 24, 30]) {
    await best
      .getByRole('button', { name: 'Load more Best Selling products', exact: true })
      .click();
    await expect(bestList.getByRole('listitem')).toHaveCount(count);
  }
  await expect(
    best.getByRole('button', { name: 'Load more Best Selling products', exact: true }),
  ).toHaveCount(0);
  await expect(best.getByRole('status')).toHaveText('30 of 30 items');
  const productLinks = await bestList
    .locator('h3 a')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href')));
  expect(new Set(productLinks).size).toBe(30);
  await best.getByRole('link', { name: 'View all Best Selling', exact: true }).click();
  await expect(page).toHaveURL(/collection=best-selling/);
  await expect(page.getByRole('heading', { name: 'Best Selling', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeEnabled();
  await page.route('**/api/v1/products?*', (route) =>
    new URL(route.request().url()).searchParams.get('collection') === 'premium'
      ? route.abort()
      : route.continue(),
  );
  await page.goto('/');
  await expect(premium.getByRole('button', { name: 'Retry Premium', exact: true })).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Hot', exact: true }).getByRole('listitem').first(),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'We could not load the store' })).toHaveCount(0);
  await page.unroute('**/api/v1/products?*');
  await premium.getByRole('button', { name: 'Retry Premium', exact: true }).click();
  await expect(track.getByRole('listitem')).toHaveCount(8);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await expect
    .poll(() =>
      page
        .locator('.home__hero-copy h1')
        .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
    )
    .toBeGreaterThan(48);
  expect(
    (await page.locator('.home__hero-copy p').innerText()).trim().split(/\s+/).length,
  ).toBeLessThanOrEqual(8);
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: info.outputPath('collections-desktop.png') });
  const samples: number[] = [];
  for (let i = 0; i < 25; i++) {
    const started = performance.now();
    const response = await request.get(
      '/api/v1/products?collection=best-selling&limit=8&includeFacets=false',
    );
    expect(response.ok()).toBe(true);
    await response.body();
    samples.push(performance.now() - started);
  }
  samples.sort((a, b) => a - b);
  const perf = {
    method:
      '25 sequential warm local HTTP samples; 30 demo products; development proxy included; not a production load-test SLA',
    medianMs: samples[12],
    p95Ms: samples[23],
    samples,
  };
  const perfPath = info.outputPath('collection-http-performance.json');
  await writeFile(perfPath, JSON.stringify(perf, null, 2));
  await info.attach('collection-http-performance', {
    path: perfPath,
    contentType: 'application/json',
  });
  await page.setViewportSize({ width: 360, height: 960 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: info.outputPath('collections-mobile.png'), fullPage: true });
});
