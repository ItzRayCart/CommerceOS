import type { ErrorRequestHandler, RequestHandler } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { MulterError } from 'multer';
import { AppError, NotFoundError, ValidationError } from '@api/common/errors/app-error.js';

export const notFound: RequestHandler = (_request, _response, next) => {
  next(new NotFoundError());
};

export const errorHandler: ErrorRequestHandler = (error: unknown, request, response, _next) => {
  let mapped: AppError;
  if (error instanceof AppError) mapped = error;
  else if (error instanceof ZodError)
    mapped = new ValidationError(
      error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  else if (error instanceof MulterError)
    mapped = new AppError(400, 'BAD_REQUEST', 'Upload up to 10 images, at most 5 MB each.');
  else if (error instanceof mongoose.mongo.MongoServerError && error.code === 11000) {
    const keyPattern = error.keyPattern as Record<string, unknown> | undefined;
    const field = Object.keys(keyPattern ?? {})[0] ?? 'unknown';
    mapped = new AppError(409, 'CONFLICT', 'A unique value already exists', { field });
  } else if (error instanceof mongoose.Error.CastError)
    mapped = new AppError(400, 'BAD_REQUEST', 'Invalid identifier');
  else if (error instanceof mongoose.Error.ValidationError)
    mapped = new ValidationError(error.errors);
  else if (error instanceof SyntaxError && 'body' in error)
    mapped = new AppError(400, 'BAD_REQUEST', 'Malformed JSON');
  else mapped = new AppError(500, 'INTERNAL_ERROR', 'An unexpected error occurred');

  if (mapped.status >= 500) request.log.error({ err: error }, 'Request failed');
  response.status(mapped.status).json({
    error: {
      code: mapped.code,
      message: mapped.message,
      ...(mapped.details === undefined ? {} : { details: mapped.details }),
      requestId: request.id,
    },
  });
};
