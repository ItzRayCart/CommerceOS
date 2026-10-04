import type { z } from 'zod';
import type { RequestHandler } from 'express';
import { asyncHandler } from '@api/common/middleware/async-handler.js';
import { ValidationError, NotFoundError } from '@api/common/errors/app-error.js';
import type { CheckoutInput, OrderInput } from '@commerceos/shared';
import { paginate } from '@api/common/utils/pagination.js';
import { quoteCheckout } from './checkout.service.js';
import { placeOrder, type OrderDependencies } from './orders.service.js';
import { transitionOrder } from './order-transitions.service.js';
import { OrderModel, orderDto } from './orders.model.js';
import { idempotencySchema } from './orders.schemas.js';
import type { orderQuery, statusSchema } from './orders.schemas.js';

export function createOrdersController(deps: OrderDependencies): Record<string, RequestHandler> {
  return {
    quote: asyncHandler(async (req, res) => {
      res.json({
        data: await quoteCheckout(req.auth!.userId, req.validated['body'] as CheckoutInput),
      });
    }),
    place: asyncHandler(async (req, res) => {
      const key = idempotencySchema.safeParse(req.headers['idempotency-key']);
      if (!key.success)
        throw new ValidationError([
          { path: 'Idempotency-Key', message: key.error.issues[0]?.message },
        ]);
      res.status(201).json({
        data: await placeOrder(
          req.auth!.userId,
          req.validated['body'] as OrderInput,
          key.data,
          deps,
        ),
      });
    }),
    list: asyncHandler(async (req, res) => {
      const query = req.validated['query'] as z.infer<typeof orderQuery>;
      const filter = { user: req.auth!.userId, ...(query.status ? { status: query.status } : {}) };
      const total = await OrderModel.countDocuments(filter);
      const orders = await OrderModel.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean();
      res.json({ data: orders.map(orderDto), meta: paginate(query.page, query.limit, total) });
    }),
    detail: asyncHandler(async (req, res) => {
      const order = await OrderModel.findOne({
        user: req.auth!.userId,
        orderNumber: req.params['orderNumber'],
      }).lean();
      if (!order) throw new NotFoundError('Order not found');
      res.json({ data: orderDto(order) });
    }),
    cancel: asyncHandler(async (req, res) => {
      res.json({
        data: await transitionOrder(
          req.auth!.userId,
          { user: req.auth!.userId, orderNumber: req.params['orderNumber']! },
          { status: 'cancelled' },
          deps,
        ),
      });
    }),
    adminStatus: asyncHandler(async (req, res) => {
      res.json({
        data: await transitionOrder(
          req.auth!.userId,
          { _id: req.params['id']! },
          req.validated['body'] as z.infer<typeof statusSchema>,
          deps,
        ),
      });
    }),
  };
}
