import { z } from 'zod';
import { passwordSchema } from '@api/modules/auth/password-policy.js';

const email = z
  .email()
  .max(254)
  .transform((value) => value.trim().toLowerCase());
const token = z.string().min(20).max(256);

export const registerSchema = z.strictObject({
  email,
  password: passwordSchema,
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  role: z.unknown().optional(),
});
export const loginSchema = z.strictObject({ email, password: z.string().min(1) });
export const emptySchema = z.strictObject({});
export const optionalEmptyBodySchema = z.preprocess(
  (value) => (value === undefined ? {} : value),
  emptySchema,
);
export const forgotPasswordSchema = z.strictObject({ email });
export const resetPasswordSchema = z.strictObject({ token, password: passwordSchema });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
