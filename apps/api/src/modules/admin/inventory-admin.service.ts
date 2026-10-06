import { ProductModel } from '@api/modules/catalog/product.model.js';
import { StockMovementModel } from '@api/modules/orders/orders.model.js';
import { orderTransaction } from '@api/modules/orders/orders.service.js';
import { AppError, NotFoundError } from '@api/common/errors/app-error.js';
import { paginate } from '@api/common/utils/pagination.js';
import { adminProductDto, movementDto } from './admin.mapper.js';
import type { InventoryQuery } from './admin.schemas.js';
import { escapeRegex } from './admin-utils.js';
export async function adjustStock(
  actor: string,
  id: string,
  vid: string,
  input: { delta: number; reason: 'manual_adjustment' | 'restock'; note: string },
) {
  return orderTransaction(async (session) => {
    const p = await ProductModel.findOneAndUpdate(
      {
        _id: id,
        variants: {
          $elemMatch: {
            _id: vid,
            stock: { $gte: Math.max(0, -input.delta), $lte: 1_000_000 - Math.max(0, input.delta) },
          },
        },
      },
      { $inc: { 'variants.$.stock': input.delta, totalStock: input.delta, __v: 1 } },
      { new: true, session },
    ).lean();
    if (!p) {
      if (!(await ProductModel.exists({ _id: id, 'variants._id': vid }).session(session)))
        throw new NotFoundError('Variant not found');
      throw new AppError(409, 'INSUFFICIENT_STOCK', 'The adjustment would make stock invalid.');
    }
    const v = p.variants.find((v) => String(v._id) === vid);
    if (!v) throw new NotFoundError('Variant not found');
    await StockMovementModel.create(
      [
        {
          product: p._id,
          variantId: v._id,
          sku: v.sku,
          delta: input.delta,
          stockAfter: v.stock,
          reason: input.reason,
          note: input.note,
          by: actor,
        },
      ],
      { session },
    );
    return adminProductDto(p);
  });
}
export async function listInventory(q: InventoryQuery) {
  const match: Record<string, unknown> = {};
  if (q.low === 'true') match.$expr = { $lte: ['$variants.stock', '$variants.lowStockThreshold'] };
  if (q.out === 'true') match['variants.stock'] = 0;
  if (q.q)
    match.$or = [
      { name: { $regex: escapeRegex(q.q), $options: 'i' } },
      { 'variants.sku': { $regex: escapeRegex(q.q), $options: 'i' } },
    ];
  const [result] = await ProductModel.aggregate<{
    data: {
      productId: string;
      name: string;
      variantId: string;
      sku: string;
      stock: number;
      lowStockThreshold: number;
      price: number;
      isActive: boolean;
    }[];
    total: { count: number }[];
  }>([
    { $unwind: '$variants' },
    { $match: match },
    { $sort: { 'variants.stock': 1, 'variants.sku': 1 } },
    {
      $facet: {
        data: [
          { $skip: (q.page - 1) * q.limit },
          { $limit: q.limit },
          {
            $project: {
              _id: 0,
              productId: { $toString: '$_id' },
              name: 1,
              variantId: { $toString: '$variants._id' },
              sku: '$variants.sku',
              stock: '$variants.stock',
              lowStockThreshold: '$variants.lowStockThreshold',
              price: '$variants.price',
              isActive: '$variants.isActive',
            },
          },
        ],
        total: [{ $count: 'count' }],
      },
    },
  ]);
  return {
    data: result?.data ?? [],
    meta: paginate(q.page, q.limit, result?.total[0]?.count ?? 0),
  };
}
export async function listMovements(q: InventoryQuery) {
  const f = q.variantId ? { variantId: q.variantId } : {};
  const [rows, total] = await Promise.all([
    StockMovementModel.find(f)
      .sort({ createdAt: -1, _id: -1 })
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .lean(),
    StockMovementModel.countDocuments(f),
  ]);
  return { data: rows.map(movementDto), meta: paginate(q.page, q.limit, total) };
}
