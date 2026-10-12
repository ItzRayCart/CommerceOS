import type { OrderView } from '@commerceos/shared';
import { AppError, NotFoundError } from '@api/common/errors/app-error.js';
import { ProductModel } from '@api/modules/catalog/product.model.js';
import { UserModel } from '@api/modules/users/users.model.js';
import { DiscountModel, RedemptionModel } from '@api/modules/cart/discount.model.js';
import { OrderModel, StockMovementModel, orderDto } from './orders.model.js';
import { orderTransaction, type OrderDependencies } from './orders.service.js';

const transitions: Record<OrderView['status'], OrderView['status'][]> = {
  pending: ['paid', 'cancelled'],
  paid: ['shipped', 'cancelled'],
  shipped: ['completed', 'refunded'],
  completed: ['refunded'],
  cancelled: [],
  refunded: [],
};
export function assertTransition(
  from: OrderView['status'],
  to: OrderView['status'],
  customer: boolean,
): void {
  if (
    !transitions[from].includes(to) ||
    (customer && !(from === 'pending' && to === 'cancelled'))
  ) {
    throw new AppError(
      409,
      'INVALID_STATE_TRANSITION',
      'This order cannot make the requested status change.',
      { from, to },
    );
  }
}
export async function transitionOrder(
  actor: string,
  filter: { _id?: string; orderNumber?: string; user?: string },
  input: {
    status: OrderView['status'];
    note?: string | undefined;
    tracking?: { carrier: string; number: string } | undefined;
    restock?: boolean | undefined;
  },
  deps: OrderDependencies,
) {
  const result = await orderTransaction(async (session) => {
    const order = await OrderModel.findOne(filter).session(session);
    if (!order) throw new NotFoundError('Order not found');
    assertTransition(order.status, input.status, !!filter.user);
    if (input.status === 'shipped' && !input.tracking)
      throw new AppError(422, 'VALIDATION_ERROR', 'Carrier and tracking number are required.');
    if (
      (input.status === 'cancelled' || input.status === 'refunded') &&
      order.payment.status === 'paid'
    ) {
      await deps.payment.refund({
        transactionId: order.payment.transactionId ?? order.orderNumber,
        amount: order.totals.total,
      });
      order.payment.status = 'refunded';
      order.payment.refundedAt = new Date();
    }
    if (input.status === 'cancelled' || (input.status === 'refunded' && input.restock)) {
      for (const line of order.items) {
        const product = await ProductModel.findOneAndUpdate(
          { _id: line.product, 'variants._id': line.variantId },
          {
            $inc: {
              'variants.$.stock': line.quantity,
              totalStock: line.quantity,
              soldCount: -line.quantity,
            },
          },
          { new: true, session },
        ).lean();
        if (!product)
          throw new AppError(
            409,
            'CONFLICT',
            'An ordered variant is missing; stock could not be restored.',
          );
        await StockMovementModel.create(
          [
            {
              product: line.product,
              variantId: line.variantId,
              sku: line.sku,
              delta: line.quantity,
              stockAfter: product.variants.find((variant) => variant._id.equals(line.variantId))!
                .stock,
              reason: input.status === 'cancelled' ? 'order_cancelled' : 'refund_restock',
              order: order._id,
              by: actor,
            },
          ],
          { session },
        );
      }
    }
    if (input.status === 'cancelled') {
      const released = await RedemptionModel.deleteOne({ order: order._id }, { session });
      if (released.deletedCount && order.discount)
        await DiscountModel.updateOne(
          { code: order.discount.code, usedCount: { $gt: 0 } },
          { $inc: { usedCount: -1 } },
          { session },
        );
      const latest = await OrderModel.findOne({
        user: order.user,
        _id: { $ne: order._id },
        status: { $ne: 'cancelled' },
      })
        .sort({ createdAt: -1 })
        .session(session)
        .lean();
      await UserModel.updateOne(
        { _id: order.user },
        {
          $inc: { 'stats.orderCount': -1, 'stats.totalSpent': -order.totals.total },
          ...(latest
            ? { $set: { 'stats.lastOrderAt': latest.createdAt } }
            : { $unset: { 'stats.lastOrderAt': 1 } }),
        },
        { session },
      );
    }
    if (input.status === 'paid') {
      order.payment.status = 'paid';
      order.payment.paidAt = new Date();
    }
    if (input.status === 'shipped') order.tracking = { ...input.tracking!, shippedAt: new Date() };
    order.status = input.status;
    order.statusHistory.push({ status: input.status, at: new Date(), by: actor, note: input.note });
    await order.save({ session });
    return orderDto(order);
  });
  if (result.status === 'shipped' && result.tracking) {
    try {
      const user = await UserModel.findOne({
        _id: (await OrderModel.findById(result.id).lean())?.user,
      }).lean();
      if (user)
        await deps.mail.sendOrderShipped(
          user.email,
          result.orderNumber,
          result.tracking.carrier,
          result.tracking.number,
        );
    } catch {
      deps.logger.warn({ orderNumber: result.orderNumber }, 'Shipping email could not be sent');
    }
  }
  return result;
}
