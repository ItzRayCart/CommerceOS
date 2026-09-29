import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import type { Express } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import type { Logger } from 'pino';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { parse } from 'yaml';
import { errorHandler, notFound } from '@api/common/middleware/error-handler.js';
import { rejectNoSqlOperators } from '@api/common/middleware/reject-nosql.js';
import { asyncHandler } from '@api/common/middleware/async-handler.js';
import { pingDatabase } from '@api/config/db.js';
import type { Env } from '@api/config/env.js';
import { systemRouter } from '@api/modules/system/system.routes.js';
import { createAdminAuthRouter, createAuthRouter } from '@api/modules/auth/auth.routes.js';
import { createUsersRouter } from '@api/modules/users/users.routes.js';

const openApi = parse(readFileSync(resolve(process.cwd(), 'docs/openapi.yaml'), 'utf8')) as object;

export function createApp(config: Env, logger: Logger): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin: config.CORS_ORIGINS.split(',').map((origin) => origin.trim()),
      credentials: true,
    }),
  );
  app.use(
    pinoHttp({
      logger,
      genReqId: (request) => {
        const incoming = request.headers['x-request-id'];
        return typeof incoming === 'string' && incoming.length <= 100 ? incoming : randomUUID();
      },
      customSuccessMessage: () => 'Request completed',
    }),
  );
  app.use((request, response, next) => {
    response.setHeader('X-Request-Id', typeof request.id === 'string' ? request.id : randomUUID());
    next();
  });
  app.use(
    rateLimit({
      windowMs: 15 * 60_000,
      limit: 300,
      standardHeaders: 'draft-7',
      handler: (request, response) => {
        response.setHeader('Retry-After', '900');
        response.status(429).json({
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many requests',
            requestId: request.id,
          },
        });
      },
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(compression());
  app.use(rejectNoSqlOperators);
  app.use(['/api/v1/auth', '/api/v1/me'], (_request, response, next) => {
    response.setHeader('Cache-Control', 'no-store');
    next();
  });

  app.get(
    '/health',
    asyncHandler(async (_request, response) => {
      await pingDatabase();
      response.json({ data: { status: 'ok' } });
    }),
  );
  app.get('/api/docs/openapi.json', (_request, response) => response.json(openApi));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApi));
  app.use('/api/v1/auth', createAuthRouter(config, logger));
  app.use('/api/v1/admin/auth', createAdminAuthRouter(config));
  app.use('/api/v1/me', createUsersRouter(config));
  app.use('/api/v1/system', systemRouter);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
