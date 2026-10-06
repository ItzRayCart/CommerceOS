import { z } from 'zod';
export const empty = z.strictObject({});
export const expectedUpdatedAt = z.iso.datetime().optional();
export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');
export const idParams = z.strictObject({ id: objectId });
export const variantParams = z.strictObject({ id: objectId, vid: objectId });
const money = z.number().int().min(0).max(100_000_000_000);
const text = z.string().trim().min(1).max(1000);
export const localImage = z
  .string()
  .regex(/^\/(?:uploads|assets)\/[a-zA-Z0-9/_-]+\.(?:jpg|jpeg|png|webp|svg)$/);
const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(160);
export const pageFields = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};
export const listQuery = z.strictObject({
  ...pageFields,
  q: z.string().trim().max(100).optional(),
  status: z.string().max(32).optional(),
  category: objectId.optional(),
  stock: z.enum(['low', 'out']).optional(),
  sort: z
    .enum([
      'name',
      '-name',
      '-createdAt',
      'createdAt',
      'minPrice',
      '-minPrice',
      'joined',
      '-joined',
      'orders',
      '-orders',
      'spent',
      '-spent',
    ])
    .default('-createdAt'),
});
export const productListQuery = listQuery.extend({
  status: z.enum(['draft', 'active', 'archived']).optional(),
  sort: z
    .enum(['name', '-name', 'createdAt', '-createdAt', 'minPrice', '-minPrice'])
    .default('-createdAt'),
});
export const customerListQuery = listQuery.omit({ category: true, stock: true }).extend({
  status: z.enum(['active', 'disabled']).optional(),
  sort: z
    .enum([
      'name',
      '-name',
      'createdAt',
      '-createdAt',
      'joined',
      '-joined',
      'orders',
      '-orders',
      'spent',
      '-spent',
    ])
    .default('-createdAt'),
});
export const discountListQuery = listQuery.omit({ category: true, stock: true }).extend({
  status: z.enum(['active', 'scheduled', 'expired', 'exhausted', 'disabled']).optional(),
  sort: z.literal('name').default('name'),
});
export const categoryListQuery = listQuery
  .pick({ page: true, limit: true, sort: true })
  .extend({ sort: z.literal('name').default('name') });
export const inventoryQuery = z.strictObject({
  ...pageFields,
  q: z.string().max(100).optional(),
  low: z.enum(['true', 'false']).optional(),
  out: z.enum(['true', 'false']).optional(),
  variantId: objectId.optional(),
});
export const categorySchema = z.strictObject({
  name: z.string().trim().min(2).max(100),
  slug: slug.optional(),
  parentId: objectId.nullable().optional(),
  description: z.string().max(1000).default(''),
  image: z.union([localImage, z.literal('')]).default(''),
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});
export const variantSchema = z.strictObject({
  id: objectId.optional(),
  sku: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_-]{2,80}$/),
  options: z.record(z.string().min(1).max(50), z.string().min(1).max(80)).default({}),
  price: money,
  compareAtPrice: money.optional(),
  stock: z.number().int().min(0).max(1_000_000),
  lowStockThreshold: z.number().int().min(0).max(1_000_000).optional(),
  isActive: z.boolean().default(true),
  images: z.array(localImage).max(10).default([]),
  weightGrams: z.number().int().min(0).max(1_000_000).optional(),
});
export const productSchema = z.strictObject({
  name: z.string().trim().min(2).max(140),
  slug: slug.optional(),
  description: z.string().min(1).max(30000),
  brand: z.string().trim().max(100).optional(),
  category: objectId,
  tags: z.array(z.string().trim().toLowerCase().min(1).max(50)).max(20).default([]),
  images: z
    .array(z.strictObject({ url: localImage, alt: text, isPrimary: z.boolean() }))
    .max(10)
    .default([]),
  specs: z
    .array(z.strictObject({ label: z.string().min(1).max(100), value: text }))
    .max(100)
    .default([]),
  optionDefinitions: z
    .array(
      z.strictObject({
        name: z.string().trim().min(1).max(50),
        values: z.array(z.string().trim().min(1).max(80)).min(1).max(20),
      }),
    )
    .max(3)
    .default([]),
  variants: z.array(variantSchema).min(1).max(8000),
  status: z.enum(['draft', 'active', 'archived']).default('draft'),
  isFeatured: z.boolean().default(false),
  seo: z
    .strictObject({
      metaTitle: z.string().max(140).optional(),
      metaDescription: z.string().max(320).optional(),
    })
    .default({}),
});
export const stockSchema = z.strictObject({
  delta: z
    .number()
    .int()
    .min(-1_000_000)
    .max(1_000_000)
    .refine((v) => v !== 0, 'Enter a non-zero adjustment'),
  reason: z.enum(['manual_adjustment', 'restock']),
  note: z.string().trim().min(1).max(1000),
});
export const productPatchSchema = productSchema.partial().extend({
  expectedUpdatedAt,
  tags: productSchema.shape.tags.removeDefault().optional(),
  images: productSchema.shape.images.removeDefault().optional(),
  specs: productSchema.shape.specs.removeDefault().optional(),
  optionDefinitions: productSchema.shape.optionDefinitions.removeDefault().optional(),
  status: productSchema.shape.status.removeDefault().optional(),
  isFeatured: productSchema.shape.isFeatured.removeDefault().optional(),
  seo: productSchema.shape.seo.removeDefault().optional(),
});
export const variantPatchSchema = variantSchema.partial().extend({
  options: variantSchema.shape.options.removeDefault().optional(),
  isActive: variantSchema.shape.isActive.removeDefault().optional(),
  images: variantSchema.shape.images.removeDefault().optional(),
});
export const categoryPatchSchema = categorySchema.partial().extend({
  description: categorySchema.shape.description.removeDefault().optional(),
  image: categorySchema.shape.image.removeDefault().optional(),
  sortOrder: categorySchema.shape.sortOrder.removeDefault().optional(),
  isActive: categorySchema.shape.isActive.removeDefault().optional(),
});
const date = z.iso.datetime().transform((v) => new Date(v));
export const orderListQuery = z.strictObject({
  ...pageFields,
  status: z.enum(['pending', 'paid', 'shipped', 'completed', 'cancelled', 'refunded']).optional(),
  q: z.string().max(100).optional(),
  from: date.optional(),
  to: date.optional(),
  sort: z.enum(['createdAt', '-createdAt']).default('-createdAt'),
});
export const noteSchema = z.strictObject({ text });
export const refundSchema = z.strictObject({ restock: z.boolean() });
export const customerSchema = z
  .strictObject({
    role: z.enum(['admin', 'customer']).optional(),
    status: z.enum(['active', 'disabled']).optional(),
  })
  .refine((v) => v.role !== undefined || v.status !== undefined, 'Choose a change');
export const discountSchema = z
  .strictObject({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{3,32}$/),
    description: z.string().max(1000).default(''),
    type: z.enum(['percentage', 'fixed']),
    value: z.number().int().min(1).max(100_000_000_000),
    minSubtotal: money.default(0),
    maxDiscount: money.optional(),
    startsAt: date.optional(),
    expiresAt: date.optional(),
    usageLimit: z.number().int().min(0).optional(),
    perUserLimit: z.number().int().min(1).max(1000).default(1),
    appliesTo: z
      .strictObject({
        categories: z.array(objectId).max(100),
        products: z.array(objectId).max(100),
      })
      .default({ categories: [], products: [] }),
    isActive: z.boolean().default(true),
  })
  .superRefine((v, c) => {
    if (v.type === 'percentage' && v.value > 100)
      c.addIssue({ code: 'custom', path: ['value'], message: 'Percentage must be 1–100' });
    if (v.type === 'fixed' && v.maxDiscount !== undefined)
      c.addIssue({
        code: 'custom',
        path: ['maxDiscount'],
        message: 'A cap applies only to percentage codes',
      });
    if (v.startsAt && v.expiresAt && v.startsAt >= v.expiresAt)
      c.addIssue({ code: 'custom', path: ['expiresAt'], message: 'Expiry must follow start date' });
  });
export const settingsSchema = z
  .strictObject({
    store: z.strictObject({
      name: z.string().trim().min(1).max(100),
      tagline: z.string().max(200),
      logoUrl: z.union([localImage, z.literal('')]),
      supportEmail: z.email(),
      phone: z.string().max(40),
      address: z.string().max(500),
      announcement: z.string().max(300),
      valueProps: z
        .array(z.strictObject({ title: z.string().min(1).max(100), text: z.string().max(500) }))
        .max(10),
    }),
    currency: z.strictObject({
      code: z
        .string()
        .regex(/^[A-Z]{3}$/)
        .refine((v) => {
          try {
            new Intl.NumberFormat('en', { style: 'currency', currency: v });
            return Intl.supportedValuesOf('currency').includes(v);
          } catch {
            return false;
          }
        }, 'Unknown currency'),
      symbol: z.string().min(1).max(10),
      decimals: z.number().int().min(0).max(3),
    }),
    tax: z.strictObject({ ratePercent: z.number().min(0).max(100), inclusive: z.literal(false) }),
    shipping: z.strictObject({
      methods: z
        .array(
          z.strictObject({
            code: slug,
            label: z.string().min(1).max(100),
            price: money,
            freeOverSubtotal: money.optional(),
            estimatedDays: z.number().int().min(1).max(365),
            isActive: z.boolean(),
          }),
        )
        .min(1)
        .max(20),
    }),
    inventory: z.strictObject({ lowStockThreshold: z.number().int().min(0).max(1_000_000) }),
    theme: z.strictObject({
      primary: z.string().regex(/^#[a-f\d]{6}$/i),
      accent: z.string().regex(/^#[a-f\d]{6}$/i),
    }),
    orderNumberPrefix: z.string().regex(/^[A-Z0-9]{2,8}$/),
    features: z.strictObject({ reviews: z.boolean(), wishlist: z.boolean() }),
  })
  .superRefine((v, c) => {
    if (!v.shipping.methods.some((m) => m.isActive))
      c.addIssue({
        code: 'custom',
        path: ['shipping', 'methods'],
        message: 'Enable at least one shipping method',
      });
    if (new Set(v.shipping.methods.map((m) => m.code)).size !== v.shipping.methods.length)
      c.addIssue({
        code: 'custom',
        path: ['shipping', 'methods'],
        message: 'Shipping codes must be unique',
      });
  });
export const dashboardQuery = z.strictObject({
  range: z.enum(['today', '7d', '30d']).default('30d'),
  chartDays: z.coerce
    .number()
    .pipe(z.union([z.literal(30), z.literal(90)]))
    .default(30),
});
export const analyticsQuery = z
  .strictObject({
    ...pageFields,
    from: date.optional(),
    to: date.optional(),
    granularity: z.enum(['day', 'week', 'month']).default('day'),
    sort: z.enum(['revenue', 'units']).default('revenue'),
  })
  .superRefine((v, c) => {
    if (v.from && v.to && (v.from > v.to || v.to.getTime() - v.from.getTime() > 366 * 86400000))
      c.addIssue({
        code: 'custom',
        path: ['to'],
        message: 'Choose a date range of at most one year',
      });
  });
export type ProductInput = z.infer<typeof productSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
export type ListQuery = z.infer<typeof listQuery>;
export type InventoryQuery = z.infer<typeof inventoryQuery>;
export type OrderListQuery = z.infer<typeof orderListQuery>;
export type DiscountInput = z.infer<typeof discountSchema>;
export type AnalyticsQuery = z.infer<typeof analyticsQuery>;
