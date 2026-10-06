import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import type { Express } from 'express';
import type {
  AdminProduct,
  AdminCategory,
  AdminOrder,
  AdminCustomer,
  AdminDiscount,
  AdminSettings,
  DashboardSummary,
  ApiEnvelope,
  ApiErrorEnvelope,
  RevenuePoint,
  InventoryRow,
  StockMovement,
} from '@commerceos/shared';
import { createApp } from '@api/app.js';
import type { Env } from '@api/config/env.js';
import { createLogger } from '@api/config/logger.js';
import { UserModel } from '@api/modules/users/users.model.js';
import { ProductModel } from '@api/modules/catalog/product.model.js';
import { CategoryModel } from '@api/modules/catalog/category.model.js';
import { SettingsModel } from '@api/modules/settings/settings.model.js';
import { OrderModel, CounterModel, StockMovementModel } from '@api/modules/orders/orders.model.js';
import { CartModel } from '@api/modules/cart/cart.model.js';
import { DiscountModel, RedemptionModel } from '@api/modules/cart/discount.model.js';
import { ensureCatalogSeed } from '@api/seed/catalog-seed.js';
import { ADMIN_ENDPOINTS } from './admin.routes.js';
import { slugify, validateMatrix } from './catalogue-admin.service.js';
import { productSchema } from './admin.schemas.js';
import { csvCell, metric } from './insight-admin.service.js';
import { rm, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
const body = <T>(r: { body: unknown }) => r.body as T;
let mongo: MongoMemoryReplSet,
  app: Express,
  admin: string,
  customer: string,
  adminId: string,
  customerId: string,
  category: string,
  uploadDir: string;
const adminRequest = (method: 'get' | 'post' | 'patch' | 'delete' | 'put', path: string) => {
  const client = request(app);
  return client[method]('/api/v1/admin' + path).auth(admin, { type: 'bearer' });
};
const productInput = () => ({
  name: 'Portfolio studio product',
  description: '<p>A well-built product.</p><script>alert(1)</script>',
  category,
  images: [
    { url: '/assets/catalog/arc-headphones.svg', alt: 'Portfolio product', isPrimary: true },
  ],
  optionDefinitions: [
    { name: 'Color', values: ['Black', 'Sand', 'Blue'] },
    { name: 'Storage', values: ['128', '256'] },
  ],
  variants: ['Black', 'Sand', 'Blue'].flatMap((Color, i) =>
    ['128', '256'].map((Storage, j) => ({
      sku: `PORT-${i}-${j}`,
      options: { Color, Storage },
      price: 20000,
      stock: 10,
      lowStockThreshold: 5,
      isActive: true,
      images: [],
    })),
  ),
  status: 'active',
  specs: [{ label: 'Material', value: 'Aluminium' }],
  seo: { metaTitle: 'Portfolio product', metaDescription: 'Made to last.' },
});
async function createProduct() {
  const r = await adminRequest('post', '/products').send(productInput());
  expect(r.status).toBe(201);
  return body<ApiEnvelope<AdminProduct>>(r).data;
}
beforeAll(async () => {
  uploadDir = await mkdtemp(join(tmpdir(), 'commerceos-upload-test-'));
  config.UPLOAD_DIR = uploadDir;
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri());
  await Promise.all([
    UserModel.init(),
    ProductModel.init(),
    CategoryModel.init(),
    OrderModel.init(),
    CounterModel.init(),
    CartModel.init(),
    DiscountModel.init(),
    StockMovementModel.init(),
  ]);
}, 120000);
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
  await rm(uploadDir, { recursive: true, force: true });
}, 30000);
beforeEach(async () => {
  await Promise.all([
    UserModel.deleteMany({}),
    ProductModel.deleteMany({}),
    CategoryModel.deleteMany({}),
    SettingsModel.deleteMany({}),
    OrderModel.deleteMany({}),
    StockMovementModel.deleteMany({}),
    CounterModel.deleteMany({}),
    CartModel.deleteMany({}),
    DiscountModel.deleteMany({}),
    RedemptionModel.deleteMany({}),
  ]);
  await ensureCatalogSeed();
  const a = await UserModel.create({
    email: 'admin@example.com',
    firstName: 'Admin',
    lastName: 'Tester',
    passwordHash: 'unused',
    role: 'admin',
  });
  const c = await UserModel.create({
    email: 'customer@example.com',
    firstName: 'Customer',
    lastName: 'Tester',
    passwordHash: 'unused',
  });
  adminId = String(a._id);
  customerId = String(c._id);
  admin = jwt.sign({ sub: adminId, role: 'admin' }, config.JWT_ACCESS_SECRET);
  customer = jwt.sign({ sub: customerId, role: 'customer' }, config.JWT_ACCESS_SECRET);
  category = String((await CategoryModel.findOne({ isActive: true }).orFail())._id);
  app = createApp(config, createLogger('silent'));
});
describe('admin protection and input validation', () => {
  it('enumerates every admin endpoint and rejects anonymous/customer calls before validation', async () => {
    for (const [method, path] of [
      ...ADMIN_ENDPOINTS,
      ['PATCH', '/orders/000000000000000000000000/status'],
      ['POST', '/orders/000000000000000000000000/refund'],
    ] as [string, string][]) {
      const m = method.toLowerCase() as 'get' | 'post' | 'patch' | 'delete' | 'put';
      expect((await request(app)[m]('/api/v1/admin' + path)).status).toBe(401);
      const client = request(app);
      expect(
        (await client[m]('/api/v1/admin' + path).auth(customer, { type: 'bearer' })).status,
      ).toBe(403);
    }
  });
  it('rejects malformed identifiers, unknown properties, bad pagination and operator injection', async () => {
    expect((await adminRequest('get', '/products/not-an-id')).status).toBe(422);
    expect((await adminRequest('get', '/products?limit=101')).status).toBe(422);
    expect(
      (await adminRequest('post', '/products').send({ ...productInput(), soldCount: 999 })).status,
    ).toBe(422);
    expect(
      (await adminRequest('post', '/products').send({ $set: { status: 'active' } })).status,
    ).toBe(400);
  });
});
describe('catalogue publishing, media and inventory', () => {
  it('persists six variants, sanitized description/specs/SEO and publishes the real product', async () => {
    const p = await createProduct();
    expect(p.variants).toHaveLength(6);
    expect(p.totalStock).toBe(60);
    expect(p.description).not.toMatch(/script|alert/);
    const publicResult = await request(app).get(`/api/v1/products/${p.slug}`);
    expect(publicResult.status).toBe(200);
    expect(body<ApiEnvelope<AdminProduct>>(publicResult).data.seo.metaTitle).toBe(
      'Portfolio product',
    );
    expect(await StockMovementModel.countDocuments({ product: p.id })).toBe(6);
    expect((await adminRequest('get', `/products/${p.id}`)).status).toBe(200);
    expect((await adminRequest('get', '/products?q=Portfolio&stock=low')).status).toBe(200);
  });
  it('reports duplicate SKU/slug fields, rejects bad combinations, auto-suffixes generated slugs and duplicates as draft', async () => {
    const p = await createProduct();
    const input = productInput();
    input.variants[1]!.sku = input.variants[0]!.sku;
    const dup = await adminRequest('post', '/products').send(input);
    expect(dup.status).toBe(409);
    expect(body<ApiErrorEnvelope>(dup).error.details).toMatchObject({ field: 'variants.1.sku' });
    const other = {
      ...productInput(),
      slug: p.slug,
      variants: productInput().variants.map((v) => ({ ...v, sku: 'OTHER-' + v.sku })),
    };
    expect((await adminRequest('post', '/products').send(other)).status).toBe(409);
    delete (other as { slug?: string }).slug;
    const suffix = body<ApiEnvelope<AdminProduct>>(
      await adminRequest('post', '/products').send(other),
    ).data;
    expect(suffix.slug).toBe(p.slug + '-2');
    const duplicate = body<ApiEnvelope<AdminProduct>>(
      await adminRequest('post', `/products/${p.id}/duplicate`).send({}),
    ).data;
    expect(duplicate.status).toBe('draft');
    expect(duplicate.totalStock).toBe(0);
    const bad = productInput();
    bad.variants[0]!.options.Color = 'Purple';
    expect((await adminRequest('post', '/products').send(bad)).status).toBe(422);
  });
  it('edits variants without changing identifiers and records absolute stock edits', async () => {
    const p = await createProduct();
    const v = p.variants[0]!;
    const edited = await adminRequest('patch', `/products/${p.id}/variants/${v.id}`).send({
      price: 22000,
      stock: 8,
    });
    expect(edited.status).toBe(200);
    const updated = body<ApiEnvelope<AdminProduct>>(edited).data;
    expect(updated.variants[0]).toMatchObject({ id: v.id, price: 22000, stock: 8 });
    expect(updated.totalStock).toBe(58);
    expect(await StockMovementModel.countDocuments({ product: p.id, delta: -2 })).toBe(1);
    expect(
      (await adminRequest('patch', `/products/${p.id}`).send({ status: 'archived' })).status,
    ).toBe(200);
    expect((await request(app).get(`/api/v1/products/${p.slug}`)).status).toBe(404);
    expect((await adminRequest('delete', `/products/${p.id}`)).status).toBe(204);
  });
  it('serializes stock decrements, rejects negative stock and exposes low-stock/movement history', async () => {
    const p = await createProduct();
    const v = p.variants[0]!;
    const path = `/products/${p.id}/variants/${v.id}/stock`;
    const results = await Promise.all([
      adminRequest('post', path).send({
        delta: -6,
        reason: 'manual_adjustment',
        note: 'Count correction',
      }),
      adminRequest('post', path).send({
        delta: -6,
        reason: 'manual_adjustment',
        note: 'Second count',
      }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const inv = body<ApiEnvelope<InventoryRow[]>>(
      await adminRequest('get', `/inventory?low=true&q=${v.sku}`),
    );
    expect(inv.data[0]?.stock).toBe(4);
    const moves = body<ApiEnvelope<StockMovement[]>>(
      await adminRequest('get', `/inventory/movements?variantId=${v.id}`),
    );
    expect(moves.data[0]).toMatchObject({ delta: -6, stockAfter: 4, note: 'Count correction' });
    expect(
      (
        await adminRequest('post', path).send({
          delta: 2,
          reason: 'restock',
          note: 'Received stock',
        })
      ).status,
    ).toBe(200);
    expect((await adminRequest('get', '/inventory?out=true')).status).toBe(200);
    expect(
      (await adminRequest('post', path).send({ delta: 0, reason: 'restock', note: 'Zero' })).status,
    ).toBe(422);
  });
  it('checks image signatures and limits; persists ordering and primary flag', async () => {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aUj8AAAAASUVORK5CYII=',
      'base64',
    );
    const r = await adminRequest('post', '/uploads/images')
      .attach('images', png, { filename: 'a.png', contentType: 'image/png' })
      .attach('images', png, { filename: 'b.png', contentType: 'image/png' })
      .attach('images', png, { filename: 'c.png', contentType: 'image/png' });
    expect(r.status).toBe(201);
    const urls = body<ApiEnvelope<{ url: string }[]>>(r).data;
    expect(urls).toHaveLength(3);
    expect((await request(app).get(urls[0]!.url)).status).toBe(200);
    expect(
      (
        await adminRequest('post', '/uploads/images').attach('images', Buffer.from('MZfake.exe'), {
          filename: 'fake.png',
          contentType: 'image/png',
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await adminRequest('post', '/uploads/images').attach(
          'images',
          Buffer.alloc(6 * 1024 * 1024),
          { filename: 'large.png', contentType: 'image/png' },
        )
      ).status,
    ).toBe(400);
    const p = await createProduct();
    const images = urls
      .reverse()
      .map((i, n) => ({ url: i.url, alt: 'Image ' + n, isPrimary: n === 1 }));
    const edit = await adminRequest('patch', `/products/${p.id}`).send({ images });
    expect(edit.status).toBe(200);
    expect(body<ApiEnvelope<AdminProduct>>(edit).data.images).toEqual(images);
  });
  it('enforces category depth/delete rules and explicit slug editing', async () => {
    const top = body<ApiEnvelope<AdminCategory>>(
      await adminRequest('post', '/categories').send({ name: 'Furniture' }),
    ).data;
    const child = body<ApiEnvelope<AdminCategory>>(
      await adminRequest('post', '/categories').send({ name: 'Seating', parentId: top.id }),
    ).data;
    expect(
      (await adminRequest('post', '/categories').send({ name: 'Deep', parentId: child.id })).status,
    ).toBe(409);
    expect((await adminRequest('delete', `/categories/${top.id}`)).status).toBe(409);
    expect((await adminRequest('delete', `/categories/${category}`)).status).toBe(409);
    expect(
      (await adminRequest('patch', `/categories/${child.id}`).send({ slug: 'chairs' })).status,
    ).toBe(200);
    expect((await adminRequest('get', '/categories')).status).toBe(200);
    expect((await adminRequest('delete', `/categories/${child.id}`)).status).toBe(204);
    expect((await adminRequest('delete', `/categories/${top.id}`)).status).toBe(204);
  });
});
async function placedOrder() {
  const p = await createProduct();
  await CartModel.create({
    user: customerId,
    items: [{ product: p.id, variantId: p.variants[0]!.id, quantity: 1 }],
  });
  const r = await request(app)
    .post('/api/v1/orders')
    .auth(customer, { type: 'bearer' })
    .set('Idempotency-Key', 'admin-workflow-key')
    .send({
      address: {
        fullName: 'Customer Tester',
        line1: '1 Market Street',
        city: 'Lahore',
        region: 'Punjab',
        postalCode: '54000',
        country: 'PK',
        phone: '+923001234567',
      },
      shippingMethodCode: 'standard',
      payment: { method: 'cod' },
    });
  expect(r.status).toBe(201);
  return { p, o: body<ApiEnvelope<AdminOrder>>(r).data };
}
describe('sales, settings and calculations', () => {
  it('fulfils COD through payment/shipment/completion, keeps notes private and refunds once', async () => {
    const { p, o } = await placedOrder();
    expect((await adminRequest('delete', `/products/${p.id}`)).status).toBe(409);
    await adminRequest('post', `/orders/${o.id}/notes`)
      .send({ text: 'Handle with care' })
      .expect(201);
    expect(
      body<ApiEnvelope<AdminOrder>>(await adminRequest('get', `/orders/${o.id}`)).data
        .internalNotes[0]?.text,
    ).toBe('Handle with care');
    const path = `/orders/${o.id}/status`;
    await adminRequest('patch', path).send({ status: 'paid' }).expect(200);
    await adminRequest('patch', path).send({ status: 'shipped' }).expect(422);
    await adminRequest('patch', path)
      .send({ status: 'shipped', tracking: { carrier: 'Test carrier', number: 'TRACK123' } })
      .expect(200);
    await adminRequest('patch', path).send({ status: 'completed' }).expect(200);
    const bad = await adminRequest('patch', path).send({ status: 'pending' });
    expect(bad.status).toBe(409);
    expect(body<ApiErrorEnvelope>(bad).error.code).toBe('INVALID_STATE_TRANSITION');
    await adminRequest('post', `/orders/${o.id}/refund`).send({ restock: true }).expect(200);
    await adminRequest('post', `/orders/${o.id}/refund`).send({ restock: true }).expect(409);
    expect((await ProductModel.findById(p.id).lean())!.variants[0]!.stock).toBe(10);
    const publicOrder = await request(app)
      .get(`/api/v1/orders/${o.orderNumber}`)
      .auth(customer, { type: 'bearer' });
    expect(JSON.stringify(publicOrder.body)).not.toMatch(/internalNotes|Handle with care/);
    const list = body<ApiEnvelope<AdminOrder[]>>(
      await adminRequest('get', '/orders?q=customer@example.com&status=refunded'),
    );
    expect(list.data).toHaveLength(1);
    expect(list.meta).toMatchObject({ statusCounts: { refunded: 1 } });
  });
  it('protects admins, disables customers immediately and computes lifetime value', async () => {
    const { o } = await placedOrder();
    expect(
      (await adminRequest('patch', `/customers/${adminId}`).send({ role: 'customer' })).status,
    ).toBe(409);
    expect(
      (await adminRequest('patch', `/customers/${adminId}`).send({ status: 'disabled' })).status,
    ).toBe(409);
    const c = body<ApiEnvelope<AdminCustomer>>(
      await adminRequest('get', `/customers/${customerId}`),
    ).data;
    expect(c.lifetimeValue).toBe(o.totals.total);
    expect((await adminRequest('get', '/customers?q=Customer&sort=-spent')).status).toBe(200);
    await adminRequest('patch', `/customers/${customerId}`)
      .send({ status: 'disabled' })
      .expect(200);
    expect(
      (await request(app).get('/api/v1/orders').auth(customer, { type: 'bearer' })).status,
    ).toBe(401);
    await adminRequest('patch', `/customers/${customerId}`)
      .send({ status: 'active', role: 'admin' })
      .expect(200);
  });
  it('preserves one active admin when two admins concurrently demote each other', async () => {
    await adminRequest('patch', `/customers/${customerId}`).send({ role: 'admin' }).expect(200);
    const results = await Promise.all([
      adminRequest('patch', `/customers/${customerId}`).send({ role: 'customer' }),
      request(app)
        .patch(`/api/v1/admin/customers/${adminId}`)
        .auth(customer, { type: 'bearer' })
        .send({ role: 'customer' }),
    ]);
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.every((r) => [200, 401, 403, 409].includes(r.status))).toBe(true);
    expect(await UserModel.countDocuments({ role: 'admin', status: 'active' })).toBe(1);
  });
  it('keeps historical discount redemptions and prevents resetting a deleted code', async () => {
    const { o } = await placedOrder();
    const d = body<ApiEnvelope<AdminDiscount>>(
      await adminRequest('post', '/discounts').send({
        code: 'HISTORICAL',
        type: 'fixed',
        value: 100,
      }),
    ).data;
    await RedemptionModel.create({ code: d.code, user: customerId, order: o.id, amount: 100 });
    await adminRequest('delete', `/discounts/${d.id}`).expect(204);
    expect(await RedemptionModel.countDocuments({ code: d.code })).toBe(1);
    await adminRequest('post', '/discounts')
      .send({ code: d.code, type: 'fixed', value: 100 })
      .expect(409);
  });
  it('validates discount combinations, computed statuses, scope and stats', async () => {
    const d = body<ApiEnvelope<AdminDiscount>>(
      await adminRequest('post', '/discounts').send({
        code: 'PORTFOLIO',
        type: 'percentage',
        value: 15,
        appliesTo: { categories: [category], products: [] },
      }),
    ).data;
    expect(d.status).toBe('active');
    await adminRequest('post', '/discounts')
      .send({ code: 'PORTFOLIO', type: 'percentage', value: 15 })
      .expect(409);
    await adminRequest('patch', `/discounts/${d.id}`)
      .send({ code: d.code, type: 'percentage', value: 101 })
      .expect(422);
    await adminRequest('patch', `/discounts/${d.id}`)
      .send({ code: d.code, type: 'fixed', value: 2000, isActive: false })
      .expect(200);
    expect(
      body<ApiEnvelope<AdminDiscount[]>>(
        await adminRequest('get', '/discounts?status=disabled'),
      ).data.some((v) => v.id === d.id),
    ).toBe(true);
    expect(
      body<ApiEnvelope<AdminDiscount>>(await adminRequest('get', `/discounts/${d.id}`)).data
        .redemptions,
    ).toBe(0);
    await adminRequest('delete', `/discounts/${d.id}`).expect(204);
  });
  it('rejects stale product editors without overwriting concurrent stock or its audit', async () => {
    const p = await createProduct();
    const v = p.variants[0]!;
    await adminRequest('post', `/products/${p.id}/variants/${v.id}/stock`)
      .send({ delta: -2, reason: 'manual_adjustment', note: 'Concurrent inventory adjustment' })
      .expect(200);
    await adminRequest('patch', `/products/${p.id}`)
      .send({ name: 'Stale editor', variants: p.variants, expectedUpdatedAt: p.updatedAt })
      .expect(409);
    const current = body<ApiEnvelope<AdminProduct>>(
      await adminRequest('get', `/products/${p.id}`),
    ).data;
    expect(current.variants[0]!.stock).toBe(8);
    expect(current.name).toBe(p.name);
    expect(await StockMovementModel.countDocuments({ variantId: v.id })).toBe(2);
  });
  it('rejects endpoint-inappropriate filters and uses 404 for missing editable resources', async () => {
    for (const path of [
      '/products?status=disabled',
      '/products?sort=spent',
      '/customers?category=' + category,
      '/discounts?status=draft',
      '/categories?stock=out',
    ])
      await adminRequest('get', path).expect(422);
    await adminRequest('patch', '/categories/000000000000000000000000')
      .send({ name: 'Missing category' })
      .expect(404);
  });
  it('saves optional empty branding fields', async () => {
    const s = body<ApiEnvelope<AdminSettings>>(await adminRequest('get', '/settings')).data;
    await adminRequest('put', '/settings')
      .send({
        ...s,
        store: { ...s.store, logoUrl: '', tagline: '', phone: '', address: '', announcement: '' },
      })
      .expect(200);
  });
  it('changes brand/currency/theme/tax/shipping as persisted settings and rejects invalid replacements', async () => {
    const s = body<ApiEnvelope<AdminSettings>>(await adminRequest('get', '/settings')).data;
    const changed = {
      ...s,
      store: { ...s.store, name: 'Northline' },
      currency: { code: 'EUR', symbol: '€', decimals: 2 },
      theme: { primary: '#123456', accent: '#987654' },
      tax: { ratePercent: 20, inclusive: false },
    };
    await adminRequest('put', '/settings').send(changed).expect(200);
    const pub = body<ApiEnvelope<AdminSettings>>(
      await request(app).get('/api/v1/settings/public'),
    ).data;
    expect(pub.store.name).toBe('Northline');
    expect(pub.theme).toEqual(changed.theme);
    expect(pub.currency).toEqual(changed.currency);
    await adminRequest('put', '/settings')
      .send({ ...changed, shipping: { methods: [] } })
      .expect(422);
    await adminRequest('put', '/settings')
      .send({ ...changed, theme: { primary: 'url(javascript:bad)', accent: '#987654' } })
      .expect(422);
    const { o } = await placedOrder();
    expect(o.totals.tax).toBe(4000);
  });
  it('matches dashboard and analytics aggregates to known sales and streams safe filtered CSV', async () => {
    const { p, o } = await placedOrder();
    await adminRequest('patch', `/orders/${o.id}/status`).send({ status: 'paid' }).expect(200);
    const summary = body<ApiEnvelope<DashboardSummary>>(
      await adminRequest('get', '/dashboard/summary?range=30d'),
    ).data;
    expect(summary.revenue.value).toBe(o.totals.total);
    expect(summary.orders.value).toBe(1);
    expect(summary.aov.value).toBe(o.totals.total);
    expect(summary.recentOrders[0]?.orderNumber).toBe(o.orderNumber);
    const series = body<ApiEnvelope<RevenuePoint[]>>(
      await adminRequest('get', '/analytics/revenue?granularity=week'),
    ).data;
    expect(series.reduce((sum, p) => sum + p.revenue, 0)).toBe(o.totals.total);
    for (const path of ['top-products', 'categories', 'customers', 'discounts'])
      await adminRequest('get', '/analytics/' + path).expect(200);
    const exported = await adminRequest('get', '/export/orders.csv?status=paid');
    expect(exported.status).toBe(200);
    expect(exported.text).toContain(o.orderNumber);
    expect((await adminRequest('get', '/export/orders.csv?status=cancelled')).text).not.toContain(
      o.orderNumber,
    );
    expect((await adminRequest('get', '/export/products.csv?q=Portfolio')).text).toContain(
      p.variants[0]!.sku,
    );
  });
});
it('validates pure slug, matrix, percentage delta and CSV formula safety rules', () => {
  expect(slugify(' Café & Seats ')).toBe('cafe-seats');
  expect(metric(200, 100).delta).toBe(100);
  expect(metric(10, 0).delta).toBeNull();
  expect(csvCell('=SUM(A1)')).toBe('"\'=SUM(A1)"');
  expect(() => validateMatrix(productSchema.parse(productInput()))).not.toThrow();
});
