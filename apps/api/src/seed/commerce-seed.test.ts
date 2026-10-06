import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { ensureCatalogSeed } from './catalog-seed.js';
import { ensureCommerceSeed } from './commerce-seed.js';
import { CategoryModel } from '@api/modules/catalog/category.model.js';
import { UserModel } from '@api/modules/users/users.model.js';
import { ProductModel } from '@api/modules/catalog/product.model.js';
import { OrderModel, StockMovementModel } from '@api/modules/orders/orders.model.js';
import { createLogger } from '@api/config/logger.js';
import type { Env } from '@api/config/env.js';
const config: Env = {
  NODE_ENV: 'test',
  PORT: 4000,
  MONGODB_URI: 'mongodb://localhost/test',
  JWT_ACCESS_SECRET: 'seed-only-secret-with-at-least-thirty-two-characters',
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
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri());
}, 120000);
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
}, 30000);
it('seeds 120 dated orders idempotently with coherent totals, stock movements and customer statistics', async () => {
  await ensureCatalogSeed();
  await ensureCommerceSeed(config, createLogger('silent'));
  expect(await UserModel.countDocuments({ role: 'customer' })).toBe(40);
  expect(await OrderModel.countDocuments()).toBe(120);
  expect(await CategoryModel.countDocuments({ parent: { $exists: true } })).toBe(10);
  expect(await ProductModel.countDocuments({ status: 'draft' })).toBe(2);
  expect(await ProductModel.countDocuments({ status: 'archived' })).toBe(1);
  const orders = await OrderModel.find().sort({ createdAt: 1 }).lean();
  expect(Date.now() - orders[0]!.createdAt.getTime()).toBeGreaterThan(60 * 86400000);
  for (const o of orders) {
    expect(o.createdAt.getTime()).toBeLessThanOrEqual(Date.now());
    expect(o.totals.total).toBe(
      o.totals.subtotal - o.totals.discount + o.totals.tax + o.totals.shipping,
    );
    expect(o.statusHistory.at(-1)?.status).toBe(o.status);
  }
  const products = await ProductModel.find().lean();
  for (const p of products)
    for (const v of p.variants) {
      const moves = await StockMovementModel.find({ variantId: v._id }).lean();
      expect(moves.reduce((s, m) => s + m.delta, 0)).toBe(v.stock);
      expect(v.stock).toBeGreaterThanOrEqual(0);
    }
  const count = await StockMovementModel.countDocuments();
  await ensureCommerceSeed(config, createLogger('silent'));
  expect(await OrderModel.countDocuments()).toBe(120);
  expect(await StockMovementModel.countDocuments()).toBe(count);
  const customer = await UserModel.findOne({ email: 'customer@halden.test' }).lean();
  const owned = orders.filter((o) => o.user.equals(customer!._id) && o.status !== 'cancelled');
  expect(customer!.stats.totalSpent).toBe(owned.reduce((s, o) => s + o.totals.total, 0));
}, 180000);
