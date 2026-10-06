import type mongoose from 'mongoose';
import { Role, type AdminOrder } from '@commerceos/shared';
import { UserModel } from '@api/modules/users/users.model.js';
import { OrderModel, orderDto } from '@api/modules/orders/orders.model.js';
import { orderTransaction } from '@api/modules/orders/orders.service.js';
import { DiscountModel, RedemptionModel } from '@api/modules/cart/discount.model.js';
import { SettingsModel } from '@api/modules/settings/settings.model.js';
import { CategoryModel } from '@api/modules/catalog/category.model.js';
import { ProductModel } from '@api/modules/catalog/product.model.js';
import { ConflictError, NotFoundError } from '@api/common/errors/app-error.js';
import { paginate } from '@api/common/utils/pagination.js';
import { adminCustomerDto, adminDiscountDto, adminSettingsDto } from './admin.mapper.js';
import { escapeRegex } from './catalogue-admin.service.js';
import type { DiscountInput, ListQuery, OrderListQuery } from './admin.schemas.js';
import type { AdminSettings } from '@commerceos/shared';
export async function orderFilter(q: OrderListQuery) {
  const filter: mongoose.FilterQuery<mongoose.InferSchemaType<typeof OrderModel.schema>> = {};
  if (q.status) filter.status = q.status;
  if (q.from || q.to)
    filter.createdAt = { ...(q.from ? { $gte: q.from } : {}), ...(q.to ? { $lte: q.to } : {}) };
  if (q.q) {
    const users = await UserModel.find({ email: { $regex: escapeRegex(q.q), $options: 'i' } })
      .select('_id')
      .lean();
    filter.$or = [
      { orderNumber: { $regex: escapeRegex(q.q), $options: 'i' } },
      { user: { $in: users.map((u) => u._id) } },
    ];
  }
  return filter;
}
export async function adminOrder(id: string): Promise<AdminOrder> {
  const order = await OrderModel.findById(id).lean();
  if (!order) throw new NotFoundError('Order not found');
  const user = await UserModel.findById(order.user).lean();
  if (!user) throw new NotFoundError('Customer not found');
  return {
    ...orderDto(order),
    customer: {
      id: String(user._id),
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
    },
    internalNotes: order.internalNotes.map((n) => ({
      text: n.text,
      by: String(n.by),
      at: n.at.toISOString(),
    })),
  };
}
export async function listAdminOrders(q: OrderListQuery) {
  const filter = await orderFilter(q);
  const base = { ...filter };
  delete base.status;
  const [rows, total, counts] = await Promise.all([
    OrderModel.find(filter)
      .sort(q.sort)
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .lean(),
    OrderModel.countDocuments(filter),
    OrderModel.aggregate<{ _id: string; count: number }>([
      { $match: base },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
  ]);
  const users = await UserModel.find({ _id: { $in: rows.map((o) => o.user) } })
    .select('email firstName lastName')
    .lean();
  return {
    data: rows.map((o) => {
      const u = users.find((u) => u._id.equals(o.user));
      return {
        ...orderDto(o),
        customer: {
          id: String(o.user),
          email: u?.email ?? '',
          name: u ? `${u.firstName} ${u.lastName}` : 'Unavailable customer',
        },
        internalNotes: o.internalNotes.map((n) => ({
          text: n.text,
          by: String(n.by),
          at: n.at.toISOString(),
        })),
      };
    }),
    meta: {
      ...paginate(q.page, q.limit, total),
      statusCounts: Object.fromEntries(counts.map((c) => [c._id, c.count])),
    },
  };
}
export async function addOrderNote(actor: string, id: string, text: string) {
  const result = await OrderModel.updateOne(
    { _id: id },
    { $push: { internalNotes: { text, by: actor, at: new Date() } } },
  );
  if (!result.matchedCount) throw new NotFoundError('Order not found');
  return adminOrder(id);
}
export async function listCustomers(q: ListQuery) {
  const filter: mongoose.FilterQuery<mongoose.InferSchemaType<typeof UserModel.schema>> = {};
  if (q.q) {
    const regex = { $regex: escapeRegex(q.q), $options: 'i' };
    filter.$or = [{ email: regex }, { firstName: regex }, { lastName: regex }];
  }
  if (q.status) filter.status = q.status;
  const field = q.sort.replace(/^-/, '');
  const sortField =
    field === 'joined'
      ? 'createdAt'
      : field === 'orders'
        ? 'stats.orderCount'
        : field === 'spent'
          ? 'stats.totalSpent'
          : field === 'name'
            ? 'firstName'
            : 'createdAt';
  const [rows, total] = await Promise.all([
    UserModel.find(filter)
      .sort({ [sortField]: q.sort.startsWith('-') ? -1 : 1, _id: 1 })
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .lean(),
    UserModel.countDocuments(filter),
  ]);
  return { data: rows.map(adminCustomerDto), meta: paginate(q.page, q.limit, total) };
}
export async function getCustomer(id: string) {
  const user = await UserModel.findById(id).lean();
  if (!user) throw new NotFoundError('Customer not found');
  const [sum] = await OrderModel.aggregate<{ value: number }>([
    { $match: { user: user._id, status: { $ne: 'cancelled' } } },
    { $group: { _id: null, value: { $sum: '$totals.total' } } },
  ]);
  return { ...adminCustomerDto(user), lifetimeValue: sum?.value ?? 0 };
}
export async function updateCustomer(
  actor: string,
  id: string,
  input: { role?: 'admin' | 'customer' | undefined; status?: 'active' | 'disabled' | undefined },
) {
  await orderTransaction(async (session) => {
    // Lock all active admins together, preventing two simultaneous last-admin removals.
    await UserModel.updateMany(
      { role: 'admin', status: 'active' },
      { $inc: { __v: 1 } },
      { session },
    );
    const user = await UserModel.findById(id).session(session);
    if (!user) throw new NotFoundError('Customer not found');
    const removesAdmin = input.role === 'customer' || input.status === 'disabled';
    if (actor === id && removesAdmin)
      throw new ConflictError('You cannot demote or disable your own account', 'role');
    if (
      user.role === Role.Admin &&
      user.status === 'active' &&
      removesAdmin &&
      (await UserModel.countDocuments({ role: 'admin', status: 'active' }).session(session)) <= 1
    )
      throw new ConflictError('Keep at least one active administrator', 'role');
    if (input.role) user.role = input.role === 'admin' ? Role.Admin : Role.Customer;
    if (input.status) user.status = input.status;
    await user.save({ session });
  });
  return getCustomer(id);
}
function computedDiscountStatus() {
  const now = new Date();
  return {
    $switch: {
      branches: [
        { case: { $eq: ['$isActive', false] }, then: 'disabled' },
        { case: { $gt: ['$startsAt', now] }, then: 'scheduled' },
        {
          case: { $lt: [{ $ifNull: ['$expiresAt', new Date('9999-01-01')] }, now] },
          then: 'expired',
        },
        {
          case: {
            $and: [
              { $ne: [{ $ifNull: ['$usageLimit', null] }, null] },
              { $gte: ['$usedCount', '$usageLimit'] },
            ],
          },
          then: 'exhausted',
        },
      ],
      default: 'active',
    },
  };
}
export async function listDiscounts(q: ListQuery) {
  const match: Record<string, unknown> = {};
  if (q.status) match.computedStatus = q.status;
  if (q.q) match.code = { $regex: escapeRegex(q.q), $options: 'i' };
  const [result] = await DiscountModel.aggregate<{
    data: (mongoose.InferSchemaType<typeof DiscountModel.schema> & {
      _id: mongoose.Types.ObjectId;
    })[];
    total: { count: number }[];
  }>([
    { $addFields: { computedStatus: computedDiscountStatus() } },
    { $match: match },
    { $sort: { code: 1 } },
    {
      $facet: {
        data: [{ $skip: (q.page - 1) * q.limit }, { $limit: q.limit }],
        total: [{ $count: 'count' }],
      },
    },
  ]);
  return {
    data: (result?.data ?? []).map(adminDiscountDto),
    meta: paginate(q.page, q.limit, result?.total[0]?.count ?? 0),
  };
}
export async function getDiscount(id: string) {
  const d = await DiscountModel.findById(id).lean();
  if (!d) throw new NotFoundError('Discount not found');
  const [stats] = await RedemptionModel.aggregate<{ count: number; amount: number }>([
    { $match: { code: d.code } },
    { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$amount' } } },
  ]);
  return { ...adminDiscountDto(d), redemptions: stats?.count ?? 0, discounted: stats?.amount ?? 0 };
}
export async function saveDiscount(input: DiscountInput, id?: string) {
  return orderTransaction(async (session) => {
    const d = id ? await DiscountModel.findById(id).session(session) : new DiscountModel();
    if (!d) throw new NotFoundError('Discount not found');
    if (!id && (await RedemptionModel.exists({ code: input.code }).session(session)))
      throw new ConflictError('This code has historical redemptions. Choose a new code.', 'code');
    if (id && input.code !== d.code)
      throw new ConflictError('A discount code is immutable; create a new code', 'code');
    if (input.usageLimit !== undefined && input.usageLimit < d.usedCount)
      throw new ConflictError('Usage limit cannot be below existing redemptions', 'usageLimit');
    if (
      (await CategoryModel.countDocuments({ _id: { $in: input.appliesTo.categories } }).session(
        session,
      )) !== new Set(input.appliesTo.categories).size ||
      (await ProductModel.countDocuments({ _id: { $in: input.appliesTo.products } }).session(
        session,
      )) !== new Set(input.appliesTo.products).size
    )
      throw new NotFoundError('Discount scope not found');
    d.set({
      code: input.code,
      description: input.description,
      type: input.type,
      value: input.value,
      minSubtotal: input.minSubtotal,
      maxDiscount: input.maxDiscount,
      startsAt: input.startsAt,
      expiresAt: input.expiresAt,
      usageLimit: input.usageLimit,
      perUserLimit: input.perUserLimit,
      appliesTo: input.appliesTo,
      isActive: input.isActive,
    });
    await d.save({ session });
    return adminDiscountDto(d);
  });
}
export async function deleteDiscount(id: string) {
  const d = await DiscountModel.findByIdAndDelete(id);
  if (!d) throw new NotFoundError('Discount not found');
}
export async function getSettings() {
  const s = await SettingsModel.findOne({ key: 'store' }).lean();
  if (!s) throw new NotFoundError('Store settings not found');
  return adminSettingsDto(s);
}
export async function saveSettings(input: AdminSettings) {
  const s = await SettingsModel.findOneAndUpdate(
    { key: 'store' },
    {
      $set: {
        store: input.store,
        currency: input.currency,
        tax: input.tax,
        shipping: input.shipping,
        inventory: input.inventory,
        theme: input.theme,
        features: input.features,
        orderNumberPrefix: input.orderNumberPrefix,
      },
      $inc: { __v: 1 },
    },
    { new: true, runValidators: true },
  ).lean();
  if (!s) throw new NotFoundError('Store settings not found');
  return adminSettingsDto(s);
}
