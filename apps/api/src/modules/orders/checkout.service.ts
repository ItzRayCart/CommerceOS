import type { ClientSession } from 'mongoose';
import { createHash } from 'node:crypto';
import type { CheckoutInput, CheckoutQuote } from '@commerceos/shared';
import { AppError, NotFoundError, UnauthenticatedError } from '@api/common/errors/app-error.js';
import { CartModel } from '@api/modules/cart/cart.model.js';
import { priceCart } from '@api/modules/cart/cart.pricing.js';
import { UserModel } from '@api/modules/users/users.model.js';
import { SettingsModel } from '@api/modules/settings/settings.model.js';
import { checkoutAddressSchema } from './orders.schemas.js';

export async function checkoutContext(
  userId: string,
  input: CheckoutInput,
  session?: ClientSession,
) {
  const user = await UserModel.findOne({ _id: userId, status: 'active' })
    .session(session ?? null)
    .lean();
  if (!user) throw new UnauthenticatedError();
  const cart = await CartModel.findOne({ user: userId })
    .session(session ?? null)
    .lean();
  if (!cart?.items.length)
    throw new AppError(409, 'EMPTY_CART', 'Your cart is empty. Add an item before checkout.');
  if (new Set(cart.items.map((line) => line.variantId.toString())).size !== cart.items.length)
    throw new AppError(
      409,
      'CONFLICT',
      'Your cart has duplicate variants. Update your cart before checkout.',
    );
  let address = input.address;
  if (input.addressId) {
    const saved = user.addresses.find((entry) => entry._id.toString() === input.addressId);
    if (!saved) throw new NotFoundError('Address not found');
    address = {
      fullName: saved.fullName,
      line1: saved.line1,
      line2: saved.line2,
      city: saved.city,
      region: saved.region,
      postalCode: saved.postalCode,
      country: saved.country,
      phone: saved.phone,
    };
  }
  const parsed = checkoutAddressSchema.safeParse(address);
  if (!parsed.success)
    throw new AppError(
      422,
      'VALIDATION_ERROR',
      'Please complete a valid shipping address.',
      parsed.error.issues.map((issue) => ({
        path: `address.${issue.path.join('.')}`,
        message: issue.message,
      })),
    );
  const priced = await priceCart(
    cart.items.map((entry) => ({
      productId: entry.product.toString(),
      variantId: entry.variantId.toString(),
      quantity: entry.quantity,
    })),
    cart.discountCode,
    userId,
    true,
    { session, shippingMethodCode: input.shippingMethodCode },
  );
  const bad = priced.lines.filter(
    (line) =>
      line.unavailable ||
      !Number.isInteger(line.quantity) ||
      line.quantity < 1 ||
      line.quantity > 10,
  );
  if (bad.length)
    throw new AppError(
      409,
      'INSUFFICIENT_STOCK',
      'Some items are no longer available in the requested quantity. Update your cart.',
      {
        lines: bad.map((line) => ({
          variantId: line.variantId,
          requested: line.quantity,
          available: line.available,
        })),
      },
    );
  const settings = await SettingsModel.findOne({ key: 'store' })
    .session(session ?? null)
    .lean()
    .orFail();
  const method = settings.shipping.methods.find(
    (entry) => entry.isActive && entry.code === input.shippingMethodCode,
  );
  if (!method) throw new AppError(422, 'VALIDATION_ERROR', 'This shipping method is unavailable.');
  const quote: CheckoutQuote = {
    fingerprint: '',
    lines: priced.lines.map((line) => ({
      productId: line.productId,
      variantId: line.variantId,
      sku: line.sku,
      name: line.name,
      variantLabel: line.variantLabel,
      image: line.image,
      unitPrice: line.unitPrice,
      quantity: line.quantity,
      lineTotal: line.lineTotal,
    })),
    address: parsed.data,
    shippingMethod: {
      code: method.code,
      label: method.label,
      price: priced.totals.shipping,
      estimatedDays: method.estimatedDays,
    },
    currency: { code: settings.currency.code, decimals: settings.currency.decimals },
    totals: priced.totals,
    discountCode: cart.discountCode ?? null,
  };
  quote.fingerprint = createHash('sha256').update(JSON.stringify(quote)).digest('hex');
  return { user, cart, settings, quote };
}
export async function quoteCheckout(user: string, input: CheckoutInput): Promise<CheckoutQuote> {
  // A read-only transaction gives every quote one coherent snapshot, without reserving stock.
  const session = await CartModel.startSession();
  try {
    return await session.withTransaction(
      async () => (await checkoutContext(user, input, session)).quote,
    );
  } finally {
    await session.endSession();
  }
}
