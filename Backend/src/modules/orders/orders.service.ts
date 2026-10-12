import mongoose, { type ClientSession } from 'mongoose';
import type { Logger } from 'pino';
import type { OrderInput } from '@commerceos/shared';
import type { MailProvider } from '@api/common/providers/mail.provider.js';
import type { PaymentProvider } from '@api/common/providers/payment.provider.js';
import { AppError } from '@api/common/errors/app-error.js';
import { CartModel } from '@api/modules/cart/cart.model.js';
import { ProductModel } from '@api/modules/catalog/product.model.js';
import { CategoryModel } from '@api/modules/catalog/category.model.js';
import { UserModel } from '@api/modules/users/users.model.js';
import { SettingsModel } from '@api/modules/settings/settings.model.js';
import { DiscountModel, RedemptionModel } from '@api/modules/cart/discount.model.js';
import { checkoutContext } from './checkout.service.js';
import { CounterModel, OrderModel, StockMovementModel, orderDto } from './orders.model.js';

export interface OrderDependencies {
  payment: PaymentProvider;
  mail: MailProvider;
  logger: Logger;
  webBaseUrl: string;
}
function duplicate(error: unknown): boolean {
  return error instanceof mongoose.mongo.MongoServerError && error.code === 11000;
}
export async function orderTransaction<T>(
  work: (session: ClientSession) => Promise<T>,
): Promise<T> {
  // Concurrent upserts of the annual counter can raise E11000 without a transient label.
  for (let attempt = 0; attempt < 4; attempt++) {
    const session = await mongoose.startSession();
    try {
      return await session.withTransaction(() => work(session), {
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' },
      });
    } catch (error) {
      if (!duplicate(error) || attempt === 3) throw error;
    } finally {
      await session.endSession();
    }
  }
  throw new AppError(409, 'CONFLICT', 'Please retry your order with the same submission key.');
}
export async function placeOrder(
  userId: string,
  input: OrderInput,
  key: string,
  deps: OrderDependencies,
) {
  const previous = await OrderModel.findOne({ user: userId, idempotencyKey: key }).lean();
  if (previous) return orderDto(previous);
  const result = await orderTransaction(async (session) => {
    const existing = await OrderModel.findOne({ user: userId, idempotencyKey: key })
      .session(session)
      .lean();
    if (existing) return { order: orderDto(existing), created: false, email: '' };
    // Serialize checkouts and cart mutations for this user. A simultaneous submission retries
    // its snapshot, then finds the committed idempotent order or the now-empty cart.
    await CartModel.updateOne({ user: userId }, { $inc: { __v: 1 } }, { session });
    const { cart, user, settings, quote } = await checkoutContext(userId, input, session);
    if (input.quoteFingerprint && input.quoteFingerprint !== quote.fingerprint)
      throw new AppError(
        409,
        'QUOTE_CHANGED',
        'Your order details changed. Refresh the quote and review the latest total before placing your order.',
      );
    await SettingsModel.updateOne({ _id: settings._id }, { $inc: { __v: 1 } }, { session });
    const orderId = new mongoose.Types.ObjectId();
    const categoryIds = new Set<string>();
    for (const line of quote.lines) {
      const product = await ProductModel.findOneAndUpdate(
        {
          _id: line.productId,
          status: 'active',
          variants: {
            $elemMatch: {
              _id: line.variantId,
              isActive: true,
              price: line.unitPrice,
              stock: { $gte: line.quantity },
            },
          },
        },
        {
          $inc: {
            'variants.$.stock': -line.quantity,
            totalStock: -line.quantity,
            soldCount: line.quantity,
          },
        },
        { session, new: true },
      ).lean();
      if (!product)
        throw new AppError(409, 'INSUFFICIENT_STOCK', 'An item is no longer available.', {
          lines: [{ variantId: line.variantId, requested: line.quantity, available: 0 }],
        });
      categoryIds.add(product.category.toString());
      const variant = product.variants.find((v) => v._id.toString() === line.variantId)!;
      await StockMovementModel.create(
        [
          {
            product: product._id,
            variantId: variant._id,
            sku: variant.sku,
            delta: -line.quantity,
            stockAfter: variant.stock,
            reason: 'order_placed',
            order: orderId,
            by: userId,
          },
        ],
        { session },
      );
    }
    // Fence category visibility against a concurrent category/parent deactivation.
    for (const id of categoryIds) {
      const category = await CategoryModel.findOneAndUpdate(
        { _id: id, isActive: true },
        { $inc: { __v: 1 } },
        { session },
      ).lean();
      if (!category)
        throw new AppError(409, 'INSUFFICIENT_STOCK', 'A product category is no longer available.');
      if (category.parent) {
        const parent = await CategoryModel.updateOne(
          { _id: category.parent, isActive: true },
          { $inc: { __v: 1 } },
          { session },
        );
        if (!parent.matchedCount)
          throw new AppError(
            409,
            'INSUFFICIENT_STOCK',
            'A product category is no longer available.',
          );
      }
    }
    const year = new Date().getUTCFullYear();
    const counter = await CounterModel.findOneAndUpdate(
      { _id: `order-${year}` },
      { $inc: { seq: 1 } },
      { upsert: true, new: true, session },
    )
      .lean()
      .orFail();
    const orderNumber = `${settings.orderNumberPrefix}-${year}-${String(counter.seq).padStart(6, '0')}`;
    const payment = await deps.payment.charge({
      amount: quote.totals.total,
      currency: quote.currency.code,
      method: input.payment.method,
      token: input.payment.token,
      orderRef: orderId.toString(),
    });
    if (payment.status === 'failed')
      throw new AppError(
        402,
        'PAYMENT_FAILED',
        payment.failureReason === 'insufficient_funds'
          ? 'The mock card has insufficient funds. Choose another payment method.'
          : 'The mock card was declined. Choose another payment method.',
        { reason: payment.failureReason },
      );
    const status = input.payment.method === 'cod' ? 'pending' : 'paid';
    let discount:
      { code: string; type: 'percentage' | 'fixed'; value: number; amount: number } | undefined;
    if (cart.discountCode) {
      const rule = await DiscountModel.findOneAndUpdate(
        {
          code: cart.discountCode,
          isActive: true,
          $or: [
            { usageLimit: { $exists: false } },
            { $expr: { $lt: ['$usedCount', '$usageLimit'] } },
          ],
        },
        { $inc: { usedCount: 1 } },
        { session, new: true },
      ).lean();
      if (!rule)
        throw new AppError(
          422,
          'DISCOUNT_INVALID',
          'This discount code has reached its usage limit.',
          { reason: 'usage_limit' },
        );
      discount = {
        code: rule.code,
        type: rule.type,
        value: rule.value,
        amount: quote.totals.discount,
      };
      await RedemptionModel.create(
        [{ code: rule.code, user: userId, order: orderId, amount: discount.amount }],
        { session },
      );
    }
    const [order] = await OrderModel.create(
      [
        {
          _id: orderId,
          orderNumber,
          user: userId,
          items: quote.lines.map(({ productId, ...line }) => ({ ...line, product: productId })),
          shippingAddress: quote.address,
          shippingMethod: quote.shippingMethod,
          currency: quote.currency,
          totals: quote.totals,
          discount,
          payment: {
            method: input.payment.method,
            status: payment.status,
            transactionId: payment.transactionId,
            last4: payment.last4,
            paidAt: status === 'paid' ? new Date() : undefined,
          },
          status,
          statusHistory: [{ status, at: new Date(), by: 'system' }],
          internalNotes: [],
          idempotencyKey: key,
        },
      ],
      { session },
    );
    await UserModel.updateOne(
      { _id: userId, status: 'active' },
      {
        $inc: { 'stats.orderCount': 1, 'stats.totalSpent': quote.totals.total },
        $set: { 'stats.lastOrderAt': new Date() },
      },
      { session },
    );
    await CartModel.deleteOne({ _id: cart._id }, { session });
    return { order: orderDto(order!), created: true, email: user.email };
  });
  if (result.created) {
    try {
      await deps.mail.sendOrderConfirmation(
        result.email,
        result.order.orderNumber,
        `${deps.webBaseUrl}/account/orders/${result.order.orderNumber}`,
      );
    } catch {
      deps.logger.warn(
        { orderNumber: result.order.orderNumber },
        'Order confirmation email could not be sent',
      );
    }
  }
  return result.order;
}
