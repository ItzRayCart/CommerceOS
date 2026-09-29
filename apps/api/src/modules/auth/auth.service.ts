import { randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import mongoose from 'mongoose';
import type { Types } from 'mongoose';
import type { Logger } from 'pino';
import { Role } from '@commerceos/shared';
import { ConflictError, UnauthenticatedError } from '@api/common/errors/app-error.js';
import type { MailProvider } from '@api/common/providers/mail.provider.js';
import type { Env } from '@api/config/env.js';
import { PasswordResetModel, RefreshTokenModel } from '@api/modules/auth/auth.model.js';
import type {
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from '@api/modules/auth/auth.schemas.js';
import { hashToken, issueSession } from '@api/modules/auth/auth.tokens.js';
import type { IssuedSession } from '@api/modules/auth/auth.tokens.js';
import { UserModel } from '@api/modules/users/users.model.js';
import type { User } from '@api/modules/users/users.model.js';

const DUMMY_HASH = argon2.hash('dummy-password-for-timing');
const INVALID_LOGIN = 'Invalid email or password';

type AuthUser = User & { _id: Types.ObjectId };
export interface AuthResult extends IssuedSession {
  user: AuthUser;
}

export function createAuthService(config: Env, mail: MailProvider, logger: Logger) {
  async function register(
    input: RegisterInput,
    userAgent?: string,
    ip?: string,
  ): Promise<AuthResult> {
    const email = input.email.toLowerCase();
    if (await UserModel.exists({ email })) throw new ConflictError('Email already in use', 'email');
    const user = await UserModel.create({
      email,
      passwordHash: await argon2.hash(input.password, { type: argon2.argon2id }),
      firstName: input.firstName,
      lastName: input.lastName,
      role: Role.Customer,
      status: 'active',
      addresses: [],
      stats: { orderCount: 0, totalSpent: 0 },
    });
    const session = await issueSession(user._id, user.role, config, undefined, userAgent, ip);
    return { ...session, user };
  }

  async function login(input: LoginInput, userAgent?: string, ip?: string): Promise<AuthResult> {
    const user = await UserModel.findOne({ email: input.email }).select('+passwordHash');
    const hash = user?.passwordHash ?? (await DUMMY_HASH);
    const passwordMatches = await argon2.verify(hash, input.password);
    if (!user || !passwordMatches || user.status !== 'active') {
      throw new UnauthenticatedError(INVALID_LOGIN);
    }
    user.lastLoginAt = new Date();
    await user.save();
    const session = await issueSession(user._id, user.role, config, undefined, userAgent, ip);
    return { ...session, user };
  }

  async function refresh(
    token: string | undefined,
    userAgent?: string,
    ip?: string,
  ): Promise<AuthResult> {
    if (!token) throw new UnauthenticatedError();
    const result = await mongoose.connection.transaction(async (session) => {
      const current = await RefreshTokenModel.findOne({ tokenHash: hashToken(token) })
        .session(session)
        .lean();
      if (!current) return null;
      if (current.revokedAt) {
        await RefreshTokenModel.updateMany(
          { family: current.family, revokedAt: { $exists: false } },
          { $set: { revokedAt: new Date() } },
          { session },
        );
        return null;
      }
      if (current.expiresAt <= new Date()) return null;
      const user = await UserModel.findById(current.user).session(session).lean();
      if (!user || user.status !== 'active') return null;
      const issued = await issueSession(
        user._id,
        user.role,
        config,
        current.family,
        userAgent,
        ip,
        session,
      );
      await RefreshTokenModel.updateOne(
        { _id: current._id },
        { $set: { revokedAt: new Date(), replacedBy: issued.refreshRecordId } },
        { session },
      );
      return { ...issued, user };
    });
    if (!result) throw new UnauthenticatedError();
    return result;
  }

  async function logout(token: string | undefined): Promise<void> {
    if (!token) return;
    const current = await RefreshTokenModel.findOne({ tokenHash: hashToken(token) }).lean();
    if (!current) return;
    await RefreshTokenModel.updateMany(
      { family: current.family, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date() } },
    );
  }

  async function forgotPassword(input: ForgotPasswordInput): Promise<void> {
    const user = await UserModel.findOne({ email: input.email, status: 'active' }).lean();
    if (!user) return;
    const rawToken = randomBytes(32).toString('base64url');
    await PasswordResetModel.create({
      user: user._id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + 3_600_000),
    });
    const url = `${config.WEB_BASE_URL}/reset-password/${encodeURIComponent(rawToken)}`;
    try {
      await mail.sendPasswordReset(user.email, url);
    } catch (error) {
      logger.error({ err: error }, 'Password reset delivery failed');
    }
  }

  async function resetPassword(input: ResetPasswordInput): Promise<void> {
    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    await mongoose.connection.transaction(async (session) => {
      const reset = await PasswordResetModel.findOneAndUpdate(
        {
          tokenHash: hashToken(input.token),
          usedAt: { $exists: false },
          expiresAt: { $gt: new Date() },
        },
        { $set: { usedAt: new Date() } },
        { session, new: true },
      );
      if (!reset) throw new UnauthenticatedError('Invalid or expired reset token');
      await UserModel.updateOne({ _id: reset.user }, { $set: { passwordHash } }, { session });
      await RefreshTokenModel.updateMany(
        { user: reset.user, revokedAt: { $exists: false } },
        { $set: { revokedAt: new Date() } },
        { session },
      );
    });
  }

  async function getMe(userId: string): Promise<AuthUser> {
    const user = await UserModel.findById(userId).lean();
    if (!user) throw new UnauthenticatedError();
    return user;
  }

  return { register, login, refresh, logout, forgotPassword, resetPassword, getMe };
}
