import { z } from 'zod';
const id = z.string().regex(/^[a-f\d]{24}$/i);
export const checkoutAddressSchema = z.strictObject({
  fullName: z.string().trim().min(1).max(120),
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1).max(100),
  region: z.string().trim().min(1).max(100),
  postalCode: z.string().trim().min(1).max(30),
  country: z
    .string()
    .trim()
    .regex(/^[a-z]{2}$/i)
    .transform((v) => v.toUpperCase()),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[1-9]\d{6,14}$/, 'Enter an international phone number'),
});
const fields = {
  addressId: id.optional(),
  address: checkoutAddressSchema.optional(),
  shippingMethodCode: z.string().trim().min(1).max(50),
};
const addressChoice = (v: { addressId?: string | undefined; address?: unknown }) =>
  !!v.addressId !== !!v.address;
export const quoteSchema = z
  .strictObject(fields)
  .refine(addressChoice, 'Choose a saved address or enter a new address');
const paymentSchema = z
  .strictObject({
    method: z.enum(['card_mock', 'cod']),
    token: z.string().max(100).optional(),
    last4: z
      .string()
      .regex(/^\d{4}$/)
      .optional(),
  })
  .refine(
    (v) => (v.method === 'card_mock' ? !!v.token : !v.token && !v.last4),
    'Card payment requires a mock token; COD has no card details',
  );
// AC-CHK-05 explicitly requires recognising and discarding these tampering fields.
export const orderSchema = z
  .strictObject({
    ...fields,
    quoteFingerprint: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    payment: paymentSchema,
    prices: z.unknown().optional(),
    totals: z.unknown().optional(),
    price: z.unknown().optional(),
    total: z.unknown().optional(),
  })
  .refine(addressChoice, 'Choose a saved address or enter a new address')
  .transform(({ addressId, address, shippingMethodCode, payment, quoteFingerprint }) => ({
    addressId,
    address,
    shippingMethodCode,
    payment,
    quoteFingerprint,
  }));
export const orderParams = z.strictObject({
  orderNumber: z.string().regex(/^[A-Z0-9_-]{1,30}-\d{4}-\d{6,}$/),
});
export const orderQuery = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(12),
  status: z.enum(['pending', 'paid', 'shipped', 'completed', 'cancelled', 'refunded']).optional(),
});
export const idempotencySchema = z
  .string()
  .regex(
    /^[a-zA-Z0-9_-]{8,128}$/,
    'Supply an Idempotency-Key of 8–128 letters, digits, underscores or hyphens',
  );
export const adminParams = z.strictObject({ id });
export const statusSchema = z.strictObject({
  status: z.enum(['pending', 'paid', 'shipped', 'completed', 'cancelled', 'refunded']),
  note: z.string().trim().max(1000).optional(),
  tracking: z
    .strictObject({
      carrier: z.string().trim().min(1).max(100),
      number: z.string().trim().min(1).max(100),
    })
    .optional(),
  restock: z.boolean().optional(),
});
