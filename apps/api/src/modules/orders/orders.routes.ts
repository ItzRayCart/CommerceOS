import { Router } from 'express';
import { z } from 'zod';
import type { Env } from '@api/config/env.js';
import type { Logger } from 'pino';
import { authenticate, requirePermission } from '@api/common/middleware/authenticate.js';
import { validate } from '@api/common/middleware/validate.js';
import { createMailProvider } from '@api/common/providers/mail.provider.js';
import { MockPaymentProvider } from '@api/common/providers/payment.provider.js';
import { createOrdersController } from './orders.controller.js';
import {
  quoteSchema,
  orderSchema,
  orderQuery,
  orderParams,
  adminParams,
  statusSchema,
} from './orders.schemas.js';
import type { OrderDependencies } from './orders.service.js';
const empty = z.strictObject({});
export function createOrderRouters(config: Env, logger: Logger, override?: OrderDependencies) {
  const controller = createOrdersController(
    override ?? {
      payment: new MockPaymentProvider(),
      mail: createMailProvider(config, logger),
      logger,
      webBaseUrl: config.WEB_BASE_URL,
    },
  );
  const checkout = Router();
  checkout.use(authenticate(config), requirePermission('read-own-account'));
  checkout.post('/quote', validate({ body: quoteSchema, query: empty }), controller['quote']!);
  const orders = Router();
  orders.use(authenticate(config), requirePermission('read-own-account'));
  orders.post('/', validate({ body: orderSchema, query: empty }), controller['place']!);
  orders.get('/', validate({ query: orderQuery }), controller['list']!);
  orders.get(
    '/:orderNumber',
    validate({ params: orderParams, query: empty }),
    controller['detail']!,
  );
  orders.post(
    '/:orderNumber/cancel',
    validate({ params: orderParams, query: empty, body: empty }),
    controller['cancel']!,
  );
  const admin = Router();
  admin.use(authenticate(config), requirePermission('admin'));
  admin.patch(
    '/:id/status',
    validate({ params: adminParams, body: statusSchema, query: empty }),
    controller['adminStatus']!,
  );
  return { checkout, orders, admin };
}
