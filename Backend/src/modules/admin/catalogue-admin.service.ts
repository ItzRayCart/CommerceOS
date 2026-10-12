import mongoose from 'mongoose';
import sanitizeHtml from 'sanitize-html';
import { ProductModel } from '@api/modules/catalog/product.model.js';
import { CategoryModel } from '@api/modules/catalog/category.model.js';
import { SettingsModel } from '@api/modules/settings/settings.model.js';
import { OrderModel, StockMovementModel } from '@api/modules/orders/orders.model.js';
import { orderTransaction } from '@api/modules/orders/orders.service.js';
import { ConflictError, NotFoundError, ValidationError } from '@api/common/errors/app-error.js';
import { paginate } from '@api/common/utils/pagination.js';
import { adminProductDto } from './admin.mapper.js';
import type { ProductInput, ListQuery } from './admin.schemas.js';
export function slugify(name: string): string {
  return (
    name
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'product'
  );
}
export function validateMatrix(input: ProductInput): void {
  const names = input.optionDefinitions.map((o) => o.name);
  if (new Set(names).size !== names.length)
    throw new ValidationError([
      { path: 'optionDefinitions', message: 'Option names must be unique' },
    ]);
  const combinations = new Set<string>();
  const skus = new Set<string>();
  for (const [i, v] of input.variants.entries()) {
    if (skus.has(v.sku)) throw new ConflictError('SKU must be unique', 'variants.' + i + '.sku');
    skus.add(v.sku);
    if (
      Object.keys(v.options).length !== names.length ||
      input.optionDefinitions.some((o) => !o.values.includes(v.options[o.name] ?? ''))
    )
      throw new ValidationError([
        {
          path: `variants.${i}.options`,
          message: 'Variant options must match the option definitions',
        },
      ]);
    const key = JSON.stringify(Object.entries(v.options).sort());
    if (combinations.has(key))
      throw new ValidationError([
        { path: `variants.${i}.options`, message: 'Variant combination already exists' },
      ]);
    combinations.add(key);
    if (v.compareAtPrice !== undefined && v.compareAtPrice <= v.price)
      throw new ValidationError([
        { path: `variants.${i}.compareAtPrice`, message: 'Compare-at price must exceed price' },
      ]);
  }
  if (input.optionDefinitions.some((o) => new Set(o.values).size !== o.values.length))
    throw new ValidationError([
      { path: 'optionDefinitions', message: 'Option values must be unique' },
    ]);
  if (
    input.status === 'active' &&
    (!input.images.length ||
      input.images.filter((i) => i.isPrimary).length !== 1 ||
      !input.variants.some((v) => v.isActive))
  )
    throw new ValidationError([
      {
        path: 'images',
        message: 'Publishing requires images, exactly one primary image and an active variant',
      },
    ]);
  if (input.images.length && input.images.filter((i) => i.isPrimary).length !== 1)
    throw new ValidationError([{ path: 'images', message: 'Choose exactly one primary image' }]);
}
export async function listAdminProducts(q: ListQuery) {
  const filter: mongoose.FilterQuery<mongoose.InferSchemaType<typeof ProductModel.schema>> = {};
  if (q.q) filter.$text = { $search: q.q };
  if (q.status) filter.status = q.status;
  if (q.category) filter.category = q.category;
  if (q.stock === 'out') filter.totalStock = 0;
  if (q.stock === 'low')
    filter.$expr = {
      $anyElementTrue: {
        $map: { input: '$variants', as: 'v', in: { $lte: ['$$v.stock', '$$v.lowStockThreshold'] } },
      },
    };
  const [products, total] = await Promise.all([
    ProductModel.find(filter)
      .sort(q.sort)
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .lean(),
    ProductModel.countDocuments(filter),
  ]);
  return { data: products.map(adminProductDto), meta: paginate(q.page, q.limit, total) };
}
export async function getAdminProduct(id: string) {
  const p = await ProductModel.findById(id).lean();
  if (!p) throw new NotFoundError('Product not found');
  return adminProductDto(p);
}
export async function saveProduct(
  actor: string,
  input: ProductInput,
  id?: string,
  expectedUpdatedAt?: string,
) {
  validateMatrix(input);
  return orderTransaction(async (session) => {
    const settings = await SettingsModel.findOne({ key: 'store' }).session(session).lean();
    if (!settings) throw new NotFoundError('Store settings not found');
    const category = await CategoryModel.findById(input.category).session(session);
    if (!category) throw new NotFoundError('Category not found');
    // This write also serializes category deletion with assignment/publication.
    await CategoryModel.updateOne({ _id: category._id }, { $inc: { __v: 1 } }, { session });
    const p = id ? await ProductModel.findById(id).session(session) : new ProductModel();
    if (!p) throw new NotFoundError('Product not found');
    if (id && expectedUpdatedAt && p.updatedAt.toISOString() !== expectedUpdatedAt)
      throw new ConflictError(
        'This product changed while you were editing it. Reload before saving.',
        'variants',
      );
    const previous = p.variants.map((v) => ({ id: String(v._id), stock: v.stock, sku: v.sku }));
    const incoming = new Set(input.variants.flatMap((v) => (v.id ? [v.id] : [])));
    if (id && previous.some((v) => !incoming.has(v.id)))
      throw new ConflictError(
        'Existing variants cannot be removed; deactivate them to preserve order and audit references',
        'variants',
      );
    for (const v of input.variants)
      if (v.id && !previous.some((old) => old.id === v.id))
        throw new ValidationError([{ path: 'variants', message: 'Unknown variant identifier' }]);
    let resolvedSlug = input.slug ?? (id ? p.slug : slugify(input.name));
    if (!id && !input.slug) {
      const base = resolvedSlug;
      let suffix = 2;
      while (await ProductModel.exists({ slug: resolvedSlug }).session(session))
        resolvedSlug = `${base}-${suffix++}`;
    }
    const description = sanitizeHtml(input.description, {
      allowedTags: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'h2', 'h3', 'a'],
      allowedAttributes: { a: ['href'] },
      allowedSchemes: ['https', 'http', 'mailto'],
    });
    if (!description.trim())
      throw new ValidationError([{ path: 'description', message: 'Enter a description' }]);
    p.set({
      name: input.name,
      slug: resolvedSlug,
      description,
      brand: input.brand || settings.store.name,
      category: category._id,
      tags: input.tags,
      images: input.images,
      specs: input.specs,
      optionDefinitions: input.optionDefinitions,
      seo: input.seo,
      status: input.status,
      isFeatured: input.isFeatured,
      variants: input.variants.map((v) => ({
        _id: v.id ? new mongoose.Types.ObjectId(v.id) : new mongoose.Types.ObjectId(),
        sku: v.sku,
        options: v.options,
        price: v.price,
        ...(v.compareAtPrice === undefined ? {} : { compareAtPrice: v.compareAtPrice }),
        stock: v.stock,
        lowStockThreshold: v.lowStockThreshold ?? settings.inventory.lowStockThreshold,
        isActive: v.isActive,
        images: v.images,
        ...(v.weightGrams === undefined ? {} : { weightGrams: v.weightGrams }),
      })),
    });
    await p.save({ session });
    const movements = p.variants.flatMap((v) => {
      const old = previous.find((o) => o.id === String(v._id));
      const delta = v.stock - (old?.stock ?? 0);
      return delta
        ? [
            {
              product: p._id,
              variantId: v._id,
              sku: v.sku,
              delta,
              stockAfter: v.stock,
              reason: 'manual_adjustment',
              by: actor,
              note: id ? 'Product editor stock change' : 'Initial product stock',
            },
          ]
        : [];
    });
    if (movements.length) await StockMovementModel.create(movements, { session, ordered: true });
    return adminProductDto(p);
  });
}
export async function deleteProduct(id: string) {
  await orderTransaction(async (session) => {
    const p = await ProductModel.findById(id).session(session);
    if (!p) throw new NotFoundError('Product not found');
    await ProductModel.updateOne({ _id: id }, { $inc: { __v: 1 } }, { session });
    if (await OrderModel.exists({ 'items.product': id }).session(session))
      throw new ConflictError('This product has orders. Archive it instead.', 'status');
    await ProductModel.deleteOne({ _id: id }, { session });
  });
}
export async function duplicateProduct(actor: string, id: string) {
  const p = await getAdminProduct(id);
  const {
    id: ignored,
    slug: ignoredSlug,
    minPrice: ignoredPrice,
    totalStock: ignoredStock,
    createdAt: ignoredCreated,
    updatedAt: ignoredUpdated,
    ...editable
  } = p;
  void [ignored, ignoredSlug, ignoredPrice, ignoredStock, ignoredCreated, ignoredUpdated];
  return saveProduct(actor, {
    ...editable,
    name: `${p.name} copy`,
    status: 'draft',
    variants: p.variants.map((v, i) => ({
      ...v,
      id: undefined,
      sku: `COPY-${new mongoose.Types.ObjectId().toString().toUpperCase()}-${i}`,
      stock: 0,
    })),
    brand: p.brand,
  });
}
export { escapeRegex } from './admin-utils.js';
export { adjustStock, listInventory, listMovements } from './inventory-admin.service.js';
export {
  listAdminCategories,
  getAdminCategory,
  saveCategory,
  deleteCategory,
} from './category-admin.service.js';
