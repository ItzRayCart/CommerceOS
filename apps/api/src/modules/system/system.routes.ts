import { Router } from 'express';
import { validate } from '@api/common/middleware/validate.js';
import { echoController } from '@api/modules/system/system.controller.js';
import { echoQuerySchema } from '@api/modules/system/system.schemas.js';

export const systemRouter = Router();
systemRouter.get('/echo', validate({ query: echoQuerySchema }), echoController);
