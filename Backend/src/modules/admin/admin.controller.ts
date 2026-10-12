import { asyncHandler } from '@api/common/middleware/async-handler.js';
import { BadRequestError, NotFoundError } from '@api/common/errors/app-error.js';
import { paginate } from '@api/common/utils/pagination.js';
import type { StorageProvider } from '@api/common/providers/storage.provider.js';
import type { RequestHandler } from 'express';
import type { z } from 'zod';
import * as catalogue from './catalogue-admin.service.js';
import * as sales from './sales-admin.service.js';
import * as insight from './insight-admin.service.js';
import { productSchema, categorySchema, variantSchema } from './admin.schemas.js';
import type {
  ListQuery,
  InventoryQuery,
  ProductInput,
  CategoryInput,
  OrderListQuery,
  DiscountInput,
  AnalyticsQuery,
  stockSchema,
  settingsSchema,
  customerSchema,
  dashboardQuery,
} from './admin.schemas.js';
function actor(req: Parameters<RequestHandler>[0]) {
  if (!req.auth) throw new BadRequestError();
  return req.auth.userId;
}
function id(req: Parameters<RequestHandler>[0]) {
  return (req.validated?.['params'] as { id: string }).id;
}
function query<T>(req: Parameters<RequestHandler>[0]) {
  return req.validated?.['query'] as T;
}
function body<T>(req: Parameters<RequestHandler>[0]) {
  return req.validated?.['body'] as T;
}
export function adminController(storage: StorageProvider) {
  return {
    products: asyncHandler(async (req, res) => {
      res.json(await catalogue.listAdminProducts(query<ListQuery>(req)));
    }),
    product: asyncHandler(async (req, res) => {
      res.json({ data: await catalogue.getAdminProduct(id(req)) });
    }),
    createProduct: asyncHandler(async (req, res) => {
      res
        .status(201)
        .json({ data: await catalogue.saveProduct(actor(req), body<ProductInput>(req)) });
    }),
    updateProduct: asyncHandler(async (req, res) => {
      const current = await catalogue.getAdminProduct(id(req));
      const {
        id: ignored,
        minPrice: ignoredPrice,
        totalStock: ignoredStock,
        createdAt: ignoredCreated,
        updatedAt: ignoredUpdated,
        ...editable
      } = current;
      void [ignored, ignoredPrice, ignoredStock, ignoredCreated, ignoredUpdated];
      const { expectedUpdatedAt, ...patch } = body<
        Partial<ProductInput> & { expectedUpdatedAt?: string }
      >(req);
      const input = productSchema.parse({ ...editable, ...patch });
      res.json({
        data: await catalogue.saveProduct(
          actor(req),
          input,
          id(req),
          expectedUpdatedAt ?? current.updatedAt,
        ),
      });
    }),
    deleteProduct: asyncHandler(async (req, res) => {
      await catalogue.deleteProduct(id(req));
      res.sendStatus(204);
    }),
    duplicate: asyncHandler(async (req, res) => {
      res.status(201).json({ data: await catalogue.duplicateProduct(actor(req), id(req)) });
    }),
    variant: asyncHandler(async (req, res) => {
      const params = req.validated?.['params'] as { id: string; vid: string };
      const current = await catalogue.getAdminProduct(params.id);
      if (!current.variants.some((v) => v.id === params.vid))
        throw new NotFoundError('Variant not found');
      const variants = current.variants.map((v) =>
        v.id === params.vid ? variantSchema.parse({ ...v, ...body<object>(req) }) : v,
      );
      const {
        id: ignored,
        minPrice: ignoredPrice,
        totalStock: ignoredStock,
        createdAt: ignoredCreated,
        updatedAt: ignoredUpdated,
        ...editable
      } = current;
      void [ignored, ignoredPrice, ignoredStock, ignoredCreated, ignoredUpdated];
      res.json({
        data: await catalogue.saveProduct(
          actor(req),
          productSchema.parse({ ...editable, variants }),
          params.id,
          current.updatedAt,
        ),
      });
    }),
    stock: asyncHandler(async (req, res) => {
      const params = req.validated?.['params'] as { id: string; vid: string };
      res.json({
        data: await catalogue.adjustStock(
          actor(req),
          params.id,
          params.vid,
          body<z.infer<typeof stockSchema>>(req),
        ),
      });
    }),
    inventory: asyncHandler(async (req, res) => {
      res.json(await catalogue.listInventory(query<InventoryQuery>(req)));
    }),
    movements: asyncHandler(async (req, res) => {
      res.json(await catalogue.listMovements(query<InventoryQuery>(req)));
    }),
    categories: asyncHandler(async (req, res) => {
      res.json(await catalogue.listAdminCategories(query<ListQuery>(req)));
    }),
    createCategory: asyncHandler(async (req, res) => {
      res.status(201).json({ data: await catalogue.saveCategory(body<CategoryInput>(req)) });
    }),
    updateCategory: asyncHandler(async (req, res) => {
      const current = await catalogue.getAdminCategory(id(req));
      const { id: ignored, ...editable } = current;
      void ignored;
      res.json({
        data: await catalogue.saveCategory(
          categorySchema.parse({ ...editable, ...body<object>(req) }),
          id(req),
        ),
      });
    }),
    deleteCategory: asyncHandler(async (req, res) => {
      await catalogue.deleteCategory(id(req));
      res.sendStatus(204);
    }),
    uploads: asyncHandler(async (req, res) => {
      if (!Array.isArray(req.files)) throw new BadRequestError('Select image files');
      res.status(201).json({ data: await storage.saveImages(req.files) });
    }),
    orders: asyncHandler(async (req, res) => {
      res.json(await sales.listAdminOrders(query<OrderListQuery>(req)));
    }),
    order: asyncHandler(async (req, res) => {
      res.json({ data: await sales.adminOrder(id(req)) });
    }),
    note: asyncHandler(async (req, res) => {
      res.status(201).json({
        data: await sales.addOrderNote(actor(req), id(req), body<{ text: string }>(req).text),
      });
    }),
    customers: asyncHandler(async (req, res) => {
      res.json(await sales.listCustomers(query<ListQuery>(req)));
    }),
    customer: asyncHandler(async (req, res) => {
      res.json({ data: await sales.getCustomer(id(req)) });
    }),
    updateCustomer: asyncHandler(async (req, res) => {
      res.json({
        data: await sales.updateCustomer(
          actor(req),
          id(req),
          body<z.infer<typeof customerSchema>>(req),
        ),
      });
    }),
    discounts: asyncHandler(async (req, res) => {
      res.json(await sales.listDiscounts(query<ListQuery>(req)));
    }),
    discount: asyncHandler(async (req, res) => {
      res.json({ data: await sales.getDiscount(id(req)) });
    }),
    createDiscount: asyncHandler(async (req, res) => {
      res.status(201).json({ data: await sales.saveDiscount(body<DiscountInput>(req)) });
    }),
    updateDiscount: asyncHandler(async (req, res) => {
      res.json({ data: await sales.saveDiscount(body<DiscountInput>(req), id(req)) });
    }),
    deleteDiscount: asyncHandler(async (req, res) => {
      await sales.deleteDiscount(id(req));
      res.sendStatus(204);
    }),
    settings: asyncHandler(async (_req, res) => {
      res.json({ data: await sales.getSettings() });
    }),
    saveSettings: asyncHandler(async (req, res) => {
      res.json({ data: await sales.saveSettings(body<z.infer<typeof settingsSchema>>(req)) });
    }),
    dashboard: asyncHandler(async (req, res) => {
      const q = query<z.infer<typeof dashboardQuery>>(req);
      res.json({ data: await insight.dashboard(q.range, q.chartDays) });
    }),
    revenue: asyncHandler(async (req, res) => {
      res.json({ data: await insight.revenue(query<AnalyticsQuery>(req)) });
    }),
    topProducts: asyncHandler(async (req, res) => {
      const q = query<AnalyticsQuery>(req);
      const rows = await insight.topProducts(q);
      res.json({
        data: rows.slice((q.page - 1) * q.limit, q.page * q.limit),
        meta: paginate(q.page, q.limit, rows.length),
      });
    }),
    analyticsCategories: asyncHandler(async (req, res) => {
      const q = query<AnalyticsQuery>(req);
      const rows = await insight.categories(q);
      res.json({
        data: rows.slice((q.page - 1) * q.limit, q.page * q.limit),
        meta: paginate(q.page, q.limit, rows.length),
      });
    }),
    analyticsCustomers: asyncHandler(async (req, res) => {
      res.json({ data: await insight.customerMetrics(query<AnalyticsQuery>(req)) });
    }),
    analyticsDiscounts: asyncHandler(async (req, res) => {
      const q = query<AnalyticsQuery>(req);
      const rows = await insight.discountMetrics(q);
      res.json({
        data: rows.slice((q.page - 1) * q.limit, q.page * q.limit),
        meta: paginate(q.page, q.limit, rows.length),
      });
    }),
    exportOrders: asyncHandler(async (req, res) => {
      const q = query<OrderListQuery>(req);
      res.type('text/csv').attachment('orders.csv');
      res.write(
        insight.csvRow(['Order', 'Customer', 'Status', 'Total (minor units)', 'Created UTC']),
      );
      let page = 1;
      let hasNext = true;
      while (hasNext) {
        const result = await sales.listAdminOrders({ ...q, page, limit: 100 });
        for (const o of result.data)
          res.write(
            insight.csvRow([
              o.orderNumber,
              o.customer.email,
              o.status,
              o.totals.total,
              o.createdAt,
            ]),
          );
        hasNext = result.meta.hasNext;
        page++;
      }
      res.end();
    }),
    exportProducts: asyncHandler(async (req, res) => {
      const q = query<ListQuery>(req);
      res.type('text/csv').attachment('products.csv');
      res.write(insight.csvRow(['Name', 'SKU', 'Status', 'Price (minor units)', 'Stock']));
      let page = 1;
      let hasNext = true;
      while (hasNext) {
        const result = await catalogue.listAdminProducts({ ...q, page, limit: 100 });
        for (const p of result.data)
          for (const v of p.variants)
            res.write(insight.csvRow([p.name, v.sku, p.status, v.price, v.stock]));
        hasNext = result.meta.hasNext;
        page++;
      }
      res.end();
    }),
  };
}
