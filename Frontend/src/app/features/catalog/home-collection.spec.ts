import { describe, it, expect } from 'vitest';
import { of, throwError } from 'rxjs';
import type { CatalogApi } from './catalog.api';
import { HomeCollection } from './home-collection';
import type { ProductSummary, CatalogMeta } from './catalog.types';
const product = (id: string): ProductSummary => ({
  id,
  slug: id,
  name: id,
  primaryImage: null,
  priceFrom: 100,
  compareAtFrom: null,
  inStock: true,
  ratingAverage: 0,
  ratingCount: 0,
  category: { id: 'c', name: 'Category', slug: 'category' },
});
const meta = (page: number, hasNext: boolean): CatalogMeta => ({
  page,
  limit: 8,
  total: 3,
  totalPages: 2,
  hasNext,
  hasPrev: page > 1,
});
describe('collection pagination and error recovery', () => {
  it('preserves loaded data on a failed next page and retries that page without duplicates', async () => {
    const pages: number[] = [];
    let fail = true;
    const api = {
      products: (query: Record<string, unknown>) => {
        const page = Number(query['page']);
        pages.push(page);
        if (page === 1) return of({ data: [product('a'), product('b')], meta: meta(1, true) });
        if (fail) return throwError(() => new Error('Unavailable'));
        return of({ data: [product('b'), product('c')], meta: meta(2, false) });
      },
    } as unknown as CatalogApi;
    const row = new HomeCollection(api, 'premium', 'Premium', '', { collection: 'premium' });
    await row.load();
    await row.load(false);
    expect(row.products().map((p) => p.id)).toEqual(['a', 'b']);
    expect(row.error()).toBeTruthy();
    fail = false;
    await row.retry();
    expect(pages).toEqual([1, 2, 2]);
    expect(row.products().map((p) => p.id)).toEqual(['a', 'b', 'c']);
    expect(row.meta()?.hasNext).toBe(false);
    expect(row.error()).toBe('');
    await row.load(false);
    expect(pages).toHaveLength(3);
  });
  it('a failed collection does not prevent another collection from loading', async () => {
    const bad = { products: () => throwError(() => new Error('Failed')) } as unknown as CatalogApi;
    const good = {
      products: () => of({ data: [product('a')], meta: meta(1, false) }),
    } as unknown as CatalogApi;
    const rows = [
      new HomeCollection(bad, 'hot', 'Hot', '', {}),
      new HomeCollection(good, 'premium', 'Premium', '', {}),
    ];
    await Promise.all(rows.map((r) => r.load()));
    expect(rows[0].error()).toBeTruthy();
    expect(rows[1].products()).toHaveLength(1);
  });
});
