import { model, Schema, type Types } from 'mongoose';
import type { CheckoutAddress, OrderView, OrderTotals } from '@commerceos/shared';
export interface Order {
  orderNumber: string;
  user: Types.ObjectId;
  items: {
    product: Types.ObjectId;
    variantId: Types.ObjectId;
    sku: string;
    name: string;
    variantLabel: string;
    image: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
  }[];
  shippingAddress: CheckoutAddress;
  shippingMethod: OrderView['shippingMethod'];
  currency: OrderView['currency'];
  totals: OrderTotals;
  discount?: OrderView['discount'];
  payment: {
    method: 'card_mock' | 'cod';
    status: 'unpaid' | 'paid' | 'refunded';
    transactionId?: string;
    last4?: string;
    paidAt?: Date;
    refundedAt?: Date;
  };
  status: OrderView['status'];
  statusHistory: { status: OrderView['status']; at: Date; by: string; note?: string | undefined }[];
  tracking?: { carrier: string; number: string; shippedAt: Date };
  internalNotes: { text: string; by: Types.ObjectId; at: Date }[];
  idempotencyKey?: string | undefined;
  createdAt: Date;
  updatedAt: Date;
}
const money = { type: Number, required: true, min: 0, validate: Number.isSafeInteger };
const address = new Schema<CheckoutAddress>(
  {
    fullName: String,
    line1: String,
    line2: String,
    city: String,
    region: String,
    postalCode: String,
    country: String,
    phone: String,
  },
  { _id: false },
);
const item = new Schema<Order['items'][number]>(
  {
    product: { type: Schema.Types.ObjectId, required: true },
    variantId: { type: Schema.Types.ObjectId, required: true },
    sku: String,
    name: String,
    variantLabel: String,
    image: String,
    unitPrice: money,
    quantity: { type: Number, min: 1, max: 10, required: true, validate: Number.isInteger },
    lineTotal: money,
  },
  { _id: false },
);
const schema = new Schema<Order>(
  {
    orderNumber: { type: String, required: true },
    user: { type: Schema.Types.ObjectId, required: true },
    items: { type: [item], required: true },
    shippingAddress: { type: address, required: true },
    shippingMethod: { code: String, label: String, price: money, estimatedDays: Number },
    currency: { code: String, decimals: Number },
    totals: { subtotal: money, discount: money, shipping: money, tax: money, total: money },
    discount: {
      type: new Schema(
        { code: String, type: String, value: Number, amount: money },
        { _id: false },
      ),
      required: false,
    },
    payment: {
      method: { type: String, enum: ['card_mock', 'cod'], required: true },
      status: { type: String, enum: ['unpaid', 'paid', 'refunded'], required: true },
      transactionId: String,
      last4: String,
      paidAt: Date,
      refundedAt: Date,
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'shipped', 'completed', 'cancelled', 'refunded'],
      required: true,
    },
    statusHistory: [{ status: String, at: Date, by: String, note: String }],
    tracking: {
      type: new Schema({ carrier: String, number: String, shippedAt: Date }, { _id: false }),
    },
    internalNotes: [{ text: String, by: Schema.Types.ObjectId, at: Date }],
    idempotencyKey: String,
  },
  { timestamps: true, strict: true },
);
schema.index({ orderNumber: 1 }, { unique: true });
schema.index({ user: 1, createdAt: -1 });
schema.index({ status: 1, createdAt: -1 });
schema.index({ createdAt: -1 });
schema.index(
  { user: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } },
);
export const OrderModel = model<Order>('Order', schema);
export const CounterModel = model<{ _id: string; seq: number }>(
  'Counter',
  new Schema(
    { _id: { type: String, required: true }, seq: { type: Number, default: 0 } },
    { versionKey: false },
  ),
);
export interface StockMovement {
  product: Types.ObjectId;
  variantId: Types.ObjectId;
  sku: string;
  delta: number;
  stockAfter: number;
  reason: 'order_placed' | 'order_cancelled' | 'refund_restock' | 'manual_adjustment' | 'restock';
  order?: Types.ObjectId;
  note?: string;
  by: Types.ObjectId;
  createdAt: Date;
}
const movement = new Schema<StockMovement>(
  {
    product: Schema.Types.ObjectId,
    variantId: Schema.Types.ObjectId,
    sku: String,
    delta: Number,
    stockAfter: { type: Number, min: 0 },
    reason: String,
    note: String,
    order: Schema.Types.ObjectId,
    by: Schema.Types.ObjectId,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
movement.index({ variantId: 1, createdAt: -1 });
export const StockMovementModel = model<StockMovement>('StockMovement', movement);

export function orderDto(order: Order & { _id: Types.ObjectId }): OrderView {
  return {
    id: order._id.toString(),
    orderNumber: order.orderNumber,
    items: order.items.map((line) => ({
      productId: line.product.toString(),
      variantId: line.variantId.toString(),
      sku: line.sku,
      name: line.name,
      variantLabel: line.variantLabel,
      image: line.image,
      unitPrice: line.unitPrice,
      quantity: line.quantity,
      lineTotal: line.lineTotal,
    })),
    shippingAddress: {
      fullName: order.shippingAddress.fullName,
      line1: order.shippingAddress.line1,
      line2: order.shippingAddress.line2,
      city: order.shippingAddress.city,
      region: order.shippingAddress.region,
      postalCode: order.shippingAddress.postalCode,
      country: order.shippingAddress.country,
      phone: order.shippingAddress.phone,
    },
    shippingMethod: {
      code: order.shippingMethod.code,
      label: order.shippingMethod.label,
      price: order.shippingMethod.price,
      estimatedDays: order.shippingMethod.estimatedDays,
    },
    currency: { code: order.currency.code, decimals: order.currency.decimals },
    totals: {
      subtotal: order.totals.subtotal,
      discount: order.totals.discount,
      shipping: order.totals.shipping,
      tax: order.totals.tax,
      total: order.totals.total,
    },
    discount: order.discount
      ? {
          code: order.discount.code,
          type: order.discount.type,
          value: order.discount.value,
          amount: order.discount.amount,
        }
      : undefined,
    payment: {
      method: order.payment.method,
      status: order.payment.status,
      transactionId: order.payment.transactionId,
      last4: order.payment.last4,
      paidAt: order.payment.paidAt?.toISOString(),
      refundedAt: order.payment.refundedAt?.toISOString(),
    },
    status: order.status,
    statusHistory: order.statusHistory.map((event) => ({
      status: event.status,
      at: event.at.toISOString(),
      by: event.by,
      note: event.note,
    })),
    tracking: order.tracking
      ? {
          carrier: order.tracking.carrier,
          number: order.tracking.number,
          shippedAt: order.tracking.shippedAt.toISOString(),
        }
      : undefined,
    createdAt: order.createdAt.toISOString(),
  };
}
