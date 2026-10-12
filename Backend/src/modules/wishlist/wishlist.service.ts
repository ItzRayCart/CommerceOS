import { AppError, NotFoundError } from '@api/common/errors/app-error.js';
import { CategoryModel } from '@api/modules/catalog/category.model.js';
import { ProductModel } from '@api/modules/catalog/product.model.js';
import { productSummaryDto } from '@api/modules/catalog/catalog.mapper.js';
import { WishlistModel } from '@api/modules/wishlist/wishlist.model.js';

export async function listWishlist(user: string, page: number, limit: number) {
  const wishlist = await WishlistModel.findOne({ user }).lean();
  const active = await CategoryModel.find({ isActive: true }).lean();
  const categories = active.filter(
    (category) => !category.parent || active.some((parent) => parent._id.equals(category.parent)),
  );
  const filter = {
    _id: { $in: wishlist?.products ?? [] },
    status: 'active',
    category: { $in: categories.map((c) => c._id) },
  };
  const [products, total] = await Promise.all([
    ProductModel.find(filter)
      .sort({ _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    ProductModel.countDocuments(filter),
  ]);
  return {
    data: products.flatMap((product) => {
      const category = categories.find((c) => c._id.equals(product.category));
      return category ? [productSummaryDto(product, category)] : [];
    }),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  };
}

export async function addWishlist(user: string, productId: string) {
  const product = await ProductModel.findOne({ _id: productId, status: 'active' }).lean();
  const category = product
    ? await CategoryModel.findOne({ _id: product.category, isActive: true }).lean()
    : null;
  if (
    !product ||
    !category ||
    (category.parent && !(await CategoryModel.exists({ _id: category.parent, isActive: true })))
  )
    throw new NotFoundError('Product is unavailable');
  await WishlistModel.updateOne({ user }, { $setOnInsert: { products: [] } }, { upsert: true });
  const result = await WishlistModel.updateOne(
    { user, $or: [{ products: productId }, { 'products.199': { $exists: false } }] },
    { $addToSet: { products: productId } },
  );
  if (!result.matchedCount)
    throw new AppError(
      422,
      'WISHLIST_FULL',
      'Your wishlist is full. Remove an item before saving another.',
    );
}

export async function removeWishlist(user: string, productId: string) {
  await WishlistModel.updateOne({ user }, { $pull: { products: productId } });
}
