import type { FilterQuery, SortOrder, Types } from 'mongoose';
import { NotFoundError } from '@api/common/errors/app-error.js';
import { paginate } from '@api/common/utils/pagination.js';
import { CategoryModel } from '@api/modules/catalog/category.model.js';
import {
  categoryDto,
  productDetailDto,
  productSummaryDto,
} from '@api/modules/catalog/catalog.mapper.js';
import type { CatalogCategory } from '@api/modules/catalog/catalog.mapper.js';
import type { ProductQuery } from '@api/modules/catalog/catalog.schemas.js';
import { ProductModel } from '@api/modules/catalog/product.model.js';
import type { Product } from '@api/modules/catalog/product.model.js';
import { SettingsModel } from '@api/modules/settings/settings.model.js';

async function activeCategories(): Promise<CatalogCategory[]> {
  const categories = await CategoryModel.find({ isActive: true })
    .sort({ sortOrder: 1, name: 1 })
    .lean();
  return categories.filter(
    (category) =>
      !category.parent || categories.some((parent) => parent._id.equals(category.parent)),
  );
}

function categoryIndex(categories: CatalogCategory[]) {
  return new Map(categories.map((category) => [category._id.toString(), category]));
}

export async function getPublicSettings() {
  const settings = await SettingsModel.findOne({ key: 'store' }).lean();
  if (!settings) throw new NotFoundError('Store settings not found');
  return {
    store: {
      name: settings.store.name,
      tagline: settings.store.tagline,
      logoUrl: settings.store.logoUrl,
      supportEmail: settings.store.supportEmail,
      phone: settings.store.phone,
      address: settings.store.address,
      announcement: settings.store.announcement,
      valueProps: (settings.store.valueProps ?? []).map((item) => ({
        title: item.title,
        text: item.text,
      })),
    },
    currency: {
      code: settings.currency.code,
      symbol: settings.currency.symbol,
      decimals: settings.currency.decimals,
    },
    tax: { ratePercent: settings.tax.ratePercent, inclusive: settings.tax.inclusive },
    shipping: {
      methods: settings.shipping.methods
        .filter((method) => method.isActive)
        .map((method) => ({
          code: method.code,
          label: method.label,
          price: method.price,
          ...(method.freeOverSubtotal === undefined
            ? {}
            : { freeOverSubtotal: method.freeOverSubtotal }),
          estimatedDays: method.estimatedDays,
        })),
    },
    inventory: { lowStockThreshold: settings.inventory.lowStockThreshold },
    theme: { primary: settings.theme.primary, accent: settings.theme.accent },
    features: { reviews: settings.features.reviews, wishlist: settings.features.wishlist },
  };
}

export async function listCategories() {
  const categories = await activeCategories();
  const counts = await ProductModel.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { status: 'active', category: { $in: categories.map((item) => item._id) } } },
    { $group: { _id: '$category', count: { $sum: 1 } } },
  ]);
  const byId = new Map(counts.map((item) => [item._id.toString(), item.count]));
  return categories
    .filter((category) => !category.parent)
    .map((category) => {
      const children = categories.filter(
        (child) => child.parent?.toString() === category._id.toString(),
      );
      const count =
        (byId.get(category._id.toString()) ?? 0) +
        children.reduce((sum, child) => sum + (byId.get(child._id.toString()) ?? 0), 0);
      return categoryDto(category, children, count);
    });
}

export async function getCategory(slug: string) {
  const categories = await activeCategories();
  const category = categories.find((item) => item.slug === slug);
  if (!category) throw new NotFoundError('Category not found');
  const children = categories.filter(
    (child) => child.parent?.toString() === category._id.toString(),
  );
  const ids = [category._id, ...children.map((child) => child._id)];
  const productCount = await ProductModel.countDocuments({
    status: 'active',
    category: { $in: ids },
  });
  const parent = category.parent
    ? categories.find((item) => item._id.equals(category.parent))
    : undefined;
  return {
    ...categoryDto(category, children, productCount),
    breadcrumbs: [
      ...(parent ? [{ name: parent.name, slug: parent.slug }] : []),
      { name: category.name, slug: category.slug },
    ],
  };
}

async function productFilter(
  query: ProductQuery,
): Promise<{ filter: FilterQuery<Product>; categories: CatalogCategory[] }> {
  const categories = await activeCategories();
  let allowed = categories;
  if (query.category) {
    const selected = categories.find((item) => item.slug === query.category);
    allowed = selected
      ? categories.filter(
          (item) => item._id.equals(selected._id) || item.parent?.equals(selected._id),
        )
      : [];
  }
  const variant: Record<string, unknown> = { isActive: true };
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    variant['price'] = {
      ...(query.minPrice === undefined ? {} : { $gte: query.minPrice }),
      ...(query.maxPrice === undefined ? {} : { $lte: query.maxPrice }),
    };
  }
  if (query.inStock === true) variant['stock'] = { $gt: 0 };
  for (const [name, value] of Object.entries(query.options ?? {}))
    variant[`options.${name}`] = value;
  const filter: FilterQuery<Product> = {
    status: 'active',
    category: { $in: allowed.map((item) => item._id) },
    variants: { $elemMatch: variant },
    ...(query.q ? { $text: { $search: query.q } } : {}),
    ...(query.rating === undefined ? {} : { ratingAverage: { $gte: query.rating } }),
    ...(query.featured === undefined ? {} : { isFeatured: query.featured }),
    ...(query.tags ? { tags: query.tags.toLowerCase() } : {}),
  };
  return { filter, categories };
}

function sortFor(query: ProductQuery): Record<string, SortOrder | { $meta: 'textScore' }> {
  switch (query.sort ?? (query.q ? 'relevance' : '-createdAt')) {
    case 'relevance':
      return { score: { $meta: 'textScore' } };
    case 'price':
      return { minPrice: 1, _id: 1 };
    case '-price':
      return { minPrice: -1, _id: 1 };
    case '-soldCount':
      return { soldCount: -1, _id: 1 };
    case '-ratingAverage':
      return { ratingAverage: -1, _id: 1 };
    case 'name':
      return { name: 1, _id: 1 };
    default:
      return { createdAt: -1, _id: 1 };
  }
}

export async function listProducts(query: ProductQuery) {
  const { filter, categories } = await productFilter(query);
  const total = await ProductModel.countDocuments(filter);
  const products = await ProductModel.find(filter)
    .sort(sortFor(query))
    .skip((query.page - 1) * query.limit)
    .limit(query.limit)
    .lean();
  const byId = categoryIndex(categories);
  const data = products.flatMap((product) => {
    const category = byId.get(product.category.toString());
    return category ? [productSummaryDto(product, category)] : [];
  });
  const meta = paginate(query.page, query.limit, total);
  if (!query.includeFacets) return { data, meta };
  const matched = await ProductModel.find(filter)
    .select('variants category minPrice maxPrice')
    .lean();
  const optionCounts = new Map<string, Map<string, number>>();
  const categoryCounts = new Map<string, number>();
  for (const product of matched) {
    const categoryId = product.category.toString();
    categoryCounts.set(categoryId, (categoryCounts.get(categoryId) ?? 0) + 1);
    const counted = new Set<string>();
    for (const variant of product.variants.filter((item) => item.isActive)) {
      const options: Record<string, string> = variant.options;
      for (const [name, value] of Object.entries(options)) {
        const values = optionCounts.get(name) ?? new Map<string, number>();
        const key = `${name}:${value}`;
        if (!counted.has(key)) values.set(value, (values.get(value) ?? 0) + 1);
        counted.add(key);
        optionCounts.set(name, values);
      }
    }
  }
  return {
    data,
    meta: {
      ...meta,
      facets: {
        options: Object.fromEntries(
          [...optionCounts].map(([name, values]) => [
            name,
            [...values].map(([value, count]) => ({ value, count })),
          ]),
        ),
        price: {
          min: matched.length ? Math.min(...matched.map((item) => item.minPrice)) : 0,
          max: matched.length ? Math.max(...matched.map((item) => item.maxPrice)) : 0,
        },
        categories: categories
          .map((item) => ({ slug: item.slug, count: categoryCounts.get(item._id.toString()) ?? 0 }))
          .filter((item) => item.count > 0),
      },
    },
  };
}

export async function getProduct(slug: string) {
  const product = await ProductModel.findOne({ slug, status: 'active' }).lean();
  if (!product) throw new NotFoundError('Product not found');
  const category = await CategoryModel.findOne({ _id: product.category, isActive: true }).lean();
  if (
    !category ||
    (category.parent && !(await CategoryModel.exists({ _id: category.parent, isActive: true })))
  )
    throw new NotFoundError('Product not found');
  return productDetailDto(product, category);
}

export async function getRelatedProducts(slug: string) {
  const product = await ProductModel.findOne({ slug, status: 'active' }).lean();
  if (!product) throw new NotFoundError('Product not found');
  const category = await CategoryModel.findOne({ _id: product.category, isActive: true }).lean();
  if (
    !category ||
    (category.parent && !(await CategoryModel.exists({ _id: category.parent, isActive: true })))
  )
    throw new NotFoundError('Product not found');
  const related = await ProductModel.find({
    status: 'active',
    category: category._id,
    _id: { $ne: product._id },
  })
    .sort({ soldCount: -1 })
    .limit(8)
    .lean();
  return related.map((item) => productSummaryDto(item, category));
}

export async function suggestProducts(q: string) {
  const categories = await activeCategories();
  const pattern = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const products = await ProductModel.find({
    status: 'active',
    category: { $in: categories.map((item) => item._id) },
    name: pattern,
  })
    .select('name slug category')
    .limit(6)
    .lean();
  const suggestions: { type: 'product' | 'category'; name: string; slug: string }[] = products.map(
    (item) => ({ type: 'product', name: item.name, slug: item.slug }),
  );
  if (suggestions.length < 6) {
    suggestions.push(
      ...categories
        .filter((item) => pattern.test(item.name))
        .slice(0, 6 - suggestions.length)
        .map((item) => ({ type: 'category' as const, name: item.name, slug: item.slug })),
    );
  }
  return suggestions.slice(0, 6);
}
