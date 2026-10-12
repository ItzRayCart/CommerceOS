import type { PipelineStage } from 'mongoose';
import type {
  RevenuePoint,
  ProductMetric,
  NamedMetric,
  CustomerMetrics,
  DiscountMetric,
  Metric,
  DashboardSummary,
} from '@commerceos/shared';
import { OrderModel } from '@api/modules/orders/orders.model.js';
import { UserModel } from '@api/modules/users/users.model.js';
import { ProductModel } from '@api/modules/catalog/product.model.js';
import { RedemptionModel } from '@api/modules/cart/discount.model.js';
import type { AnalyticsQuery } from './admin.schemas.js';
import { listInventory } from './catalogue-admin.service.js';
import { listAdminOrders } from './sales-admin.service.js';
const PAID_STATUSES = ['paid', 'shipped', 'completed'];
export function dates(q: Pick<AnalyticsQuery, 'from' | 'to'>) {
  return { from: q.from ?? new Date(Date.now() - 30 * 86400000), to: q.to ?? new Date() };
}
export async function revenue(q: AnalyticsQuery): Promise<RevenuePoint[]> {
  const { from, to } = dates(q);
  return OrderModel.aggregate<RevenuePoint>([
    { $match: { createdAt: { $gte: from, $lte: to }, status: { $in: PAID_STATUSES } } },
    {
      $group: {
        _id: { $dateTrunc: { date: '$createdAt', unit: q.granularity, timezone: 'UTC' } },
        revenue: { $sum: '$totals.total' },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        _id: 0,
        date: { $dateToString: { date: '$_id', format: '%Y-%m-%d' } },
        revenue: 1,
        orders: 1,
        aov: { $round: [{ $divide: ['$revenue', '$orders'] }, 0] },
      },
    },
  ]);
}
export function salesMatch(q: Pick<AnalyticsQuery, 'from' | 'to'>): PipelineStage.Match {
  const { from, to } = dates(q);
  return { $match: { createdAt: { $gte: from, $lte: to }, status: { $in: PAID_STATUSES } } };
}
export async function topProducts(q: AnalyticsQuery): Promise<ProductMetric[]> {
  return OrderModel.aggregate<ProductMetric>([
    salesMatch(q),
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.product',
        name: { $first: '$items.name' },
        revenue: { $sum: '$items.lineTotal' },
        units: { $sum: '$items.quantity' },
      },
    },
    { $sort: { [q.sort]: -1, _id: 1 } },
    { $project: { _id: 0, productId: { $toString: '$_id' }, name: 1, revenue: 1, units: 1 } },
  ]);
}
export async function categories(q: AnalyticsQuery): Promise<NamedMetric[]> {
  return OrderModel.aggregate<NamedMetric>([
    salesMatch(q),
    { $unwind: '$items' },
    {
      $lookup: {
        from: 'products',
        localField: 'items.product',
        foreignField: '_id',
        as: 'product',
      },
    },
    { $unwind: '$product' },
    {
      $lookup: {
        from: 'categories',
        localField: 'product.category',
        foreignField: '_id',
        as: 'category',
      },
    },
    { $unwind: '$category' },
    {
      $group: {
        _id: '$category._id',
        name: { $first: '$category.name' },
        revenue: { $sum: '$items.lineTotal' },
        units: { $sum: '$items.quantity' },
      },
    },
    { $sort: { revenue: -1, _id: 1 } },
    { $project: { _id: 0, name: 1, revenue: 1, units: 1 } },
  ]);
}
export async function customerMetrics(q: AnalyticsQuery): Promise<CustomerMetrics> {
  const { from, to } = dates(q);
  const newCustomers = await UserModel.countDocuments({
    role: 'customer',
    createdAt: { $gte: from, $lte: to },
  });
  const returning = await OrderModel.aggregate<{ count: number }>([
    salesMatch(q),
    {
      $lookup: {
        from: 'orders',
        let: { buyer: '$user', at: '$createdAt' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$user', '$$buyer'] },
                  { $lt: ['$createdAt', from] },
                  { $in: ['$status', PAID_STATUSES] },
                ],
              },
            },
          },
          { $limit: 1 },
        ],
        as: 'previous',
      },
    },
    { $match: { 'previous.0': { $exists: true } } },
    { $group: { _id: '$user' } },
    { $count: 'count' },
  ]);
  const series = await UserModel.aggregate<{ date: string; count: number }>([
    { $match: { role: 'customer', createdAt: { $gte: from, $lte: to } } },
    {
      $group: {
        _id: { $dateTrunc: { date: '$createdAt', unit: q.granularity, timezone: 'UTC' } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: { _id: 0, date: { $dateToString: { date: '$_id', format: '%Y-%m-%d' } }, count: 1 },
    },
  ]);
  return { newCustomers, returningCustomers: returning[0]?.count ?? 0, series };
}
export async function discountMetrics(q: AnalyticsQuery): Promise<DiscountMetric[]> {
  const { from, to } = dates(q);
  return RedemptionModel.aggregate<DiscountMetric>([
    { $match: { at: { $gte: from, $lte: to } } },
    { $group: { _id: '$code', redemptions: { $sum: 1 }, discounted: { $sum: '$amount' } } },
    { $sort: { discounted: -1, _id: 1 } },
    { $project: { _id: 0, code: '$_id', redemptions: 1, discounted: 1 } },
  ]);
}
async function period(from: Date, to: Date) {
  const [paid] = await OrderModel.aggregate<{ revenue: number; orders: number }>([
    { $match: { createdAt: { $gte: from, $lt: to }, status: { $in: PAID_STATUSES } } },
    { $group: { _id: null, revenue: { $sum: '$totals.total' }, orders: { $sum: 1 } } },
  ]);
  const orders = await OrderModel.countDocuments({ createdAt: { $gte: from, $lt: to } });
  const customers = await UserModel.countDocuments({
    role: 'customer',
    createdAt: { $gte: from, $lt: to },
  });
  return {
    revenue: paid?.revenue ?? 0,
    orders,
    customers,
    aov: paid?.orders ? Math.round(paid.revenue / paid.orders) : 0,
  };
}
export function metric(value: number, previous: number): Metric {
  return {
    value,
    previous,
    delta: previous === 0 ? null : Math.round(((value - previous) * 10000) / previous) / 100,
  };
}
export async function dashboard(
  range: 'today' | '7d' | '30d',
  chartDays: 30 | 90,
): Promise<DashboardSummary> {
  const now = new Date();
  const start =
    range === 'today'
      ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
      : new Date(now.getTime() - (range === '7d' ? 7 : 30) * 86400000);
  const previous = new Date(start.getTime() - (now.getTime() - start.getTime()));
  const query: AnalyticsQuery = {
    from: new Date(now.getTime() - chartDays * 86400000),
    to: now,
    granularity: 'day',
    sort: 'revenue',
    page: 1,
    limit: 100,
  };
  const [current, prior, statusCounts, revenueSeries, products, low, recent, inv] =
    await Promise.all([
      period(start, now),
      period(previous, start),
      OrderModel.aggregate<{ status: string; count: number }>([
        { $match: { createdAt: { $gte: start, $lte: now } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $project: { _id: 0, status: '$_id', count: 1 } },
      ]),
      revenue(query),
      topProducts(query),
      listInventory({ page: 1, limit: 10, low: 'true' }),
      listAdminOrders({ page: 1, limit: 5, sort: '-createdAt' }),
      ProductModel.aggregate<{ totalSkus: number; out: number; low: number; value: number }>([
        { $unwind: '$variants' },
        {
          $group: {
            _id: null,
            totalSkus: { $sum: 1 },
            out: { $sum: { $cond: [{ $eq: ['$variants.stock', 0] }, 1, 0] } },
            low: {
              $sum: { $cond: [{ $lte: ['$variants.stock', '$variants.lowStockThreshold'] }, 1, 0] },
            },
            value: { $sum: { $multiply: ['$variants.stock', '$variants.price'] } },
          },
        },
        { $project: { _id: 0 } },
      ]),
    ]);
  return {
    revenue: metric(current.revenue, prior.revenue),
    orders: metric(current.orders, prior.orders),
    customers: metric(current.customers, prior.customers),
    aov: metric(current.aov, prior.aov),
    statusCounts,
    revenueSeries,
    topProducts: products.slice(0, 5),
    lowStock: low.data,
    recentOrders: recent.data,
    inventory: inv[0] ?? { totalSkus: 0, out: 0, low: 0, value: 0 },
  };
}
export function csvCell(value: unknown): string {
  let s =
    typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
      ? String(value)
      : '';
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}
export function csvRow(values: unknown[]): string {
  return values.map(csvCell).join(',') + '\r\n';
}
