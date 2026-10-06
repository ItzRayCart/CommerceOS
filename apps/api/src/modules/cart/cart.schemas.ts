import { z } from 'zod';
const id = z.string().regex(/^[a-f\d]{24}$/i, 'Select a valid product or variant');
export const quantitySchema = z
  .number()
  .int('Quantity must be a whole number')
  .min(1)
  .max(10, 'Choose at most 10 units');
export const cartItemSchema = z
  .object({ productId: id, variantId: id, quantity: quantitySchema })
  .strict();
export const cartItemsSchema = z.object({ items: z.array(cartItemSchema).max(200) }).strict();
export const cartItemParams = z.object({ itemId: id }).strict();
export const discountSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{3,32}$/, 'Enter a valid discount code'),
  })
  .strict();
export type CartInput = z.infer<typeof cartItemSchema>;
