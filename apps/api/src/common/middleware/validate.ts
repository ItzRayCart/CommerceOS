import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { ValidationError } from '@api/common/errors/app-error.js';

export interface ValidationSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

export function validate(schemas: ValidationSchemas): RequestHandler {
  return (request, _response, next) => {
    const parsed: Record<string, unknown> = {};
    for (const key of ['body', 'query', 'params'] as const) {
      const schema = schemas[key];
      if (!schema) continue;
      const result = schema.safeParse(request[key]);
      if (!result.success) {
        next(
          new ValidationError(
            result.error.issues.map((issue) => ({
              path: issue.path.join('.'),
              message: issue.message,
            })),
          ),
        );
        return;
      }
      parsed[key] = result.data;
    }
    request.validated = parsed;
    next();
  };
}
