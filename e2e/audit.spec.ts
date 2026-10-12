import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
test('baseline shopper and merchant usability audit', async ({ page, request }, info) => {
  test.setTimeout(120000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const productRequests: unknown[] = [];
  let categoryRequests = 0;
  const pending: Promise<void>[] = [];
  page.on('response', (response) => {
    if (response.url().includes('/api/v1/categories')) categoryRequests++;
    if (response.url().includes('/api/v1/products?'))
      pending.push(
        (async () => {
          await response.finished();
          const payload = (await response.json()) as {
            data: unknown[];
            meta: { total: number; facets?: unknown };
          };
          productRequests.push({
            url: new URL(response.url()).search,
            rows: payload.data.length,
            total: payload.meta.total,
            facets: !!payload.meta.facets,
            elapsedMs: response.request().timing().responseEnd,
          });
        })(),
      );
  });
  const started = performance.now();
  await page.goto('/');
  await expect(page.locator('main app-product-card').first()).toBeVisible();
  await Promise.all(pending);
  const homeReadyMs = Math.round(performance.now() - started);
  const homeRequests = [...productRequests];
  const homeCategories = categoryRequests;
  const headings = await page.locator('main h2').allTextContents();
  const layouts = [];
  for (const width of [360, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    layouts.push(
      await page.evaluate(() => ({
        width: innerWidth,
        bodyWidth: document.documentElement.scrollWidth,
        headline: getComputedStyle(document.querySelector('main h1')!).fontSize,
        grids: Array.from(document.querySelectorAll('.home__grid')).map((el) => ({
          width: el.clientWidth,
          content: el.scrollWidth,
          overflow: getComputedStyle(el).overflowX,
        })),
      })),
    );
  }
  await page.screenshot({ path: info.outputPath('baseline-home.png'), fullPage: true });
  await page.getByRole('searchbox', { name: 'Search products', exact: true }).fill('headphones');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page).toHaveURL(/q=headphones/);
  await page
    .getByRole('heading', { name: 'Fold travel headphones', exact: true })
    .getByRole('link')
    .click();
  await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
  await page.getByRole('link', { name: 'View cart and totals' }).click();
  await expect(page.locator('.item')).toHaveCount(1);
  const guestCartWorks = true;
  const login = await request.post('/api/v1/auth/login', {
    data: { email: 'admin@halden.test', password: 'Admin#12345' },
  });
  expect(login.ok()).toBe(true);
  const token = ((await login.json()) as { data: { accessToken: string } }).data.accessToken;
  const headers = { Authorization: `Bearer ${token}` };
  const categories = (
    (await (await request.get('/api/v1/categories')).json()) as { data: { id: string }[] }
  ).data;
  const longName = 'BaselineStock ' + 'X'.repeat(120);
  const created = await request.post('/api/v1/admin/products', {
    headers,
    data: {
      name: longName,
      description: 'A test product with inactive inventory.',
      category: categories[0]!.id,
      images: [
        { url: '/assets/products/fold-headphones-1.svg', alt: 'Audit product', isPrimary: true },
      ],
      optionDefinitions: [{ name: 'Color', values: ['Graphite', 'Sand'] }],
      variants: [
        {
          sku: 'AUDIT-ACTIVE',
          options: { Color: 'Graphite' },
          price: 10000,
          stock: 0,
          isActive: true,
        },
        {
          sku: 'AUDIT-INACTIVE',
          options: { Color: 'Sand' },
          price: 11000,
          stock: 5,
          isActive: false,
        },
      ],
      status: 'active',
      isFeatured: true,
    },
  });
  expect(created.status()).toBe(201);
  const inStock = (
    (await (await request.get('/api/v1/products?q=BaselineStock&inStock=true')).json()) as {
      data: unknown[];
    }
  ).data;
  await page.goto('/shop?q=BaselineStock');
  await expect(page.locator('main app-product-card')).toHaveCount(1);
  await page.setViewportSize({ width: 360, height: 960 });
  const longTitleLayout = await page.evaluate(() => ({
    page: document.documentElement.scrollWidth,
    viewport: innerWidth,
    titleWidth: document.querySelector('app-product-card h3')!.clientWidth,
    titleContent: document.querySelector('app-product-card h3')!.scrollWidth,
  }));
  await page.screenshot({ path: info.outputPath('baseline-long-title.png'), fullPage: true });
  const settings = (
    (await (await request.get('/api/v1/admin/settings', { headers })).json()) as {
      data: Record<string, unknown>;
    }
  ).data;
  expect(
    (
      await request.put('/api/v1/admin/settings', {
        headers,
        data: { ...settings, currency: { code: 'JPY', symbol: '¥', decimals: 0 } },
      })
    ).ok(),
  ).toBe(true);
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto('/shop');
  await expect(page.locator('main app-product-card').first()).toBeVisible();
  await page.getByLabel('Min', { exact: true }).fill('500');
  await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await expect(page).toHaveURL(/minPrice=/);
  const currencyFilter = {
    decimals: 0,
    entered: 500,
    expectedMinor: 500,
    actualMinor: Number(new URL(page.url()).searchParams.get('minPrice')),
  };
  await page.getByLabel('Min', { exact: true }).fill('');
  await page.getByLabel('Max', { exact: true }).fill('0');
  await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.has('minPrice')).toBe(false);
  const zeroMaximum = {
    entered: 0,
    expectedQuery: '0',
    actualQuery: new URL(page.url()).searchParams.get('maxPrice'),
  };
  await page.route('**/api/v1/products?*', (route) => {
    const params = new URL(route.request().url()).searchParams;
    return params.get('featured') === 'true' || params.get('collection') === 'premium'
      ? route.abort()
      : route.continue();
  });
  await page.goto('/');
  await expect.poll(async () => await page.locator('[role="alert"]').count()).toBeGreaterThan(0);
  const partialFailure = {
    globalError: await page.getByRole('heading', { name: 'We could not load the store' }).count(),
    visibleCards: await page.locator('main app-product-card').count(),
  };
  await page.screenshot({ path: info.outputPath('baseline-partial-failure.png'), fullPage: true });
  await page.route('**/api/v1/settings/public', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 150));
    await route.continue();
  });
  await page.goto('/shop?minPrice=500');
  await expect(page.getByLabel('Min', { exact: true })).toHaveValue('500');
  const initialCurrencyFilter = {
    queryMinor: 500,
    displayValue: await page.getByLabel('Min', { exact: true }).inputValue(),
  };
  await page.unroute('**/api/v1/settings/public');
  expect(
    (
      await request.put('/api/v1/admin/settings', {
        headers,
        data: { ...settings, currency: { code: 'KWD', symbol: 'KD', decimals: 3 } },
      })
    ).ok(),
  ).toBe(true);
  await page.goto('/shop');
  await page.getByLabel('Min', { exact: true }).fill('1.234');
  await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await expect(page).toHaveURL(/minPrice=1234/);
  const threeDecimalFilter = {
    entered: '1.234',
    decimals: 3,
    actualMinor: Number(new URL(page.url()).searchParams.get('minPrice')),
  };
  const result = {
    method:
      'AI-led simulated personas; isolated real Angular/Express/MongoDB, not human participant research',
    homeReadyMs,
    headings,
    homeRequests,
    homeCategories,
    layouts,
    guestCartWorks,
    inactiveStockExcluded: inStock.length === 0,
    longTitleLayout,
    currencyFilter,
    initialCurrencyFilter,
    threeDecimalFilter,
    zeroMaximum,
    partialFailure,
  };
  const file = info.outputPath('baseline-audit.json');
  await writeFile(file, JSON.stringify(result, null, 2));
  await info.attach('baseline-audit', { path: file, contentType: 'application/json' });
});
