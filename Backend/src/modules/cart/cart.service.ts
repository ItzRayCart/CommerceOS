import mongoose from 'mongoose';
import type { HydratedDocument } from 'mongoose';
import { AppError, NotFoundError } from '@api/common/errors/app-error.js';
import { CartModel } from '@api/modules/cart/cart.model.js';
import type { Cart } from '@api/modules/cart/cart.model.js';
import type { CartInput } from '@api/modules/cart/cart.schemas.js';
import { priceCart, priceHash } from '@api/modules/cart/cart.pricing.js';

async function ensureCart(user: string) {
  await CartModel.updateOne({ user }, { $setOnInsert: { items: [] } }, { upsert: true });
}
function inputs(
  items: {
    _id: mongoose.Types.ObjectId;
    product: mongoose.Types.ObjectId;
    variantId: mongoose.Types.ObjectId;
    quantity: number;
  }[],
) {
  return items.map((item) => ({
    id: item._id.toString(),
    productId: item.product.toString(),
    variantId: item.variantId.toString(),
    quantity: item.quantity,
  }));
}
export async function readCart(user: string) {
  const cart = await CartModel.findOne({ user }).lean();
  const quote = await priceCart(inputs(cart?.items ?? []), cart?.discountCode, user);
  return {
    ...quote,
    lines: quote.lines.map((line) => {
      const previous = cart?.items.find(
        (item) => item.variantId.toString() === line.variantId,
      )?.quotedPriceHash;
      return {
        ...line,
        priceChanged: !!previous && previous !== priceHash(line.variantId, line.unitPrice),
      };
    }),
  };
}
async function mutateCart(user: string, change: (cart: HydratedDocument<Cart>) => Promise<void>) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      await ensureCart(user);
      const cart = await CartModel.findOne({ user });
      if (!cart) continue;
      await change(cart);
      await cart.save();
      return await readCart(user);
    } catch (error) {
      const retryable =
        error instanceof mongoose.Error.VersionError ||
        error instanceof mongoose.Error.DocumentNotFoundError ||
        (error instanceof mongoose.mongo.MongoServerError && error.code === 11000);
      if (!retryable) throw error;
    }
  }
  throw new AppError(409, 'CONFLICT', 'Your cart changed. Please try again.');
}
export async function addCartItems(user: string, incoming: CartInput[], merge: boolean) {
  return mutateCart(user, async (cart) => {
    const merged = inputs(cart.items);
    for (const item of incoming) {
      const existing = merged.find(
        (line) => line.productId === item.productId && line.variantId === item.variantId,
      );
      if (existing) existing.quantity += item.quantity;
      else merged.push({ ...item, id: new mongoose.Types.ObjectId().toString() });
    }
    if (merged.length > 200)
      throw new AppError(422, 'CART_FULL', 'Your cart can contain at most 200 different variants.');
    const quote = await priceCart(merged);
    const requested = new Set(incoming.map((item) => item.variantId));
    if (
      !merge &&
      quote.lines.some(
        (line) =>
          requested.has(line.variantId) && (line.quantity > 10 || line.quantity > line.available),
      )
    ) {
      throw new AppError(
        409,
        'INSUFFICIENT_STOCK',
        'The requested quantity is not available. Choose fewer units.',
        {
          lines: quote.lines
            .filter(
              (line) =>
                requested.has(line.variantId) &&
                (line.quantity > 10 || line.quantity > line.available),
            )
            .map((line) => ({
              variantId: line.variantId,
              requested: line.quantity,
              available: Math.min(10, line.available),
            })),
        },
      );
    }
    cart.items = quote.lines
      .filter((line) => !merge || line.available > 0)
      .map((line) => ({
        _id: new mongoose.Types.ObjectId(line.id),
        product: new mongoose.Types.ObjectId(line.productId),
        variantId: new mongoose.Types.ObjectId(line.variantId),
        quantity: merge ? Math.min(10, line.available, line.quantity) : line.quantity,
        quotedPriceHash: priceHash(line.variantId, line.unitPrice),
      }));
  });
}
export async function setQuantity(user: string, id: string, quantity: number) {
  return mutateCart(user, async (cart) => {
    const item = cart.items.find((line) => line._id.toString() === id);
    if (!item) throw new NotFoundError('Cart item not found');
    const quote = await priceCart([
      { productId: item.product.toString(), variantId: item.variantId.toString(), quantity },
    ]);
    if (quote.lines[0]?.unavailable)
      throw new AppError(409, 'INSUFFICIENT_STOCK', 'This quantity is no longer available.', {
        lines: [
          {
            variantId: item.variantId.toString(),
            requested: quantity,
            available: quote.lines[0].available,
          },
        ],
      });
    item.quantity = quantity;
    item.quotedPriceHash = priceHash(item.variantId.toString(), quote.lines[0]!.unitPrice);
  });
}
export async function removeCartItem(user: string, id: string) {
  await mutateCart(user, async (cart) => {
    if (!cart.items.some((line) => line._id.toString() === id))
      throw new NotFoundError('Cart item not found');
    cart.items = cart.items.filter((line) => line._id.toString() !== id);
    await Promise.resolve();
  });
}
export async function clearCart(user: string) {
  await CartModel.deleteOne({ user });
}
export async function applyDiscount(user: string, code: string) {
  return mutateCart(user, async (cart) => {
    await priceCart(inputs(cart.items), code, user, true);
    cart.discountCode = code;
  });
}
export async function removeDiscount(user: string) {
  await CartModel.updateOne({ user }, { $unset: { discountCode: 1 }, $inc: { __v: 1 } });
}
