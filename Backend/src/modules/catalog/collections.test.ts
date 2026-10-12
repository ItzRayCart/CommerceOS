import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { createApp } from '@api/app.js';
import { createLogger } from '@api/config/logger.js';
import type { Env } from '@api/config/env.js';
import { ensureCatalogSeed } from '@api/seed/catalog-seed.js';
import { ProductModel } from './product.model.js';
import { CategoryModel } from './category.model.js';
const config: Env = {
  NODE_ENV: 'test',
  PORT: 4000,
  MONGODB_URI: 'mongodb://localhost/test',
  JWT_ACCESS_SECRET: 'collections-test-only-secret-over-thirty-two-characters',
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
let app: ReturnType<typeof createApp>;
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri());
  await ensureCatalogSeed();
  await ProductModel.deleteMany({});
  const category = await CategoryModel.findOne({ isActive: true }).orFail();
  for (const [slug, sales, featured, stock, age] of [
    ['new-hit', 9, true, 2, 1],
    ['old-hit', 30, true, 3, 40],
    ['no-sales', 0, false, 5, 1],
    ['inactive-stock', 20, true, 0, 1],
  ] as const) {
    const product = await ProductModel.create({
      name: slug,
      slug,
      description: 'Collection test product',
      brand: 'Demo',
      category: category._id,
      status: 'active',
      isFeatured: featured,
      soldCount: sales,
      images: [{ url: '/assets/products/fold-headphones-1.svg', alt: slug, isPrimary: true }],
      optionDefinitions: [{ name: 'Color', values: ['Graphite', 'Sand'] }],
      variants: [
        {
          sku: slug + '-active',
          options: { Color: 'Graphite' },
          price: 1000,
          stock,
          isActive: true,
        },
        {
          sku: slug + '-inactive',
          options: { Color: 'Sand' },
          price: 1100,
          stock: 5,
          isActive: false,
        },
      ],
    });
    await ProductModel.updateOne(
      { _id: product._id },
      { $set: { createdAt: new Date(Date.now() - age * 86400000) } },
      { timestamps: false, overwriteImmutable: true },
    );
  }
  app = createApp(config, createLogger('silent'));
}, 120000);
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
}, 30000);
const rows = (r: { body: unknown }) =>
  r.body as {
    data: { slug: string; inStock: boolean }[];
    meta: { total: number; hasNext: boolean };
  };
it('premium is merchant-selected and hot requires recent recorded orders and active stock', async () => {
  const premium = rows(await request(app).get('/api/v1/products?collection=premium&limit=100'));
  expect(premium.data.map((p) => p.slug).sort()).toEqual(['inactive-stock', 'new-hit', 'old-hit']);
  const hot = rows(await request(app).get('/api/v1/products?collection=hot'));
  expect(hot.data.map((p) => p.slug)).toEqual(['new-hit']);
  expect(hot.data.every((p) => p.inStock)).toBe(true);
});
it('best selling uses positive recorded units, stable descending ranking and pagination', async () => {
  const first = rows(await request(app).get('/api/v1/products?collection=best-selling&limit=2'));
  expect(first.data.map((p) => p.slug)).toEqual(['old-hit', 'inactive-stock']);
  expect(first.meta).toMatchObject({ total: 3, hasNext: true });
  const second = rows(
    await request(app).get('/api/v1/products?collection=best-selling&limit=2&page=2'),
  );
  expect(second.data.map((p) => p.slug)).toEqual(['new-hit']);
  expect(second.meta.hasNext).toBe(false);
});
it('unknown collections fail strict validation and conflicting featured constraints return no results', async () => {
  await request(app).get('/api/v1/products?collection=fabricated').expect(422);
  const conflict = rows(
    await request(app).get('/api/v1/products?collection=premium&featured=false'),
  );
  expect(conflict.data).toHaveLength(0);
});
