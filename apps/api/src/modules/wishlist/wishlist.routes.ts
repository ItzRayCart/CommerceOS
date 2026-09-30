import { Router } from 'express';
import { z } from 'zod';
import type { Env } from '@api/config/env.js';
import { authenticate, requirePermission } from '@api/common/middleware/authenticate.js';
import { asyncHandler } from '@api/common/middleware/async-handler.js';
import { validate } from '@api/common/middleware/validate.js';
import {
  addWishlist,
  listWishlist,
  removeWishlist,
} from '@api/modules/wishlist/wishlist.service.js';

export function createWishlistRouter(config: Env) {
  const router = Router();
  const params = z.object({ productId: z.string().regex(/^[a-f\d]{24}$/i) }).strict();
  router.use(authenticate(config), requirePermission('read-own-account'));
  router.get(
    '/',
    validate({
      query: z
        .object({
          page: z.coerce.number().int().min(1).default(1),
          limit: z.coerce.number().int().min(1).max(100).default(12),
        })
        .strict(),
    }),
    asyncHandler(async (req, res) => {
      const { page, limit } = req.validated['query'] as { page: number; limit: number };
      res.json(await listWishlist(req.auth!.userId, page, limit));
    }),
  );
  router.post(
    '/:productId',
    validate({ params, body: z.object({}).strict().optional(), query: z.object({}).strict() }),
    asyncHandler(async (req, res) => {
      await addWishlist(req.auth!.userId, req.params['productId']!);
      res.json({ data: { saved: true } });
    }),
  );
  router.delete(
    '/:productId',
    validate({ params, query: z.object({}).strict() }),
    asyncHandler(async (req, res) => {
      await removeWishlist(req.auth!.userId, req.params['productId']!);
      res.status(204).end();
    }),
  );
  return router;
}
