import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';
import { z } from 'zod';

const booleanFromString = z.enum(['true', 'false']).transform((value) => value === 'true');

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    MONGODB_URI: z.string().url().startsWith('mongodb://'),
    JWT_ACCESS_SECRET: z
      .preprocess((value) => (value === '' ? undefined : value), z.string().min(32).optional())
      .transform((value) => value ?? randomBytes(32).toString('hex')),
    JWT_ACCESS_TTL: z.string().default('15m'),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
    COOKIE_SECURE: booleanFromString.default(false),
    CORS_ORIGINS: z.string().default('http://localhost:4200'),
    WEB_BASE_URL: z.string().url().default('http://localhost:4200'),
    MAIL_TRANSPORT: z.enum(['console', 'smtp']).default('console'),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    UPLOAD_DIR: z.string().default('./uploads'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  })
  .superRefine((value, context) => {
    if (value.NODE_ENV === 'production' && !value.COOKIE_SECURE) {
      context.addIssue({
        code: 'custom',
        path: ['COOKIE_SECURE'],
        message: 'Must be true in production',
      });
    }
    if (value.NODE_ENV === 'production' && value.MAIL_TRANSPORT !== 'smtp') {
      context.addIssue({
        code: 'custom',
        path: ['MAIL_TRANSPORT'],
        message: 'SMTP is required in production',
      });
    }
    if (value.MAIL_TRANSPORT === 'smtp' && (!value.SMTP_HOST || !value.SMTP_PORT)) {
      context.addIssue({
        code: 'custom',
        path: ['SMTP_HOST'],
        message: 'SMTP host and port required',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function readEnv(): Env {
  const localEnvFile = resolve(process.cwd(), '../../.env');
  if (existsSync(localEnvFile)) loadEnvFile(localEnvFile);
  if (process.env['NODE_ENV'] === 'production' && !process.env['JWT_ACCESS_SECRET']) {
    throw new Error('JWT_ACCESS_SECRET is required in production');
  }
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(`Invalid environment: ${z.prettifyError(result.error)}`);
  }
  return result.data;
}
