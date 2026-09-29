import type { RequestHandler } from 'express';
import { BadRequestError } from '@api/common/errors/app-error.js';

function containsUnsafeKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsUnsafeKey);
  if (value === null || typeof value !== 'object') return false;
  return Object.entries(value).some(
    ([key, nested]) => key.startsWith('$') || key.includes('.') || containsUnsafeKey(nested),
  );
}

export const rejectNoSqlOperators: RequestHandler = (request, _response, next) => {
  if (containsUnsafeKey(request.body) || containsUnsafeKey(request.query)) {
    next(new BadRequestError('Unsafe field name'));
    return;
  }
  next();
};
