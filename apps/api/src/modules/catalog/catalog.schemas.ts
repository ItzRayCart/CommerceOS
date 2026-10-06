import { z } from 'zod';

const bool = z.enum(['true', 'false']).transform((value) => value === 'true');
const query = z
  .strictObject({
    q: z.string().trim().min(1).max(100).optional(),
    category: z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .optional(),
    minPrice: z.coerce.number().int().min(0).optional(),
    maxPrice: z.coerce.number().int().min(0).optional(),
    inStock: bool.optional(),
    rating: z.coerce.number().min(0).max(5).optional(),
    featured: bool.optional(),
    tags: z.string().trim().min(1).max(50).optional(),
    options: z
      .record(z.string().regex(/^[A-Za-z][A-Za-z0-9 -]{0,39}$/), z.string().max(80))
      .optional(),
    sort: z
      .enum(['relevance', '-createdAt', 'price', '-price', '-soldCount', '-ratingAverage', 'name'])
      .optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(12),
    includeFacets: bool.optional(),
  })
  .refine(
    (value) =>
      value.minPrice === undefined ||
      value.maxPrice === undefined ||
      value.minPrice <= value.maxPrice,
    {
      path: ['maxPrice'],
      message: 'Must be greater than or equal to minPrice',
    },
  )
  .refine((value) => value.sort !== 'relevance' || !!value.q, {
    path: ['sort'],
    message: 'Relevance sort requires a search query',
  });

export const productQuerySchema = z.preprocess((value: unknown) => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return value;
  const raw = { ...(value as Record<string, unknown>) };
  const options: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(raw)) {
    const match = /^options\[([^\]]+)\]$/.exec(key);
    if (match?.[1]) {
      options[match[1]] = item;
      delete raw[key];
    }
  }
  if (Object.keys(options).length)
    raw['options'] = {
      ...(typeof raw['options'] === 'object' && raw['options'] !== null ? raw['options'] : {}),
      ...options,
    };
  return raw;
}, query);
export const slugParamsSchema = z.strictObject({ slug: z.string().regex(/^[a-z0-9-]+$/) });
export const suggestQuerySchema = z.strictObject({ q: z.string().trim().min(2).max(100) });
export const emptyQuerySchema = z.strictObject({});

export type ProductQuery = z.infer<typeof query>;
