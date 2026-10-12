import argon2 from 'argon2';
import type { Logger } from 'pino';
import type { Env } from '@api/config/env.js';
import { UserModel } from '@api/modules/users/users.model.js';
import { ProductModel } from '@api/modules/catalog/product.model.js';
import { CategoryModel } from '@api/modules/catalog/category.model.js';
import { CartModel } from '@api/modules/cart/cart.model.js';
import { DiscountModel } from '@api/modules/cart/discount.model.js';
import { OrderModel, CounterModel, StockMovementModel } from '@api/modules/orders/orders.model.js';
import { placeOrder } from '@api/modules/orders/orders.service.js';
import { transitionOrder } from '@api/modules/orders/order-transitions.service.js';
import { MockPaymentProvider } from '@api/common/providers/payment.provider.js';
import { createMailProvider } from '@api/common/providers/mail.provider.js';
const address = {
  label: 'Home',
  fullName: 'Alex Morgan',
  line1: '24 Market Street',
  city: 'Austin',
  region: 'Texas',
  postalCode: '78701',
  country: 'US',
  phone: '+15125550123',
  isDefault: true,
};
export async function ensureAccountsSeed() {
  const accounts = [
    {
      email: 'admin@halden.test',
      password: 'Admin#12345',
      role: 'admin',
      firstName: 'Store',
      lastName: 'Manager',
    },
    {
      email: 'customer@halden.test',
      password: 'Customer#12345',
      role: 'customer',
      firstName: 'Alex',
      lastName: 'Morgan',
    },
  ];
  for (const a of accounts) {
    if (!(await UserModel.exists({ email: a.email })))
      await UserModel.create({
        email: a.email,
        passwordHash: await argon2.hash(a.password),
        role: a.role,
        firstName: a.firstName,
        lastName: a.lastName,
        addresses: [address],
      });
  }
}
export async function ensureCommerceSeed(config: Env, logger: Logger) {
  await ensureAccountsSeed();
  await Promise.all([OrderModel.init(), CounterModel.init(), StockMovementModel.init()]);
  const admin = await UserModel.findOne({ email: 'admin@halden.test' }).orFail();
  const main = await UserModel.findOne({ email: 'customer@halden.test' }).orFail();
  const sharedHash = await argon2.hash('DemoCustomer#12345');
  for (let i = 0; i < 39; i++) {
    await UserModel.updateOne(
      { email: `shopper${i + 1}@halden.test` },
      {
        $setOnInsert: {
          email: `shopper${i + 1}@halden.test`,
          firstName: ['Jordan', 'Taylor', 'Casey', 'Sam', 'Jamie', 'Riley'][i % 6],
          lastName: ['Hayes', 'Chen', 'Patel', 'Reed', 'Khan'][i % 5],
          passwordHash: sharedHash,
          role: 'customer',
          status: 'active',
          createdAt: new Date(Date.now() - (i * 3 + 1) * 86400000),
        },
      },
      { upsert: true, timestamps: false },
    );
  }
  const parents = await CategoryModel.find({ parent: { $exists: false } })
    .sort({ slug: 1 })
    .lean();
  for (const [i, parent] of parents.entries()) {
    for (const [j, label] of ['Essentials', 'Premium'].entries()) {
      await CategoryModel.updateOne(
        { slug: `${parent.slug}-${label.toLowerCase()}` },
        {
          $setOnInsert: {
            name: `${parent.name} ${label}`,
            slug: `${parent.slug}-${label.toLowerCase()}`,
            description: `${label} selections for ${parent.name}.`,
            parent: parent._id,
            sortOrder: i * 2 + j,
            isActive: true,
          },
        },
        { upsert: true },
      );
    }
  }
  const source = await ProductModel.findOne({ status: 'active' }).sort({ slug: 1 }).lean();
  if (source) {
    for (const [i, status] of ['draft', 'draft', 'archived'].entries()) {
      const slug = `demo-${status}-${i + 1}`;
      if (!(await ProductModel.exists({ slug }))) {
        const { _id, createdAt, updatedAt, ...copy } = source;
        void [_id, createdAt, updatedAt];
        await ProductModel.create({
          ...copy,
          slug,
          name: `Demo ${status} product ${i + 1}`,
          status,
          soldCount: 0,
          ratingAverage: 0,
          ratingCount: 0,
          isFeatured: false,
          variants: source.variants.map((v, n) => ({
            ...v,
            _id: undefined,
            sku: `DEMO-${status.toUpperCase()}-${i + 1}-${n}`,
            stock: 0,
          })),
        });
      }
    }
  }
  const audio = await CategoryModel.findOne({ slug: 'personal-audio' }).lean();
  const codes = [
    { code: 'SAVE25', type: 'fixed', value: 2500, minSubtotal: 20000 },
    {
      code: 'AUDIO15',
      type: 'percentage',
      value: 15,
      maxDiscount: 6000,
      appliesTo: { categories: audio ? [audio._id] : [], products: [] },
    },
    { code: 'VIP30', type: 'percentage', value: 30, maxDiscount: 10000 },
    {
      code: 'FUTURE5',
      type: 'percentage',
      value: 5,
      startsAt: new Date(Date.now() + 30 * 86400000),
    },
    { code: 'USEDUP', type: 'percentage', value: 5, usageLimit: 0 },
    { code: 'OFFLINE', type: 'percentage', value: 10, isActive: false },
  ];
  for (const c of codes)
    await DiscountModel.updateOne(
      { code: c.code },
      {
        $setOnInsert: {
          ...c,
          isActive: c.isActive ?? true,
          usedCount: 0,
          perUserLimit: 1,
          minSubtotal: c.minSubtotal ?? 0,
          appliesTo: c.appliesTo ?? { categories: [], products: [] },
        },
      },
      { upsert: true },
    );
  const users = await UserModel.find({ role: 'customer', email: /@halden\.test$/ })
    .sort({ email: 1 })
    .lean();
  const products = await ProductModel.find({ status: 'active' }).sort({ slug: 1 }).lean();
  const deps = {
    payment: new MockPaymentProvider(),
    mail: createMailProvider(config, logger),
    logger,
    webBaseUrl: config.WEB_BASE_URL,
  };
  if (!(await OrderModel.exists({ idempotencyKey: /^seed-history-v1-/ }))) {
    await ProductModel.updateMany({}, { $set: { soldCount: 0 } });
    for (const p of products)
      for (const v of p.variants) {
        if (v.stock)
          await StockMovementModel.create({
            product: p._id,
            variantId: v._id,
            sku: v.sku,
            delta: v.stock,
            stockAfter: v.stock,
            reason: 'restock',
            by: admin._id,
            note: 'Opening demo inventory',
            createdAt: new Date(Date.now() - 100 * 86400000),
          });
      }
  }
  for (let i = 0; i < 120; i++) {
    const key = `seed-history-v1-${i}`;
    if (await OrderModel.exists({ idempotencyKey: key })) continue;
    const user = i < 8 ? main : users[i % users.length];
    const base = products[i % products.length];
    if (!user || !base) continue;
    const p = await ProductModel.findById(base._id).lean();
    const v = p?.variants.find((v) => v.isActive && v.stock > 0);
    if (!p || !v) continue;
    await CartModel.findOneAndUpdate(
      { user: user._id },
      {
        $set: {
          items: [{ product: p._id, variantId: v._id, quantity: Math.min(v.stock, 1 + (i % 2)) }],
          discountCode: i % 19 === 0 ? 'VIP30' : undefined,
        },
      },
      { upsert: true },
    );
    const cod = i < 10 || (i >= 108 && i < 115);
    const o = await placeOrder(
      String(user._id),
      {
        address: {
          fullName: address.fullName,
          line1: address.line1,
          city: address.city,
          region: address.region,
          postalCode: address.postalCode,
          country: address.country,
          phone: address.phone,
        },
        shippingMethodCode: i % 7 === 0 ? 'express' : 'standard',
        payment: cod ? { method: 'cod' } : { method: 'card_mock', token: 'mock_approved' },
      },
      key,
      deps,
    );
    if (i >= 25 && i < 108) {
      await transitionOrder(
        String(admin._id),
        { _id: o.id },
        { status: 'shipped', tracking: { carrier: 'Demo Parcel', number: `DEMO-${i + 1}` } },
        deps,
      );
      if (i >= 43)
        await transitionOrder(String(admin._id), { _id: o.id }, { status: 'completed' }, deps);
    }
    if (i >= 108 && i < 115)
      await transitionOrder(String(admin._id), { _id: o.id }, { status: 'cancelled' }, deps);
    if (i >= 115) {
      await transitionOrder(
        String(admin._id),
        { _id: o.id },
        { status: 'shipped', tracking: { carrier: 'Demo Parcel', number: `DEMO-REFUND-${i}` } },
        deps,
      );
      await transitionOrder(
        String(admin._id),
        { _id: o.id },
        { status: 'refunded', restock: true },
        deps,
      );
    }
    let when = new Date(Date.now() - ((i * 17) % 90) * 86400000 - (i % 8) * 3600000);
    if (when.getUTCDay() === 0 || when.getUTCDay() === 6)
      when = new Date(when.getTime() - 86400000);
    await OrderModel.updateOne(
      { _id: o.id },
      { $set: { createdAt: when, updatedAt: when } },
      { timestamps: false, overwriteImmutable: true },
    );
    const stored = await OrderModel.findById(o.id).orFail();
    stored.statusHistory.forEach((h, n) => (h.at = new Date(when.getTime() + n * 3600000)));
    if (stored.payment.paidAt) stored.payment.paidAt = when;
    if (stored.tracking) stored.tracking.shippedAt = new Date(when.getTime() + 3600000);
    await stored.save({ timestamps: false });
    await StockMovementModel.updateMany(
      { order: o.id },
      { $set: { createdAt: when } },
      { timestamps: false, overwriteImmutable: true },
    );
  }
  // Reconcile date-derived customer statistics after backdating demo orders.
  for (const user of users) {
    const orders = await OrderModel.find({ user: user._id, status: { $ne: 'cancelled' } })
      .select('totals.total createdAt')
      .sort({ createdAt: -1 })
      .lean();
    await UserModel.updateOne(
      { _id: user._id },
      {
        $set: {
          'stats.orderCount': orders.length,
          'stats.totalSpent': orders.reduce((s, o) => s + o.totals.total, 0),
          ...(orders[0] ? { 'stats.lastOrderAt': orders[0].createdAt } : {}),
        },
      },
    );
  }
}
