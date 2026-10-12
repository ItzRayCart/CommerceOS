import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { Role } from '@commerceos/shared';
import { ForbiddenError, UnauthenticatedError } from '@api/common/errors/app-error.js';
import { asyncHandler } from '@api/common/middleware/async-handler.js';
import type { Env } from '@api/config/env.js';
import { UserModel } from '@api/modules/users/users.model.js';

const claimsSchema = z.object({ sub: z.string(), role: z.enum(Role) });

export function authenticate(config: Env): RequestHandler {
  return asyncHandler(async (request, _response, next) => {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthenticatedError();
    const token = header.slice(7);
    let payload: unknown;
    try {
      payload = jwt.verify(token, config.JWT_ACCESS_SECRET, { algorithms: ['HS256'] });
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthenticatedError('Access token expired', 'TOKEN_EXPIRED');
      }
      throw new UnauthenticatedError();
    }
    const claims = claimsSchema.safeParse(payload);
    if (!claims.success) throw new UnauthenticatedError();
    const user = await UserModel.findById(claims.data.sub).select('role status').lean();
    if (!user || user.status !== 'active') throw new UnauthenticatedError();
    request.auth = { userId: user._id.toString(), role: user.role };
    next();
  });
}

export type Permission = 'read-own-account' | 'admin';
const PERMISSIONS: Record<Role, readonly Permission[]> = {
  [Role.Customer]: ['read-own-account'],
  [Role.Admin]: ['read-own-account', 'admin'],
};

export function can(role: Role, permission: Permission): boolean {
  return PERMISSIONS[role].includes(permission);
}

export function requirePermission(permission: Permission): RequestHandler {
  return (request, _response, next) => {
    if (!request.auth) return next(new UnauthenticatedError());
    if (!can(request.auth.role, permission)) return next(new ForbiddenError());
    next();
  };
}
