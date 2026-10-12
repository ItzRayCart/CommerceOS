import { readFileSync, writeFileSync } from 'node:fs';
import { parse, stringify } from 'yaml';
import { z } from 'zod';
import * as s from '../src/modules/admin/admin.schemas.js';
const path = 'docs/openapi.yaml';
const doc = parse(readFileSync(path, 'utf8'), { maxAliasCount: -1 }) as {
  paths: Record<string, Record<string, unknown>>;
  components: { schemas: Record<string, unknown> };
};
const schemas: Record<string, z.ZodType> = {
  AdminProductInput: s.productSchema,
  AdminProductPatch: s.productPatchSchema,
  AdminCategoryInput: s.categorySchema,
  AdminCategoryPatch: s.categoryPatchSchema,
  AdminVariantPatch: s.variantPatchSchema,
  StockAdjustment: s.stockSchema,
  AdminNoteInput: s.noteSchema,
  AdminRefundInput: s.refundSchema,
  AdminCustomerPatch: s.customerSchema,
  AdminDiscountInput: s.discountSchema,
  AdminSettings: s.settingsSchema,
};
for (const [name, schema] of Object.entries(schemas))
  doc.components.schemas[name] = z.toJSONSchema(schema, { io: 'input' });
const string = { type: 'string' },
  number = { type: 'integer' },
  bool = { type: 'boolean' };
const obj = (properties: Record<string, unknown>, required = Object.keys(properties)) => ({
  type: 'object',
  properties,
  required,
});
const arr = (items: unknown) => ({ type: 'array', items });
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
doc.components.schemas['AdminProduct'] = obj({
  id: string,
  ...(doc.components.schemas['AdminProductInput'] as { properties: Record<string, unknown> })
    .properties,
  minPrice: number,
  totalStock: number,
  createdAt: { type: 'string', format: 'date-time' },
  updatedAt: { type: 'string', format: 'date-time' },
});
doc.components.schemas['AdminCategory'] = obj({
  id: string,
  name: string,
  slug: string,
  parentId: { type: ['string', 'null'] },
  description: string,
  image: string,
  sortOrder: number,
  isActive: bool,
});
doc.components.schemas['InventoryRow'] = obj({
  productId: string,
  name: string,
  variantId: string,
  sku: string,
  stock: number,
  lowStockThreshold: number,
  price: number,
  isActive: bool,
});
doc.components.schemas['StockMovement'] = obj({
  id: string,
  productId: string,
  variantId: string,
  sku: string,
  delta: number,
  stockAfter: number,
  reason: string,
  note: string,
  by: string,
  createdAt: { type: 'string', format: 'date-time' },
});
doc.components.schemas['AdminCustomer'] = obj(
  {
    id: string,
    email: string,
    firstName: string,
    lastName: string,
    role: { enum: ['customer', 'admin'] },
    status: { enum: ['active', 'disabled'] },
    createdAt: string,
    stats: obj({ orderCount: number, totalSpent: number, lastOrderAt: string }, [
      'orderCount',
      'totalSpent',
    ]),
    addresses: arr(
      obj({ fullName: string, line1: string, city: string, country: string, phone: string }),
    ),
    lifetimeValue: number,
  },
  ['id', 'email', 'firstName', 'lastName', 'role', 'status', 'createdAt', 'stats', 'addresses'],
);
doc.components.schemas['AdminOrder'] = {
  allOf: [
    ref('Order'),
    obj({
      customer: obj({ id: string, name: string, email: string }),
      internalNotes: arr(obj({ text: string, by: string, at: string })),
    }),
  ],
};
doc.components.schemas['AdminDiscount'] = obj(
  {
    id: string,
    ...(doc.components.schemas['AdminDiscountInput'] as { properties: Record<string, unknown> })
      .properties,
    usedCount: number,
    status: { enum: ['active', 'scheduled', 'expired', 'exhausted', 'disabled'] },
    redemptions: number,
    discounted: number,
  },
  [
    'id',
    'code',
    'type',
    'value',
    'minSubtotal',
    'usedCount',
    'perUserLimit',
    'appliesTo',
    'isActive',
    'status',
  ],
);
const metric = obj({ value: number, previous: number, delta: { type: ['number', 'null'] } });
doc.components.schemas['RevenuePoint'] = obj({
  date: string,
  revenue: number,
  orders: number,
  aov: number,
});
doc.components.schemas['ProductMetric'] = obj({
  productId: string,
  name: string,
  revenue: number,
  units: number,
});
doc.components.schemas['NamedMetric'] = obj({ name: string, revenue: number, units: number });
doc.components.schemas['CustomerMetrics'] = obj({
  newCustomers: number,
  returningCustomers: number,
  series: arr(obj({ date: string, count: number })),
});
doc.components.schemas['DiscountMetric'] = obj({
  code: string,
  redemptions: number,
  discounted: number,
});
doc.components.schemas['DashboardSummary'] = obj({
  revenue: metric,
  orders: metric,
  customers: metric,
  aov: metric,
  statusCounts: arr(obj({ status: string, count: number })),
  revenueSeries: arr(ref('RevenuePoint')),
  topProducts: arr(ref('ProductMetric')),
  lowStock: arr(ref('InventoryRow')),
  recentOrders: arr(ref('AdminOrder')),
  inventory: obj({ totalSkus: number, out: number, low: number, value: number }),
});
function route(
  method: string,
  url: string,
  summary: string,
  responseSchema: string,
  options: {
    body?: string;
    query?: z.ZodType;
    list?: boolean;
    created?: boolean;
    deleted?: boolean;
    csv?: boolean;
    upload?: boolean;
    unpaged?: boolean;
  } = {},
) {
  const parameters: unknown[] = [];
  for (const match of url.matchAll(/\{(\w+)\}/g))
    parameters.push({
      in: 'path',
      name: match[1],
      required: true,
      schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
    });
  if (options.query) {
    const schema = z.toJSONSchema(options.query, { io: 'input' }) as {
      properties?: Record<string, unknown>;
    };
    for (const [name, v] of Object.entries(schema.properties ?? {}))
      parameters.push({ in: 'query', name, required: false, schema: v });
  }
  const response = options.list ? arr(ref(responseSchema)) : ref(responseSchema);
  const envelope = obj({
    data: response,
    ...(options.list && !options.unpaged ? { meta: ref('PaginationMeta') } : {}),
  });
  const operation: Record<string, unknown> = {
    tags: ['Admin'],
    summary,
    security: [{ bearerAuth: [] }],
    parameters,
    responses: {
      [options.deleted ? '204' : options.created ? '201' : '200']: options.deleted
        ? { description: 'Deleted' }
        : {
            description: 'Success',
            content: {
              [options.csv ? 'text/csv' : 'application/json']: {
                schema: options.csv ? string : envelope,
              },
            },
          },
      ...Object.fromEntries(
        ['400', '401', '403', '404', '409', '422', '429', '500'].map((status) => [
          status,
          {
            description: 'Standard error envelope',
            content: { 'application/json': { schema: ref('Error') } },
          },
        ]),
      ),
    },
  };
  if (options.body)
    operation.requestBody = {
      required: true,
      content: { 'application/json': { schema: ref(options.body) } },
    };
  if (options.upload)
    operation.requestBody = {
      required: true,
      content: {
        'multipart/form-data': {
          schema: obj({
            images: {
              type: 'array',
              minItems: 1,
              maxItems: 10,
              items: { type: 'string', format: 'binary' },
            },
          }),
        },
      },
    };
  doc.paths[url] = { ...doc.paths[url], [method]: operation };
}
route('get', '/admin/products', 'Search and filter products', 'AdminProduct', {
  query: s.productListQuery,
  list: true,
});
route('post', '/admin/products', 'Create product and stock movements', 'AdminProduct', {
  body: 'AdminProductInput',
  created: true,
});
route('get', '/admin/products/{id}', 'Editable product', 'AdminProduct');
route(
  'patch',
  '/admin/products/{id}',
  'Edit product; rejects stale editor revisions',
  'AdminProduct',
  { body: 'AdminProductPatch' },
);
route(
  'delete',
  '/admin/products/{id}',
  'Delete never-ordered product; otherwise archive',
  'AdminProduct',
  { deleted: true },
);
route(
  'post',
  '/admin/products/{id}/duplicate',
  'Duplicate as draft with new SKUs and zero stock',
  'AdminProduct',
  { created: true },
);
route('patch', '/admin/products/{id}/variants/{vid}', 'Edit a variant', 'AdminProduct', {
  body: 'AdminVariantPatch',
});
route(
  'post',
  '/admin/products/{id}/variants/{vid}/stock',
  'Atomic stock adjustment and audit',
  'AdminProduct',
  { body: 'StockAdjustment' },
);
route('get', '/admin/inventory', 'Variant inventory with low/out filters', 'InventoryRow', {
  query: s.inventoryQuery,
  list: true,
});
route('get', '/admin/inventory/movements', 'Append-only stock movement history', 'StockMovement', {
  query: s.inventoryQuery,
  list: true,
});
route('get', '/admin/categories', 'Admin categories', 'AdminCategory', {
  query: s.categoryListQuery,
  list: true,
});
route('post', '/admin/categories', 'Create category', 'AdminCategory', {
  body: 'AdminCategoryInput',
  created: true,
});
route('patch', '/admin/categories/{id}', 'Edit category', 'AdminCategory', {
  body: 'AdminCategoryPatch',
});
route('delete', '/admin/categories/{id}', 'Delete empty category', 'AdminCategory', {
  deleted: true,
});
doc.components.schemas['UploadedImage'] = obj({ url: string });
route(
  'post',
  '/admin/uploads/images',
  'Upload verified JPEG/PNG/WebP; 5MB each, maximum 10',
  'UploadedImage',
  { upload: true, list: true, unpaged: true, created: true },
);
route(
  'get',
  '/admin/orders',
  'Order list; statusCounts in meta respect search/date filters',
  'AdminOrder',
  { query: s.orderListQuery, list: true },
);
route('get', '/admin/orders/{id}', 'Admin order with customer and internal notes', 'AdminOrder');
route('post', '/admin/orders/{id}/notes', 'Append internal note', 'AdminOrder', {
  body: 'AdminNoteInput',
  created: true,
});
route('post', '/admin/orders/{id}/refund', 'Refund with optional transactional restock', 'Order', {
  body: 'AdminRefundInput',
});
route('get', '/admin/customers', 'Search and sort joined/orders/spent', 'AdminCustomer', {
  query: s.customerListQuery,
  list: true,
});
route('get', '/admin/customers/{id}', 'Customer profile and lifetime value', 'AdminCustomer');
route(
  'patch',
  '/admin/customers/{id}',
  'Role/status mutation with self and last-admin protection',
  'AdminCustomer',
  { body: 'AdminCustomerPatch' },
);
route('get', '/admin/discounts', 'Discount list with computed statuses', 'AdminDiscount', {
  query: s.discountListQuery,
  list: true,
});
route('post', '/admin/discounts', 'Create discount', 'AdminDiscount', {
  body: 'AdminDiscountInput',
  created: true,
});
route('get', '/admin/discounts/{id}', 'Discount and redemption totals', 'AdminDiscount');
route(
  'patch',
  '/admin/discounts/{id}',
  'Replace editable discount rules; code immutable',
  'AdminDiscount',
  { body: 'AdminDiscountInput' },
);
route(
  'delete',
  '/admin/discounts/{id}',
  'Delete discount; retain historical redemptions',
  'AdminDiscount',
  { deleted: true },
);
route('get', '/admin/settings', 'Full store settings', 'AdminSettings');
route('put', '/admin/settings', 'Replace store settings', 'AdminSettings', {
  body: 'AdminSettings',
});
route(
  'get',
  '/admin/dashboard/summary',
  'Period KPI comparisons and inventory summary',
  'DashboardSummary',
  { query: s.dashboardQuery },
);
route('get', '/admin/analytics/revenue', 'UTC revenue/orders/AOV series', 'RevenuePoint', {
  query: s.analyticsQuery,
  list: true,
  unpaged: true,
});
route('get', '/admin/analytics/top-products', 'Product revenue and units', 'ProductMetric', {
  query: s.analyticsQuery,
  list: true,
});
route('get', '/admin/analytics/categories', 'Category sales', 'NamedMetric', {
  query: s.analyticsQuery,
  list: true,
});
route(
  'get',
  '/admin/analytics/customers',
  'New and returning customer acquisition',
  'CustomerMetrics',
  { query: s.analyticsQuery },
);
route('get', '/admin/analytics/discounts', 'Discount redemption aggregates', 'DiscountMetric', {
  query: s.analyticsQuery,
  list: true,
});
route('get', '/admin/export/orders.csv', 'Filtered order CSV; formula-safe cells', 'AdminOrder', {
  query: s.orderListQuery,
  csv: true,
});
route(
  'get',
  '/admin/export/products.csv',
  'Filtered product/variant CSV; formula-safe cells',
  'AdminProduct',
  { query: s.productListQuery, csv: true },
);
writeFileSync(path, stringify(doc, { lineWidth: 100, aliasDuplicateObjects: false }));
