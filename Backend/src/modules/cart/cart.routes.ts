import { Router } from 'express';
import { z } from 'zod';
import type { Env } from '@api/config/env.js';
import { authenticate, requirePermission } from '@api/common/middleware/authenticate.js';
import { asyncHandler } from '@api/common/middleware/async-handler.js';
import { validate } from '@api/common/middleware/validate.js';
import {
  cartItemParams,
  cartItemsSchema,
  cartItemSchema,
  discountSchema,
  quantitySchema,
  type CartInput,
} from '@api/modules/cart/cart.schemas.js';
import { priceCart } from '@api/modules/cart/cart.pricing.js';
import {
  addCartItems,
  applyDiscount,
  clearCart,
  readCart,
  removeCartItem,
  removeDiscount,
  setQuantity,
} from '@api/modules/cart/cart.service.js';

export function createCartRouter(config: Env) {
  const router = Router();
  const empty = z.object({}).strict();
  router.use(validate({ query: empty }));
  router.post(
    '/price',
    validate({ body: cartItemsSchema }),
    asyncHandler(async (req, res) => {
      const input = req.validated['body'] as { items: CartInput[] };
      res.json({ data: await priceCart(input.items) });
    }),
  );
  router.use(authenticate(config), requirePermission('read-own-account'));
  router.get(
    '/',
    asyncHandler(async (req, res) => {
      res.json({ data: await readCart(req.auth!.userId) });
    }),
  );
  router.post(
    '/items',
    validate({ body: cartItemSchema }),
    asyncHandler(async (req, res) => {
      res.status(201).json({
        data: await addCartItems(req.auth!.userId, [req.validated['body'] as CartInput], false),
      });
    }),
  );
  router.post(
    '/merge',
    validate({ body: cartItemsSchema }),
    asyncHandler(async (req, res) => {
      res.json({
        data: await addCartItems(
          req.auth!.userId,
          (req.validated['body'] as { items: CartInput[] }).items,
          true,
        ),
      });
    }),
  );
  router.patch(
    '/items/:itemId',
    validate({ params: cartItemParams, body: z.object({ quantity: quantitySchema }).strict() }),
    asyncHandler(async (req, res) => {
      res.json({
        data: await setQuantity(
          req.auth!.userId,
          req.params['itemId']!,
          (req.validated['body'] as { quantity: number }).quantity,
        ),
      });
    }),
  );
  router.delete(
    '/items/:itemId',
    validate({ params: cartItemParams }),
    asyncHandler(async (req, res) => {
      await removeCartItem(req.auth!.userId, req.params['itemId']!);
      res.status(204).end();
    }),
  );
  router.delete(
    '/',
    asyncHandler(async (req, res) => {
      await clearCart(req.auth!.userId);
      res.status(204).end();
    }),
  );
  router.post(
    '/discount',
    validate({ body: discountSchema }),
    asyncHandler(async (req, res) => {
      res.json({
        data: await applyDiscount(
          req.auth!.userId,
          (req.validated['body'] as { code: string }).code,
        ),
      });
    }),
  );
  router.delete(
    '/discount',
    asyncHandler(async (req, res) => {
      await removeDiscount(req.auth!.userId);
      res.status(204).end();
    }),
  );
  return router;
}
