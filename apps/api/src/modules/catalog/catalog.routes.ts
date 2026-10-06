import { Router } from 'express';
import { asyncHandler } from '@api/common/middleware/async-handler.js';
import { validate } from '@api/common/middleware/validate.js';
import {
  emptyQuerySchema,
  productQuerySchema,
  slugParamsSchema,
  suggestQuerySchema,
} from '@api/modules/catalog/catalog.schemas.js';
import type { ProductQuery } from '@api/modules/catalog/catalog.schemas.js';
import {
  getCategory,
  getProduct,
  getPublicSettings,
  getRelatedProducts,
  listCategories,
  listProducts,
  suggestProducts,
} from '@api/modules/catalog/catalog.service.js';

export const settingsRouter = Router();
settingsRouter.get(
  '/public',
  validate({ query: emptyQuerySchema }),
  asyncHandler(async (_request, response) => {
    response.json({ data: await getPublicSettings() });
  }),
);

export const categoriesRouter = Router();
categoriesRouter.get(
  '/',
  validate({ query: emptyQuerySchema }),
  asyncHandler(async (_request, response) => {
    response.json({ data: await listCategories() });
  }),
);
categoriesRouter.get(
  '/:slug',
  validate({ query: emptyQuerySchema, params: slugParamsSchema }),
  asyncHandler(async (request, response) => {
    response.json({ data: await getCategory(request.params['slug'] ?? '') });
  }),
);

export const productsRouter = Router();
productsRouter.get(
  '/',
  validate({ query: productQuerySchema }),
  asyncHandler(async (request, response) => {
    const result = await listProducts(request.validated['query'] as ProductQuery);
    response.json(result);
  }),
);
productsRouter.get(
  '/suggest',
  validate({ query: suggestQuerySchema }),
  asyncHandler(async (request, response) => {
    const query = request.validated['query'] as { q: string };
    response.json({ data: await suggestProducts(query.q) });
  }),
);
productsRouter.get(
  '/:slug/related',
  validate({ query: emptyQuerySchema, params: slugParamsSchema }),
  asyncHandler(async (request, response) => {
    response.json({ data: await getRelatedProducts(request.params['slug'] ?? '') });
  }),
);
productsRouter.get(
  '/:slug',
  validate({ query: emptyQuerySchema, params: slugParamsSchema }),
  asyncHandler(async (request, response) => {
    response.json({ data: await getProduct(request.params['slug'] ?? '') });
  }),
);
