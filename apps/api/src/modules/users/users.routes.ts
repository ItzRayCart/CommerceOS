import { Router } from 'express';
import type { Env } from '@api/config/env.js';
import { authenticate, requirePermission } from '@api/common/middleware/authenticate.js';
import { validate } from '@api/common/middleware/validate.js';
import { createUsersController } from '@api/modules/users/users.controller.js';
import {
  addressParamsSchema,
  addressSchema,
  changePasswordSchema,
  profileSchema,
  updateAddressSchema,
} from '@api/modules/users/users.schemas.js';
import { emptySchema } from '@api/modules/auth/auth.schemas.js';

export function createUsersRouter(config: Env): Router {
  const router = Router();
  const controller = createUsersController();
  router.use(authenticate(config), requirePermission('read-own-account'));
  router.use(validate({ query: emptySchema }));
  router.patch('/', validate({ body: profileSchema }), controller.updateProfile);
  router.post(
    '/change-password',
    validate({ body: changePasswordSchema }),
    controller.changePassword,
  );
  router.get('/addresses', validate({ query: emptySchema }), controller.listAddresses);
  router.post('/addresses', validate({ body: addressSchema }), controller.addAddress);
  router.patch(
    '/addresses/:id',
    validate({ params: addressParamsSchema, body: updateAddressSchema }),
    controller.updateAddress,
  );
  router.delete(
    '/addresses/:id',
    validate({ params: addressParamsSchema }),
    controller.deleteAddress,
  );
  return router;
}
