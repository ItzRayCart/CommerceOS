import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import type { Express } from 'express';
import type { ApiEnvelope, ApiErrorEnvelope, CheckoutQuote, OrderView } from '@commerceos/shared';
import { createApp } from '@api/app.js';
import type { Env } from '@api/config/env.js';
import { createLogger } from '@api/config/logger.js';
import { MockPaymentProvider } from '@api/common/providers/payment.provider.js';
import { ProductModel } from '@api/modules/catalog/product.model.js';
import { CategoryModel } from '@api/modules/catalog/category.model.js';
import { SettingsModel } from '@api/modules/settings/settings.model.js';
import { CartModel } from '@api/modules/cart/cart.model.js';
import { DiscountModel, RedemptionModel } from '@api/modules/cart/discount.model.js';
import { UserModel } from '@api/modules/users/users.model.js';
import { ensureCatalogSeed } from '@api/seed/catalog-seed.js';
import { CounterModel, OrderModel, StockMovementModel } from './orders.model.js';
import { assertTransition } from './order-transitions.service.js';
import type { OrderDependencies } from './orders.service.js';

const config: Env = {
  NODE_ENV: 'test',
  PORT: 4000,
  MONGODB_URI: 'mongodb://localhost/test',
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
const address = {
  fullName: 'Test Customer',
  line1: '10 Market Street',
  city: 'Lahore',
  region: 'Punjab',
  postalCode: '54000',
  country: 'PK',
  phone: '+923001234567',
};
const input = {
  address,
  shippingMethodCode: 'standard',
  payment: { method: 'card_mock', token: 'mock_approved', last4: '0000' },
};
const body = <T>(response: { body: unknown }): T => response.body as T;
let mongo: MongoMemoryReplSet;
let app: Express;
let deps: OrderDependencies;
let users: { id: string; token: string }[];
let productId: string;
let variantId: string;
const email = jest.fn<Promise<void>, [string, string, string]>();
function post(user = 0, key = 'order-key-0001', payload: object = input) {
  return request(app)
    .post('/api/v1/orders')
    .auth(users[user]!.token, { type: 'bearer' })
    .set('Idempotency-Key', key)
    .send(payload);
}
async function cart(user = 0, quantity = 1, discountCode?: string) {
  await CartModel.findOneAndUpdate(
    { user: users[user]!.id },
    { $set: { items: [{ product: productId, variantId, quantity }], discountCode } },
    { upsert: true },
  );
}
async function code(extra: object = {}) {
  return DiscountModel.create({
    code: 'PROMO10',
    type: 'percentage',
    value: 10,
    minSubtotal: 0,
    usedCount: 0,
    perUserLimit: 1,
    isActive: true,
    appliesTo: { categories: [], products: [] },
    ...extra,
  });
}
async function stock() {
  return (await ProductModel.findById(productId).lean())!.variants.find(
    (v) => v._id.toString() === variantId,
  )!.stock;
}
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri());
  await Promise.all([
    OrderModel.init(),
    CounterModel.init(),
    StockMovementModel.init(),
    CartModel.init(),
    UserModel.init(),
    DiscountModel.init(),
  ]);
}, 120_000);
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
}, 30_000);
beforeEach(async () => {
  jest.restoreAllMocks();
  email.mockReset();
  email.mockResolvedValue(undefined);
  await OrderModel.deleteMany({});
  await CartModel.deleteMany({});
  await StockMovementModel.deleteMany({});
  await CounterModel.deleteMany({});
  await RedemptionModel.deleteMany({});
  await DiscountModel.deleteMany({});
  await ProductModel.deleteMany({});
  await CategoryModel.deleteMany({});
  await SettingsModel.deleteMany({});
  await UserModel.deleteMany({});
  await ensureCatalogSeed();
  await DiscountModel.deleteMany({});
  const product = await ProductModel.findOne({ slug: 'arc-headphones' }).orFail();
  productId = product._id.toString();
  variantId = product.variants[0]!._id.toString();
  product.variants[0]!.stock = 20;
  product.variants[0]!.price = 20000;
  product.soldCount = 0;
  await product.save();
  users = [];
  for (let i = 0; i < 3; i++) {
    const user = await UserModel.create({
      email: `order${i}@example.com`,
      passwordHash: 'test-only-not-used-for-login',
      firstName: 'Test',
      lastName: 'Customer',
      role: i === 2 ? 'admin' : 'customer',
    });
    users.push({
      id: user._id.toString(),
      token: jwt.sign({ sub: user._id.toString(), role: user.role }, config.JWT_ACCESS_SECRET, {
        expiresIn: '15m',
      }),
    });
  }
  deps = {
    payment: new MockPaymentProvider(),
    mail: {
      sendPasswordReset: () => Promise.resolve(),
      sendOrderConfirmation: email,
      sendOrderShipped: () => Promise.resolve(),
    },
    logger: createLogger('silent'),
    webBaseUrl: config.WEB_BASE_URL,
  };
  app = createApp(config, deps.logger, deps);
  await cart();
});

describe('checkout authority and snapshots (BR-01/02/05/06/08/09; AC-CHK-01/05/08)', () => {
  it('quotes without side effects, selects shipping, and ignores tampered authoritative values', async () => {
    await code();
    await cart(0, 1, 'PROMO10');
    const quote = await request(app)
      .post('/api/v1/checkout/quote')
      .auth(users[0]!.token, { type: 'bearer' })
      .send({ address, shippingMethodCode: 'express' });
    expect(quote.status).toBe(200);
    expect(body<ApiEnvelope<CheckoutQuote>>(quote).data.totals).toEqual({
      subtotal: 20000,
      discount: 2000,
      shipping: 1800,
      tax: 1440,
      total: 21240,
    });
    expect(await stock()).toBe(20);
    expect(await StockMovementModel.countDocuments()).toBe(0);
    expect(await OrderModel.countDocuments()).toBe(0);
    const response = await post(0, 'tampered-key', {
      ...input,
      shippingMethodCode: 'express',
      prices: [1],
      totals: { total: 1 },
      total: -999,
    });
    expect(response.status).toBe(201);
    const order = body<ApiEnvelope<OrderView>>(response).data;
    expect(order.status).toBe('paid');
    expect(order.totals).toEqual(body<ApiEnvelope<CheckoutQuote>>(quote).data.totals);
    expect(order.payment.last4).toBe('4242');
    expect(await stock()).toBe(19);
    expect(await CartModel.countDocuments()).toBe(0);
    expect(await StockMovementModel.findOne().lean()).toMatchObject({
      delta: -1,
      stockAfter: 19,
      reason: 'order_placed',
    });
    expect(email).toHaveBeenCalledTimes(1);
    expect((await UserModel.findById(users[0]!.id).lean())!.stats).toMatchObject({
      orderCount: 1,
      totalSpent: 21240,
    });
    await ProductModel.updateOne(
      { _id: productId, 'variants._id': variantId },
      { $set: { name: 'Edited', 'variants.$.price': 1 } },
    );
    const stored = body<ApiEnvelope<OrderView>>(
      await request(app)
        .get(`/api/v1/orders/${order.orderNumber}`)
        .auth(users[0]!.token, { type: 'bearer' }),
    ).data;
    expect(stored.items[0]).toMatchObject({ name: 'Arc wireless headphones', unitPrice: 20000 });
    expect(stored.totals.total).toBe(21240);
    expect(JSON.stringify(stored)).not.toMatch(
      /passwordHash|tokenHash|__v|internalNotes|idempotencyKey|mock_approved/,
    );
  });
  it('rounds tax half-up once and computes free shipping from the post-discount subtotal', async () => {
    await ProductModel.updateOne(
      { _id: productId, 'variants._id': variantId },
      { $set: { 'variants.$.price': 101 } },
    );
    await SettingsModel.updateOne({ key: 'store' }, { $set: { 'tax.ratePercent': 50 } });
    expect(body<ApiEnvelope<OrderView>>(await post()).data.totals).toEqual({
      subtotal: 101,
      discount: 0,
      shipping: 600,
      tax: 51,
      total: 752,
    });
    await cart();
    await ProductModel.updateOne(
      { _id: productId, 'variants._id': variantId },
      { $set: { 'variants.$.price': 16000 } },
    );
    await code();
    await cart(0, 1, 'PROMO10');
    expect(
      body<ApiEnvelope<OrderView>>(await post(0, 'free-shipping-key')).data.totals.shipping,
    ).toBe(600);
  });
  it('rejects stale review fingerprints, hidden products, bad shipping, invalid quantities, unknown fields and raw card data', async () => {
    const quote = body<ApiEnvelope<CheckoutQuote>>(
      await request(app)
        .post('/api/v1/checkout/quote')
        .auth(users[0]!.token, { type: 'bearer' })
        .send({ address, shippingMethodCode: 'standard' }),
    ).data;
    await ProductModel.updateOne(
      { _id: productId, 'variants._id': variantId },
      { $set: { 'variants.$.price': 21000 } },
    );
    expect(
      body<ApiErrorEnvelope>(
        await post(0, 'stale-quote-key', { ...input, quoteFingerprint: quote.fingerprint }),
      ).error.code,
    ).toBe('QUOTE_CHANGED');
    expect(
      (await post(0, 'bad-method-key', { ...input, shippingMethodCode: 'unknown' })).status,
    ).toBe(422);
    expect(
      (
        await post(0, 'raw-card-key', {
          ...input,
          payment: {
            method: 'card_mock',
            token: 'mock_approved',
            cardNumber: '4242424242424242',
            cvc: '123',
          },
        })
      ).status,
    ).toBe(422);
    expect((await post(0, 'unknown-field-key', { ...input, user: users[1]!.id })).status).toBe(422);
    await cart(0, 11);
    expect((await post()).status).toBe(409);
    await cart();
    await CategoryModel.updateMany({}, { $set: { isActive: false } });
    expect((await post()).status).toBe(409);
    expect(await stock()).toBe(20);
    expect(await OrderModel.countDocuments()).toBe(0);
  });
  it('enforces authentication, address ownership, valid address and a required submission key', async () => {
    expect((await request(app).post('/api/v1/orders').send(input)).status).toBe(401);
    expect((await request(app).post('/api/v1/checkout/quote').send(input)).status).toBe(401);
    expect(
      (
        await post(0, 'address-owner-key', {
          ...input,
          address: undefined,
          addressId: new mongoose.Types.ObjectId().toString(),
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await post(0, 'address-invalid-key', {
          ...input,
          address: { ...address, country: 'bad', phone: 'bad' },
        })
      ).status,
    ).toBe(422);
    expect(
      (
        await request(app)
          .post('/api/v1/orders')
          .auth(users[0]!.token, { type: 'bearer' })
          .send(input)
      ).status,
    ).toBe(422);
  });
  it('validates saved addresses and keeps their order snapshots after address-book edits', async () => {
    const savedId = new mongoose.Types.ObjectId();
    await UserModel.updateOne(
      { _id: users[0]!.id },
      { $set: { addresses: [{ _id: savedId, ...address, label: 'Home', isDefault: true }] } },
    );
    const result = await post(0, 'saved-address-key', {
      ...input,
      address: undefined,
      addressId: savedId.toString(),
    });
    expect(result.status).toBe(201);
    const order = body<ApiEnvelope<OrderView>>(result).data;
    await UserModel.updateOne(
      { _id: users[0]!.id },
      { $set: { 'addresses.0.line1': 'Changed address' } },
    );
    const detail = body<ApiEnvelope<OrderView>>(
      await request(app)
        .get(`/api/v1/orders/${order.orderNumber}`)
        .auth(users[0]!.token, { type: 'bearer' }),
    ).data;
    expect(detail.shippingAddress.line1).toBe(address.line1);
    expect(detail.shippingAddress).not.toHaveProperty('isDefault');
    await cart(1);
    expect(
      (
        await post(1, 'other-address-key', {
          ...input,
          address: undefined,
          addressId: savedId.toString(),
        })
      ).status,
    ).toBe(404);
  });
});

describe('atomicity, races and idempotency (BR-03/04/14; AC-CHK-02/03/04)', () => {
  it.each(['mock_declined', 'mock_insufficient', 'invalid'])(
    'rolls back all writes for payment token %s',
    async (token) => {
      await code();
      await cart(0, 1, 'PROMO10');
      const response = await post(0, 'decline-order-key', {
        ...input,
        payment: { method: 'card_mock', token },
      });
      expect(response.status).toBe(402);
      expect(await stock()).toBe(20);
      expect(await OrderModel.countDocuments()).toBe(0);
      expect(await StockMovementModel.countDocuments()).toBe(0);
      expect(await CounterModel.countDocuments()).toBe(0);
      expect(await RedemptionModel.countDocuments()).toBe(0);
      expect((await DiscountModel.findOne().lean())!.usedCount).toBe(0);
      expect((await UserModel.findById(users[0]!.id).lean())!.stats.orderCount).toBe(0);
      expect(await CartModel.countDocuments()).toBe(1);
      expect(email).not.toHaveBeenCalled();
    },
  );
  it('rolls back an injected failure after the order, stock and redemption writes, then safely retries the same key', async () => {
    await code();
    await cart(0, 1, 'PROMO10');
    jest.spyOn(UserModel, 'updateOne').mockImplementationOnce(() => {
      throw new Error('Injected stats persistence failure');
    });
    expect((await post(0, 'rollback-retry-key')).status).toBe(500);
    expect(await OrderModel.countDocuments()).toBe(0);
    expect(await stock()).toBe(20);
    expect(await StockMovementModel.countDocuments()).toBe(0);
    expect(await RedemptionModel.countDocuments()).toBe(0);
    expect(await CartModel.countDocuments()).toBe(1);
    expect(email).not.toHaveBeenCalled();
    expect((await post(0, 'rollback-retry-key')).status).toBe(201);
    expect(await OrderModel.countDocuments()).toBe(1);
  });
  it('allows exactly one customer to buy the last unit and never makes stock negative', async () => {
    await ProductModel.updateOne(
      { _id: productId, 'variants._id': variantId },
      { $set: { 'variants.$.stock': 1 }, $inc: { totalStock: -19 } },
    );
    await cart(1);
    const responses = await Promise.all([post(0, 'race-customer-a'), post(1, 'race-customer-b')]);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(
      body<ApiErrorEnvelope>(responses.find((response) => response.status === 409)!).error,
    ).toMatchObject({
      code: 'INSUFFICIENT_STOCK',
      details: { lines: [{ variantId, requested: 1, available: 0 }] },
    });
    expect(await stock()).toBe(0);
    const product = await ProductModel.findById(productId).lean();
    expect(product!.totalStock).toBe(
      product!.variants.reduce((sum, variant) => sum + variant.stock, 0),
    );
    expect(await OrderModel.countDocuments()).toBe(1);
    expect(await StockMovementModel.countDocuments()).toBe(1);
    expect(await CartModel.countDocuments()).toBe(1);
  });
  it('deduplicates simultaneous requests, retries after cart clearing, and changed payloads under the same user key', async () => {
    const responses = await Promise.all([post(), post()]);
    expect(responses.map((r) => r.status)).toEqual([201, 201]);
    const number = body<ApiEnvelope<OrderView>>(responses[0]).data.orderNumber;
    expect(body<ApiEnvelope<OrderView>>(responses[1]).data.orderNumber).toBe(number);
    expect(
      body<ApiEnvelope<OrderView>>(
        await post(0, 'order-key-0001', { ...input, shippingMethodCode: 'express' }),
      ).data.orderNumber,
    ).toBe(number);
    expect(await stock()).toBe(19);
    expect(await OrderModel.countDocuments()).toBe(1);
    expect(email).toHaveBeenCalledTimes(1);
    await cart(1);
    expect((await post(1)).status).toBe(201);
    expect(await OrderModel.countDocuments()).toBe(2);
    expect(new Set((await OrderModel.find().lean()).map((order) => order.orderNumber)).size).toBe(
      2,
    );
  });
  it('prevents different keys from checking out the same server cart twice', async () => {
    const responses = await Promise.all([post(0, 'different-key-a'), post(0, 'different-key-b')]);
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await OrderModel.countDocuments()).toBe(1);
    expect(await stock()).toBe(19);
  });
  it('does not lose an item added concurrently with order placement or return an internal error', async () => {
    const [placed, added] = await Promise.all([
      post(),
      request(app)
        .post('/api/v1/cart/items')
        .auth(users[0]!.token, { type: 'bearer' })
        .send({ productId, variantId, quantity: 1 }),
    ]);
    expect(placed.status).toBe(201);
    expect([201, 409]).toContain(added.status);
    const order = body<ApiEnvelope<OrderView>>(placed).data;
    const remaining = await CartModel.findOne({ user: users[0]!.id }).lean();
    expect(await stock()).toBe(20 - order.items[0]!.quantity);
    if (added.status === 201)
      expect(order.items[0]!.quantity + (remaining?.items[0]?.quantity ?? 0)).toBe(2);
  });
  it('does not fail a committed order when confirmation email delivery fails', async () => {
    email.mockRejectedValue(new Error('SMTP unavailable'));
    expect((await post()).status).toBe(201);
    expect((await post()).status).toBe(201);
    expect(await OrderModel.countDocuments()).toBe(1);
    expect(email).toHaveBeenCalledTimes(1);
  });
});

describe('discount validity and concurrency (BR-07; AC-DISC-01..04)', () => {
  it.each([
    ['not_found', null],
    ['inactive', { isActive: false }],
    ['not_started', { startsAt: new Date('2099-01-01') }],
    ['expired', { expiresAt: new Date('2000-01-01') }],
    ['min_subtotal', { minSubtotal: 30000 }],
    ['usage_limit', { usageLimit: 0 }],
    ['per_user_limit', { perUserLimit: 0 }],
    [
      'not_applicable',
      { appliesTo: { categories: [], products: [new mongoose.Types.ObjectId()] } },
    ],
  ])('rejects %s with the first reason and without side effects', async (reason, extra) => {
    if (extra) await code(extra);
    await cart(0, 1, 'PROMO10');
    const response = await post();
    expect(response.status).toBe(422);
    expect(body<ApiErrorEnvelope>(response).error).toMatchObject({
      code: 'DISCOUNT_INVALID',
      details: { reason },
    });
    expect(await stock()).toBe(20);
    expect(await OrderModel.countDocuments()).toBe(0);
  });
  it('caps percentage discounts and fixed discounts at the eligible category subtotal', async () => {
    const product = await ProductModel.findById(productId).lean();
    await code({
      appliesTo: { categories: [product!.category], products: [] },
      value: 50,
      maxDiscount: 1000,
    });
    await cart(0, 1, 'PROMO10');
    expect(body<ApiEnvelope<OrderView>>(await post()).data.totals.discount).toBe(1000);
    await DiscountModel.deleteMany({});
    await code({ type: 'fixed', value: 999999, perUserLimit: 2 });
    await cart(0, 1, 'PROMO10');
    const order = body<ApiEnvelope<OrderView>>(await post(0, 'fixed-code-key')).data;
    expect(order.totals.discount).toBe(20000);
    expect(order.totals.tax).toBe(0);
    expect(order.totals.total).toBe(600);
  });
  it('discounts only eligible lines in a mixed-category cart', async () => {
    const eligible = await ProductModel.findById(productId).orFail();
    const other = await ProductModel.findOne({
      category: { $ne: eligible.category },
      status: 'active',
    }).orFail();
    other.variants[0]!.price = 10000;
    other.variants[0]!.stock = 20;
    await other.save();
    await code({ appliesTo: { categories: [eligible.category], products: [] } });
    await cart(0, 1, 'PROMO10');
    await CartModel.updateOne(
      { user: users[0]!.id },
      { $push: { items: { product: other._id, variantId: other.variants[0]!._id, quantity: 1 } } },
    );
    const response = await post();
    expect(response.status).toBe(201);
    expect(body<ApiEnvelope<OrderView>>(response).data.totals).toEqual({
      subtotal: 30000,
      discount: 2000,
      shipping: 0,
      tax: 2240,
      total: 30240,
    });
    expect(await StockMovementModel.countDocuments()).toBe(2);
  });
  it('serializes the final global discount redemption between customers', async () => {
    await code({ usageLimit: 1 });
    await cart(0, 1, 'PROMO10');
    await cart(1, 1, 'PROMO10');
    const responses = await Promise.all([post(0, 'discount-race-a'), post(1, 'discount-race-b')]);
    expect(responses.map((r) => r.status).sort()).toEqual([201, 422]);
    expect(await RedemptionModel.countDocuments()).toBe(1);
    expect((await DiscountModel.findOne().lean())!.usedCount).toBe(1);
    expect(await stock()).toBe(19);
  });
});

describe('customer orders and transitions (AC-CHK-06/07; AC-ORD-01; AC-RBAC-03)', () => {
  it('creates COD pending/unpaid, authorizes admin mark-paid, records paidAt and rejects illegal/customer transitions', async () => {
    const order = body<ApiEnvelope<OrderView>>(
      await post(0, 'cod-key-0001', { ...input, payment: { method: 'cod' } }),
    ).data;
    expect(order.status).toBe('pending');
    expect(order.payment.status).toBe('unpaid');
    const path = `/api/v1/admin/orders/${order.id}/status`;
    expect((await request(app).patch(path).send({ status: 'paid' })).status).toBe(401);
    expect(
      (
        await request(app)
          .patch(path)
          .auth(users[0]!.token, { type: 'bearer' })
          .send({ status: 'paid' })
      ).status,
    ).toBe(403);
    const paid = await request(app)
      .patch(path)
      .auth(users[2]!.token, { type: 'bearer' })
      .send({ status: 'paid' });
    expect(paid.status).toBe(200);
    expect(body<ApiEnvelope<OrderView>>(paid).data.payment.paidAt).toBeDefined();
    expect(
      (
        await request(app)
          .post(`/api/v1/orders/${order.orderNumber}/cancel`)
          .auth(users[0]!.token, { type: 'bearer' })
          .send({})
      ).status,
    ).toBe(409);
    expect(
      (
        await request(app)
          .patch(path)
          .auth(users[2]!.token, { type: 'bearer' })
          .send({ status: 'pending' })
      ).status,
    ).toBe(409);
    expect(
      (
        await request(app)
          .patch(path)
          .auth(users[2]!.token, { type: 'bearer' })
          .send({ status: 'shipped' })
      ).status,
    ).toBe(422);
    expect(
      (
        await request(app)
          .patch(path)
          .auth(users[2]!.token, { type: 'bearer' })
          .send({ status: 'shipped', tracking: { carrier: 'Test carrier', number: 'TRACK001' } })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .post(`/api/v1/orders/${order.orderNumber}/cancel`)
          .auth(users[0]!.token, { type: 'bearer' })
          .send({})
      ).status,
    ).toBe(409);
  });
  it('cancels once under concurrency, restores stock, releases discount, and rolls stats back', async () => {
    await code();
    await cart(0, 1, 'PROMO10');
    const order = body<ApiEnvelope<OrderView>>(
      await post(0, 'cod-cancel-key', { ...input, payment: { method: 'cod' } }),
    ).data;
    const cancel = () =>
      request(app)
        .post(`/api/v1/orders/${order.orderNumber}/cancel`)
        .auth(users[0]!.token, { type: 'bearer' })
        .send({});
    const responses = await Promise.all([cancel(), cancel()]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await stock()).toBe(20);
    expect(await StockMovementModel.countDocuments({ reason: 'order_cancelled' })).toBe(1);
    expect(await RedemptionModel.countDocuments()).toBe(0);
    expect((await DiscountModel.findOne().lean())!.usedCount).toBe(0);
    expect((await UserModel.findById(users[0]!.id).lean())!.stats).toMatchObject({
      orderCount: 0,
      totalSpent: 0,
    });
    await cart(0, 1, 'PROMO10');
    expect((await post(0, 'reuse-discount-key')).status).toBe(201);
  });
  it('returns 404 for another customer order and paginates 25 own orders newest first', async () => {
    const first = body<ApiEnvelope<OrderView>>(await post()).data;
    expect(
      (
        await request(app)
          .get(`/api/v1/orders/${first.orderNumber}`)
          .auth(users[1]!.token, { type: 'bearer' })
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .post(`/api/v1/orders/${first.orderNumber}/cancel`)
          .auth(users[1]!.token, { type: 'bearer' })
          .send({})
      ).status,
    ).toBe(404);
    const original = await OrderModel.findById(first.id).lean();
    await OrderModel.insertMany(
      Array.from({ length: 24 }, (_, i) => ({
        ...original,
        _id: new mongoose.Types.ObjectId(),
        orderNumber: `HLD-2026-${String(i + 100).padStart(6, '0')}`,
        idempotencyKey: i % 2 === 0 ? undefined : `history-${i}`,
        createdAt: new Date(Date.now() + i * 1000),
      })),
    );
    const result = body<ApiEnvelope<OrderView[]>>(
      await request(app)
        .get('/api/v1/orders?page=2&limit=12')
        .auth(users[0]!.token, { type: 'bearer' }),
    );
    expect(result.data).toHaveLength(12);
    expect(result.meta).toMatchObject({ total: 25, totalPages: 3, hasPrev: true, hasNext: true });
    expect(result.data[0]!.createdAt >= result.data[1]!.createdAt).toBe(true);
    expect(
      (await request(app).get('/api/v1/orders?limit=101').auth(users[0]!.token, { type: 'bearer' }))
        .status,
    ).toBe(422);
    expect(
      (await request(app).get('/api/v1/orders?unknown=1').auth(users[0]!.token, { type: 'bearer' }))
        .status,
    ).toBe(422);
  });
  it('enforces the full order state machine', () => {
    expect(() => assertTransition('pending', 'cancelled', true)).not.toThrow();
    expect(() => assertTransition('paid', 'cancelled', true)).toThrow();
    expect(() => assertTransition('completed', 'pending', false)).toThrow();
    expect(() => assertTransition('completed', 'refunded', false)).not.toThrow();
  });
  it('rolls back a cancellation failure without double restoring stock or releasing usage', async () => {
    await code();
    await cart(0, 1, 'PROMO10');
    const order = body<ApiEnvelope<OrderView>>(
      await post(0, 'cancel-rollback-key', { ...input, payment: { method: 'cod' } }),
    ).data;
    jest.spyOn(StockMovementModel, 'create').mockImplementationOnce(() => {
      throw new Error('Injected movement persistence failure');
    });
    const cancel = () =>
      request(app)
        .post(`/api/v1/orders/${order.orderNumber}/cancel`)
        .auth(users[0]!.token, { type: 'bearer' })
        .send({});
    expect((await cancel()).status).toBe(500);
    expect(await stock()).toBe(19);
    expect((await OrderModel.findById(order.id).lean())!.status).toBe('pending');
    expect(await RedemptionModel.countDocuments()).toBe(1);
    expect((await DiscountModel.findOne().lean())!.usedCount).toBe(1);
    expect((await cancel()).status).toBe(200);
    expect(await stock()).toBe(20);
    expect(await StockMovementModel.countDocuments({ reason: 'order_cancelled' })).toBe(1);
  });
  it('rolls back failed refunds and records a successful refund/restock exactly once', async () => {
    const order = body<ApiEnvelope<OrderView>>(await post()).data;
    const status = (body: object) =>
      request(app)
        .patch(`/api/v1/admin/orders/${order.id}/status`)
        .auth(users[2]!.token, { type: 'bearer' })
        .send(body);
    expect(
      (await status({ status: 'shipped', tracking: { carrier: 'Test', number: 'TRACK' } })).status,
    ).toBe(200);
    jest.spyOn(deps.payment, 'refund').mockRejectedValueOnce(new Error('Injected refund failure'));
    expect((await status({ status: 'refunded', restock: true })).status).toBe(500);
    expect(await stock()).toBe(19);
    expect((await OrderModel.findById(order.id).lean())!.status).toBe('shipped');
    const refunded = await status({ status: 'refunded', restock: true });
    expect(refunded.status).toBe(200);
    expect(body<ApiEnvelope<OrderView>>(refunded).data.payment.status).toBe('refunded');
    expect(await stock()).toBe(20);
    expect(await StockMovementModel.countDocuments({ reason: 'refund_restock' })).toBe(1);
    expect((await status({ status: 'refunded', restock: true })).status).toBe(409);
    expect(await stock()).toBe(20);
  });
});
