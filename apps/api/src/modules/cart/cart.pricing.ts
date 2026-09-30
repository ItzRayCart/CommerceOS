import { createHash } from 'node:crypto';
import { AppError, NotFoundError } from '@api/common/errors/app-error.js';
import { ProductModel } from '@api/modules/catalog/product.model.js';
import { CategoryModel } from '@api/modules/catalog/category.model.js';
import { SettingsModel } from '@api/modules/settings/settings.model.js';
import { DiscountModel, RedemptionModel } from '@api/modules/cart/discount.model.js';
import type { CartInput } from '@api/modules/cart/cart.schemas.js';

const reasons: Record<string, string> = {
  not_found: 'That discount code was not found.',
  inactive: 'This discount code is no longer active.',
  not_started: 'This discount is not available yet.',
  expired: 'This discount code has expired.',
  min_subtotal: 'Your cart has not reached the minimum amount for this code.',
  usage_limit: 'This discount code has reached its usage limit.',
  per_user_limit: 'You have already used this discount code.',
  not_applicable: 'This discount does not apply to the items in your cart.',
};
function invalid(reason: string): never {
  throw new AppError(422, 'DISCOUNT_INVALID', reasons[reason] ?? 'Discount unavailable.', {
    reason,
  });
}
export function priceHash(variantId: string, unitPrice: number): string {
  return createHash('sha256').update(`${variantId}:${unitPrice}`).digest('hex');
}

export async function priceCart(
  items: (CartInput & { id?: string })[],
  code?: string,
  user?: string,
  strictDiscount = false,
) {
  const [products, categories, settings] = await Promise.all([
    ProductModel.find({ _id: { $in: items.map((item) => item.productId) } }).lean(),
    CategoryModel.find({ isActive: true }).lean(),
    SettingsModel.findOne({ key: 'store' }).lean(),
  ]);
  if (!settings) throw new NotFoundError('Store settings unavailable');
  const lines = items.map((item) => {
    const product = products.find((p) => p._id.toString() === item.productId);
    const category = categories.find((c) => c._id.equals(product?.category));
    const visible =
      product?.status === 'active' &&
      !!category &&
      (!category.parent || categories.some((c) => c._id.equals(category.parent)));
    const variant = product?.variants.find(
      (v) => v._id.toString() === item.variantId && v.isActive,
    );
    const available = visible && variant ? variant.stock : 0;
    const unavailable = !visible || !variant || available < item.quantity;
    return {
      id: item.id ?? item.variantId,
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
      name: visible ? product.name : 'Unavailable product',
      slug: visible ? product.slug : '',
      sku: variant?.sku ?? '',
      variantLabel: variant ? Object.values(variant.options).join(' / ') : '',
      image: visible ? (product.images.find((image) => image.isPrimary)?.url ?? '') : '',
      unitPrice: visible && variant ? variant.price : 0,
      lineTotal: visible && variant ? variant.price * item.quantity : 0,
      available,
      unavailable,
      priceChanged: false,
    };
  });
  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  let discount = 0;
  let discountError: { reason: string; message: string } | null = null;
  if (code) {
    try {
      const rule = await DiscountModel.findOne({ code }).lean();
      if (!rule) invalid('not_found');
      if (!rule.isActive) invalid('inactive');
      if (rule.startsAt && rule.startsAt > new Date()) invalid('not_started');
      if (rule.expiresAt && rule.expiresAt <= new Date()) invalid('expired');
      if (subtotal < rule.minSubtotal) invalid('min_subtotal');
      if (rule.usageLimit !== undefined && rule.usedCount >= rule.usageLimit)
        invalid('usage_limit');
      if (user && (await RedemptionModel.countDocuments({ code, user })) >= rule.perUserLimit)
        invalid('per_user_limit');
      const eligible = lines
        .filter((line) => {
          const product = products.find((p) => p._id.toString() === line.productId);
          return (
            product &&
            ((!rule.appliesTo.products.length && !rule.appliesTo.categories.length) ||
              rule.appliesTo.products.some((id) => id.equals(product._id)) ||
              rule.appliesTo.categories.some((id) => id.equals(product.category)))
          );
        })
        .reduce((sum, line) => sum + line.lineTotal, 0);
      if (!eligible) invalid('not_applicable');
      discount = Math.min(
        eligible,
        rule.type === 'fixed' ? rule.value : Math.floor((eligible * rule.value) / 100),
        rule.maxDiscount ?? Number.MAX_SAFE_INTEGER,
      );
    } catch (error) {
      if (!(error instanceof AppError) || error.code !== 'DISCOUNT_INVALID' || strictDiscount)
        throw error;
      discountError = {
        reason: (error.details as { reason: string }).reason,
        message: error.message,
      };
    }
  }
  const method = settings.shipping.methods.find((m) => m.isActive);
  const shipping =
    subtotal && method
      ? method.freeOverSubtotal !== undefined && subtotal - discount >= method.freeOverSubtotal
        ? 0
        : method.price
      : 0;
  const tax = Math.round(((subtotal - discount) * settings.tax.ratePercent) / 100);
  return {
    lines,
    discountCode: code ?? null,
    discountError,
    currency: settings.currency.code,
    shippingMethod: method
      ? { code: method.code, label: method.label, estimatedDays: method.estimatedDays }
      : null,
    totals: { subtotal, discount, shipping, tax, total: subtotal - discount + shipping + tax },
    canCheckout: lines.length > 0 && lines.every((line) => !line.unavailable) && !discountError,
  };
}
