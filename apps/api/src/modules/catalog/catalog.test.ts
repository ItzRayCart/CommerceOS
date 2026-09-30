import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import type { Express } from 'express';
import type { Env } from '@api/config/env.js';
import { createLogger } from '@api/config/logger.js';
import { createApp } from '@api/app.js';
import { CategoryModel } from '@api/modules/catalog/category.model.js';
import { ProductModel } from '@api/modules/catalog/product.model.js';
import { ensureCatalogSeed } from '@api/seed/catalog-seed.js';

const config: Env = {
  NODE_ENV: 'test',
  PORT: 4000,
  MONGODB_URI: 'mongodb://localhost:27017/test',
  JWT_ACCESS_SECRET: 'test-secret-with-at-least-thirty-two-characters',
  JWT_ACCESS_TTL: '15m',
  REFRESH_TOKEN_TTL_DAYS: 7,
  COOKIE_SECURE: false,
  CORS_ORIGINS: 'http://localhost:4200',
  WEB_BASE_URL: 'http://localhost:4200',
  MAIL_TRANSPORT: 'console',
  UPLOAD_DIR: './uploads',
  LOG_LEVEL: 'fatal',
};
let mongo: MongoMemoryReplSet;
let app: Express;

function bodyOf<T>(response: { body: unknown }): T {
  return response.body as T;
}

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri());
  await ensureCatalogSeed();
  app = createApp(config, createLogger('silent'));
}, 120_000);
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
}, 30_000);

describe('catalogue batch A', () => {
  it('saves products idempotently to an authenticated private wishlist', async () => {
    const registered = await request(app).post('/api/v1/auth/register').send({
      email: 'wishlist@example.com',
      password: 'ExamplePassword9',
      firstName: 'Wish',
      lastName: 'List',
    });
    const token = bodyOf<{ data: { accessToken: string } }>(registered).data.accessToken;
    const product = await ProductModel.findOne({ slug: 'studio-headphones' }).orFail();
    const path = `/api/v1/wishlist/${product.id}`;
    expect((await request(app).post(path).send({})).status).toBe(401);
    for (let i = 0; i < 2; i++)
      expect((await request(app).post(path).auth(token, { type: 'bearer' })).status).toBe(200);
    expect(
      bodyOf<{ data: unknown[] }>(
        await request(app).get('/api/v1/wishlist').auth(token, { type: 'bearer' }),
      ).data,
    ).toHaveLength(1);
    expect((await request(app).delete(path).auth(token, { type: 'bearer' })).status).toBe(204);
    expect(
      bodyOf<{ data: unknown[] }>(
        await request(app).get('/api/v1/wishlist').auth(token, { type: 'bearer' }),
      ).data,
    ).toHaveLength(0);
  });
  it('serves data-driven settings and category counts', async () => {
    const settings = await request(app).get('/api/v1/settings/public');
    expect(settings.status).toBe(200);
    expect(
      bodyOf<{ data: { store: { name: string }; theme: { accent: string } } }>(settings).data.store
        .name,
    ).toBe('HALDEN');
    const categories = await request(app).get('/api/v1/categories');
    expect(categories.status).toBe(200);
    const items = bodyOf<{ data: { slug: string; productCount: number }[] }>(categories).data;
    expect(items).toHaveLength(5);
    expect(items[0]).toMatchObject({ slug: 'personal-audio', productCount: 6 });
  });

  it('paginates, filters, sorts and searches real MongoDB products', async () => {
    const page = await request(app).get('/api/v1/products?limit=12&page=2&includeFacets=true');
    const pageBody = bodyOf<{
      data: unknown[];
      meta: {
        page: number;
        total: number;
        hasPrev: boolean;
        facets: { options: Record<string, unknown> };
      };
    }>(page);
    expect(page.status).toBe(200);
    expect(pageBody.data).toHaveLength(12);
    expect(pageBody.meta).toMatchObject({ page: 2, total: 30, hasPrev: true });
    expect(pageBody.meta.facets.options['Color']).toBeTruthy();

    const filtered = await request(app).get(
      '/api/v1/products?category=personal-audio&inStock=true&minPrice=10000&options[Color]=Graphite',
    );
    expect(filtered.status).toBe(200);
    expect(
      bodyOf<{ data: { category: { slug: string }; priceFrom: number }[] }>(filtered).data.every(
        (item) => item.category.slug === 'personal-audio' && item.priceFrom >= 10000,
      ),
    ).toBe(true);
    const ascending = bodyOf<{ data: { priceFrom: number }[] }>(
      await request(app).get('/api/v1/products?sort=price'),
    ).data.map((item) => item.priceFrom);
    const descending = bodyOf<{ data: { priceFrom: number }[] }>(
      await request(app).get('/api/v1/products?sort=-price'),
    ).data.map((item) => item.priceFrom);
    expect(ascending).toEqual([...ascending].sort((a, b) => a - b));
    expect(descending).toEqual([...descending].sort((a, b) => b - a));
    const search = await request(app).get('/api/v1/products?q=wireless&sort=relevance');
    expect(search.status).toBe(200);
    expect(bodyOf<{ data: { name: string }[] }>(search).data.length).toBeGreaterThan(0);
  });

  it('returns a product, related items and suggestions while hiding inactive catalogue entries', async () => {
    const detail = await request(app).get('/api/v1/products/arc-headphones');
    expect(detail.status).toBe(200);
    expect(
      bodyOf<{ data: { variants: unknown[]; images: unknown[] } }>(detail).data.variants,
    ).toHaveLength(3);
    expect(bodyOf<{ data: { images: unknown[] } }>(detail).data.images).toHaveLength(2);
    const related = await request(app).get('/api/v1/products/arc-headphones/related');
    expect(bodyOf<{ data: unknown[] }>(related).data.length).toBeGreaterThan(0);
    expect(
      bodyOf<{ data: unknown[] }>(await request(app).get('/api/v1/products/suggest?q=wireless'))
        .data.length,
    ).toBeGreaterThan(0);
    expect((await request(app).get('/api/v1/products?sort=relevance')).status).toBe(422);
    expect((await request(app).get('/api/v1/products?unknown=1')).status).toBe(422);
    await ProductModel.updateOne({ slug: 'arc-headphones' }, { $set: { status: 'draft' } });
    expect((await request(app).get('/api/v1/products/arc-headphones')).status).toBe(404);
    await CategoryModel.updateOne({ slug: 'speakers' }, { $set: { isActive: false } });
    const page = await request(app).get('/api/v1/products?limit=100');
    expect(bodyOf<{ meta: { total: number } }>(page).meta.total).toBe(23);
  });
});
