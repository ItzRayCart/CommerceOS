import type { RequestHandler } from 'express';
import { z } from 'zod';
import { UnauthenticatedError } from '@api/common/errors/app-error.js';
import { asyncHandler } from '@api/common/middleware/async-handler.js';
import type { Env } from '@api/config/env.js';
import type { createAuthService } from '@api/modules/auth/auth.service.js';
import type {
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from '@api/modules/auth/auth.schemas.js';
import { toUserDto } from '@api/modules/users/users.mapper.js';

type AuthService = ReturnType<typeof createAuthService>;
const cookiesSchema = z.object({ refreshToken: z.string().optional() });

function getRefreshCookie(cookies: unknown): string | undefined {
  const result = cookiesSchema.safeParse(cookies);
  return result.success ? result.data.refreshToken : undefined;
}

function setRefreshCookie(
  response: Parameters<RequestHandler>[1],
  token: string,
  config: Env,
): void {
  response.cookie('refreshToken', token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.COOKIE_SECURE,
    path: '/api/v1/auth',
    maxAge: config.REFRESH_TOKEN_TTL_DAYS * 86_400_000,
  });
}

export function createAuthController(service: AuthService, config: Env) {
  const register = asyncHandler(async (request, response) => {
    const result = await service.register(
      request.validated['body'] as RegisterInput,
      request.headers['user-agent'],
      request.ip,
    );
    setRefreshCookie(response, result.refreshToken, config);
    response
      .status(201)
      .json({ data: { accessToken: result.accessToken, user: toUserDto(result.user) } });
  });

  const login = asyncHandler(async (request, response) => {
    const result = await service.login(
      request.validated['body'] as LoginInput,
      request.headers['user-agent'],
      request.ip,
    );
    setRefreshCookie(response, result.refreshToken, config);
    response.json({ data: { accessToken: result.accessToken, user: toUserDto(result.user) } });
  });

  const refresh = asyncHandler(async (request, response) => {
    const result = await service.refresh(
      getRefreshCookie(request.cookies as unknown),
      request.headers['user-agent'],
      request.ip,
    );
    setRefreshCookie(response, result.refreshToken, config);
    response.json({ data: { accessToken: result.accessToken, user: toUserDto(result.user) } });
  });

  const logout = asyncHandler(async (request, response) => {
    await service.logout(getRefreshCookie(request.cookies as unknown));
    response.clearCookie('refreshToken', {
      httpOnly: true,
      sameSite: 'strict',
      secure: config.COOKIE_SECURE,
      path: '/api/v1/auth',
    });
    response.status(204).end();
  });

  const forgotPassword = asyncHandler(async (request, response) => {
    await service.forgotPassword(request.validated['body'] as ForgotPasswordInput);
    response
      .status(202)
      .json({ data: { message: 'If the account exists, a reset link was sent' } });
  });

  const resetPassword = asyncHandler(async (request, response) => {
    await service.resetPassword(request.validated['body'] as ResetPasswordInput);
    response.status(204).end();
  });

  const me = asyncHandler(async (request, response) => {
    if (!request.auth) throw new UnauthenticatedError();
    const user = await service.getMe(request.auth.userId);
    response.json({ data: toUserDto(user) });
  });

  return { register, login, refresh, logout, forgotPassword, resetPassword, me };
}
