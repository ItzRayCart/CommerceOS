import { Router } from 'express';
import type { Request, Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { Logger } from 'pino';
import { authenticate, requirePermission } from '@api/common/middleware/authenticate.js';
import { validate } from '@api/common/middleware/validate.js';
import { createMailProvider } from '@api/common/providers/mail.provider.js';
import type { Env } from '@api/config/env.js';
import { createAuthController } from '@api/modules/auth/auth.controller.js';
import {
  forgotPasswordSchema,
  emptySchema,
  loginSchema,
  optionalEmptyBodySchema,
  registerSchema,
  resetPasswordSchema,
} from '@api/modules/auth/auth.schemas.js';
import { createAuthService } from '@api/modules/auth/auth.service.js';

function rateLimitResponse(request: Request, response: Response): void {
  response.setHeader('Retry-After', '900');
  response.status(429).json({
    error: { code: 'RATE_LIMITED', message: 'Too many requests', requestId: request.id },
  });
}

export function createAuthRouter(config: Env, logger: Logger): Router {
  const router = Router();
  const service = createAuthService(config, createMailProvider(config, logger), logger);
  const controller = createAuthController(service, config);
  router.use(validate({ query: emptySchema }));
  router.use(rateLimit({ windowMs: 900_000, limit: 10, handler: rateLimitResponse }));
  router.post('/register', validate({ body: registerSchema }), controller.register);
  router.post('/login', validate({ body: loginSchema }), controller.login);
  router.post('/refresh', validate({ body: optionalEmptyBodySchema }), controller.refresh);
  router.post(
    '/logout',
    authenticate(config),
    validate({ body: optionalEmptyBodySchema }),
    controller.logout,
  );
  router.post(
    '/forgot-password',
    validate({ body: forgotPasswordSchema }),
    rateLimit({
      windowMs: 3_600_000,
      limit: 5,
      keyGenerator: (request) =>
        (request.validated['body'] as { email: string }).email.toLowerCase(),
      handler: rateLimitResponse,
    }),
    controller.forgotPassword,
  );
  router.post('/reset-password', validate({ body: resetPasswordSchema }), controller.resetPassword);
  router.get(
    '/me',
    authenticate(config),
    requirePermission('read-own-account'),
    validate({ query: emptySchema }),
    controller.me,
  );
  return router;
}

export function createAdminAuthRouter(config: Env): Router {
  const router = Router();
  router.use(validate({ query: emptySchema }));
  router.use(authenticate(config), requirePermission('admin'));
  router.get('/check', validate({ query: emptySchema }), (_request, response) =>
    response.json({ data: { allowed: true } }),
  );
  return router;
}
