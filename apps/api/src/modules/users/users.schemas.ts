import { z } from 'zod';
import { passwordSchema } from '@api/modules/auth/password-policy.js';

export const profileSchema = z
  .strictObject({
    firstName: z.string().trim().min(1).max(60).optional(),
    lastName: z.string().trim().min(1).max(60).optional(),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[1-9]\d{6,14}$/)
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');

export const changePasswordSchema = z.strictObject({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

export const addressSchema = z.strictObject({
  label: z.string().trim().min(1).max(50),
  fullName: z.string().trim().min(1).max(120),
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1).max(100),
  region: z.string().trim().min(1).max(100),
  postalCode: z.string().trim().min(1).max(30),
  country: z
    .string()
    .trim()
    .length(2)
    .transform((value) => value.toUpperCase()),
  phone: z.string().trim().min(1).max(30),
  isDefault: z.boolean().optional(),
});
export const updateAddressSchema = addressSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');
export const addressParamsSchema = z.strictObject({ id: z.string().regex(/^[a-f\d]{24}$/i) });

export type ProfileInput = z.infer<typeof profileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type AddressInput = z.infer<typeof addressSchema>;
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>;
