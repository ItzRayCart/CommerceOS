import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '@api/app.js';
import { createLogger } from '@api/config/logger.js';
import type { Env } from '@api/config/env.js';
import { ProductModel } from '@api/modules/catalog/product.model.js';
import { DiscountModel, RedemptionModel } from '@api/modules/cart/discount.model.js';
import { CartModel } from '@api/modules/cart/cart.model.js';
import { ensureCatalogSeed } from '@api/seed/catalog-seed.js';
import { UserModel } from '@api/modules/users/users.model.js';

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
let token: string;
let item: { productId: string; variantId: string; quantity: number };
const body = <T>(value: { body: unknown }) => value.body as T;

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri());
  await ensureCatalogSeed();
  app = createApp(config, createLogger('silent'));
  const product = await ProductModel.findOne({ slug: 'arc-headphones' }).orFail();
  item = {
    productId: product.id as string,
    variantId: product.variants[0]!._id.toString(),
    quantity: 2,
  };
  const registered = await request(app).post('/api/v1/auth/register').send({
    email: 'cart@example.com',
    password: 'ExamplePassword9',
    firstName: 'Cart',
    lastName: 'Tester',
  });
  token = body<{ data: { accessToken: string } }>(registered).data.accessToken;
}, 120_000);
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
}, 30_000);
beforeEach(async () => {
  await CartModel.deleteMany({});
  await DiscountModel.deleteMany({});
  await RedemptionModel.deleteMany({});
});

describe('cart batch C', () => {
  it('quotes guests from MongoDB, rejects tampered prices and invalid quantities', async () => {
    const quote = await request(app)
      .post('/api/v1/cart/price')
      .send({ items: [{ ...item, price: 1 }] });
    expect(quote.status).toBe(422);
    const priced = await request(app)
      .post('/api/v1/cart/price')
      .send({ items: [item] });
    expect(priced.status).toBe(200);
    expect(
      body<{ data: { totals: { subtotal: number; tax: number; total: number } } }>(priced).data
        .totals,
    ).toMatchObject({ subtotal: 49800, tax: 3984, total: 53784 });
    expect(
      (
        await request(app)
          .post('/api/v1/cart/price')
          .send({ items: [{ ...item, quantity: 11 }] })
      ).status,
    ).toBe(422);
    expect(
      (
        await request(app)
          .post('/api/v1/cart/price')
          .send({ items: [{ ...item, quantity: 1.5 }] })
      ).status,
    ).toBe(422);
  });
  it('merges guest quantities into the server cart, capped at ten and current stock', async () => {
    expect((await request(app).get('/api/v1/cart')).status).toBe(401);
    const first = await request(app)
      .post('/api/v1/cart/items')
      .auth(token, { type: 'bearer' })
      .send(item);
    expect(first.status).toBe(201);
    const merged = await request(app)
      .post('/api/v1/cart/merge')
      .auth(token, { type: 'bearer' })
      .send({ items: [{ ...item, quantity: 9 }] });
    expect(merged.status).toBe(200);
    const line = body<{ data: { lines: { id: string; quantity: number }[] } }>(merged).data
      .lines[0]!;
    expect(line.quantity).toBe(3);
    expect(
      (
        await request(app)
          .patch(`/api/v1/cart/items/${line.id}`)
          .auth(token, { type: 'bearer' })
          .send({ quantity: 11 })
      ).status,
    ).toBe(422);
    expect(
      (
        await request(app)
          .patch(`/api/v1/cart/items/${line.id}`)
          .auth(token, { type: 'bearer' })
          .send({ quantity: 1 })
      ).status,
    ).toBe(200);
    expect(
      (await request(app).delete(`/api/v1/cart/items/${line.id}`).auth(token, { type: 'bearer' }))
        .status,
    ).toBe(204);
    expect(
      body<{ data: { lines: unknown[] } }>(
        await request(app).get('/api/v1/cart').auth(token, { type: 'bearer' }),
      ).data.lines,
    ).toHaveLength(0);
  });
  it('returns the first precise discount failure and caps eligible discounts', async () => {
    await request(app).post('/api/v1/cart/items').auth(token, { type: 'bearer' }).send(item);
    const user = await UserModel.findOne({ email: 'cart@example.com' }).orFail();
    await RedemptionModel.create({
      code: 'LIMITED',
      user: user._id,
      order: new mongoose.Types.ObjectId(),
      amount: 100,
    });
    const cases = [
      { code: 'OFFLINE', reason: 'inactive', extra: { isActive: false } },
      {
        code: 'SOON',
        reason: 'not_started',
        extra: { startsAt: new Date(Date.now() + 86_400_000) },
      },
      { code: 'OLD', reason: 'expired', extra: { expiresAt: new Date(Date.now() - 86_400_000) } },
      { code: 'LARGE', reason: 'min_subtotal', extra: { minSubtotal: 50_000 } },
      { code: 'EXHAUSTED', reason: 'usage_limit', extra: { usageLimit: 0 } },
      { code: 'LIMITED', reason: 'per_user_limit', extra: {} },
      {
        code: 'OTHER',
        reason: 'not_applicable',
        extra: { appliesTo: { categories: [], products: [new mongoose.Types.ObjectId()] } },
      },
    ];
    for (const testCase of cases) {
      await DiscountModel.create({
        code: testCase.code,
        type: 'percentage',
        value: 10,
        minSubtotal: 0,
        usedCount: 0,
        perUserLimit: 1,
        appliesTo: { categories: [], products: [] },
        isActive: true,
        ...testCase.extra,
      });
      const response = await request(app)
        .post('/api/v1/cart/discount')
        .auth(token, { type: 'bearer' })
        .send({ code: testCase.code });
      expect(response.status).toBe(422);
      expect(
        body<{ error: { code: string; details: { reason: string } } }>(response).error,
      ).toMatchObject({ code: 'DISCOUNT_INVALID', details: { reason: testCase.reason } });
    }
    await DiscountModel.create({
      code: 'CAPPED',
      type: 'percentage',
      value: 50,
      maxDiscount: 1000,
      minSubtotal: 0,
      usedCount: 0,
      perUserLimit: 1,
      appliesTo: { categories: [], products: [] },
      isActive: true,
    });
    const capped = await request(app)
      .post('/api/v1/cart/discount')
      .auth(token, { type: 'bearer' })
      .send({ code: 'CAPPED' });
    expect(body<{ data: { totals: { discount: number } } }>(capped).data.totals.discount).toBe(
      1000,
    );
  });
  it('reprices changed stock and price on every read, and calculates a discount from eligible lines', async () => {
    await request(app).post('/api/v1/cart/items').auth(token, { type: 'bearer' }).send(item);
    await DiscountModel.create({
      code: 'WELCOME10',
      type: 'percentage',
      value: 10,
      minSubtotal: 5000,
      usedCount: 0,
      perUserLimit: 1,
      appliesTo: { categories: [], products: [] },
      isActive: true,
    });
    const discounted = await request(app)
      .post('/api/v1/cart/discount')
      .auth(token, { type: 'bearer' })
      .send({ code: 'welcome10' });
    expect(discounted.status).toBe(200);
    expect(
      body<{ data: { totals: { discount: number; tax: number; total: number } } }>(discounted).data
        .totals,
    ).toMatchObject({ discount: 4980, tax: 3586, total: 48406 });
    expect(
      body<{ error: { details: { reason: string } } }>(
        await request(app)
          .post('/api/v1/cart/discount')
          .auth(token, { type: 'bearer' })
          .send({ code: 'INVALID' }),
      ).error.details.reason,
    ).toBe('not_found');
    await ProductModel.updateOne(
      { _id: item.productId, 'variants._id': item.variantId },
      { $set: { 'variants.$.stock': 1, 'variants.$.price': 20000 } },
    );
    const changed = body<{
      data: {
        lines: {
          unitPrice: number;
          unavailable: boolean;
          available: number;
          priceChanged: boolean;
        }[];
        totals: { subtotal: number };
      };
    }>(await request(app).get('/api/v1/cart').auth(token, { type: 'bearer' })).data;
    expect(changed.lines[0]).toMatchObject({
      unitPrice: 20000,
      unavailable: true,
      available: 1,
      priceChanged: true,
    });
    expect(changed.totals.subtotal).toBe(40000);
  });
});
