import { Router } from 'express';
import multer from 'multer';
import type { Env } from '@api/config/env.js';
import { authenticate, requirePermission } from '@api/common/middleware/authenticate.js';
import { validate } from '@api/common/middleware/validate.js';
import { LocalStorageProvider } from '@api/common/providers/storage.provider.js';
import { adminController } from './admin.controller.js';
import * as s from './admin.schemas.js';
export const ADMIN_ENDPOINTS: readonly [string, string][] = [
  ['GET', '/products'],
  ['POST', '/products'],
  ['GET', '/products/000000000000000000000000'],
  ['PATCH', '/products/000000000000000000000000'],
  ['DELETE', '/products/000000000000000000000000'],
  ['POST', '/products/000000000000000000000000/duplicate'],
  ['PATCH', '/products/000000000000000000000000/variants/000000000000000000000000'],
  ['POST', '/products/000000000000000000000000/variants/000000000000000000000000/stock'],
  ['GET', '/inventory'],
  ['GET', '/inventory/movements'],
  ['GET', '/categories'],
  ['POST', '/categories'],
  ['PATCH', '/categories/000000000000000000000000'],
  ['DELETE', '/categories/000000000000000000000000'],
  ['POST', '/uploads/images'],
  ['GET', '/orders'],
  ['GET', '/orders/000000000000000000000000'],
  ['POST', '/orders/000000000000000000000000/notes'],
  ['GET', '/customers'],
  ['GET', '/customers/000000000000000000000000'],
  ['PATCH', '/customers/000000000000000000000000'],
  ['GET', '/discounts'],
  ['POST', '/discounts'],
  ['GET', '/discounts/000000000000000000000000'],
  ['PATCH', '/discounts/000000000000000000000000'],
  ['DELETE', '/discounts/000000000000000000000000'],
  ['GET', '/settings'],
  ['PUT', '/settings'],
  ['GET', '/dashboard/summary'],
  ['GET', '/analytics/revenue'],
  ['GET', '/analytics/top-products'],
  ['GET', '/analytics/categories'],
  ['GET', '/analytics/customers'],
  ['GET', '/analytics/discounts'],
  ['GET', '/export/orders.csv'],
  ['GET', '/export/products.csv'],
];
export function createAdminRouter(config: Env) {
  const r = Router();
  r.use(authenticate(config), requirePermission('admin'));
  const c = adminController(new LocalStorageProvider(config.UPLOAD_DIR));
  r.get('/products', validate({ query: s.productListQuery }), c.products);
  r.post('/products', validate({ body: s.productSchema, query: s.empty }), c.createProduct);
  r.get('/products/:id', validate({ params: s.idParams, query: s.empty }), c.product);
  r.patch(
    '/products/:id',
    validate({ params: s.idParams, body: s.productPatchSchema, query: s.empty }),
    c.updateProduct,
  );
  r.delete('/products/:id', validate({ params: s.idParams, query: s.empty }), c.deleteProduct);
  r.post(
    '/products/:id/duplicate',
    validate({ params: s.idParams, body: s.empty, query: s.empty }),
    c.duplicate,
  );
  r.patch(
    '/products/:id/variants/:vid',
    validate({ params: s.variantParams, body: s.variantPatchSchema, query: s.empty }),
    c.variant,
  );
  r.post(
    '/products/:id/variants/:vid/stock',
    validate({ params: s.variantParams, body: s.stockSchema, query: s.empty }),
    c.stock,
  );
  r.get('/inventory', validate({ query: s.inventoryQuery }), c.inventory);
  r.get('/inventory/movements', validate({ query: s.inventoryQuery }), c.movements);
  r.get('/categories', validate({ query: s.categoryListQuery }), c.categories);
  r.post('/categories', validate({ body: s.categorySchema, query: s.empty }), c.createCategory);
  r.patch(
    '/categories/:id',
    validate({ params: s.idParams, body: s.categoryPatchSchema, query: s.empty }),
    c.updateCategory,
  );
  r.delete('/categories/:id', validate({ params: s.idParams, query: s.empty }), c.deleteCategory);
  r.post(
    '/uploads/images',
    validate({ query: s.empty }),
    multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024, files: 10, fields: 0 },
    }).array('images', 10),
    c.uploads,
  );
  r.get('/orders', validate({ query: s.orderListQuery }), c.orders);
  r.get('/orders/:id', validate({ params: s.idParams, query: s.empty }), c.order);
  r.post(
    '/orders/:id/notes',
    validate({ params: s.idParams, body: s.noteSchema, query: s.empty }),
    c.note,
  );
  r.get('/customers', validate({ query: s.customerListQuery }), c.customers);
  r.get('/customers/:id', validate({ params: s.idParams, query: s.empty }), c.customer);
  r.patch(
    '/customers/:id',
    validate({ params: s.idParams, body: s.customerSchema, query: s.empty }),
    c.updateCustomer,
  );
  r.get('/discounts', validate({ query: s.discountListQuery }), c.discounts);
  r.post('/discounts', validate({ body: s.discountSchema, query: s.empty }), c.createDiscount);
  r.get('/discounts/:id', validate({ params: s.idParams, query: s.empty }), c.discount);
  r.patch(
    '/discounts/:id',
    validate({ params: s.idParams, body: s.discountSchema, query: s.empty }),
    c.updateDiscount,
  );
  r.delete('/discounts/:id', validate({ params: s.idParams, query: s.empty }), c.deleteDiscount);
  r.get('/settings', validate({ query: s.empty }), c.settings);
  r.put('/settings', validate({ body: s.settingsSchema, query: s.empty }), c.saveSettings);
  r.get('/dashboard/summary', validate({ query: s.dashboardQuery }), c.dashboard);
  r.get('/analytics/revenue', validate({ query: s.analyticsQuery }), c.revenue);
  r.get('/analytics/top-products', validate({ query: s.analyticsQuery }), c.topProducts);
  r.get('/analytics/categories', validate({ query: s.analyticsQuery }), c.analyticsCategories);
  r.get('/analytics/customers', validate({ query: s.analyticsQuery }), c.analyticsCustomers);
  r.get('/analytics/discounts', validate({ query: s.analyticsQuery }), c.analyticsDiscounts);
  r.get('/export/orders.csv', validate({ query: s.orderListQuery }), c.exportOrders);
  r.get('/export/products.csv', validate({ query: s.productListQuery }), c.exportProducts);
  return r;
}
