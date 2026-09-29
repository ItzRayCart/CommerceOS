import { createHash, randomBytes, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import type { ClientSession, Types } from 'mongoose';
import type { Role } from '@commerceos/shared';
import type { Env } from '@api/config/env.js';
import { RefreshTokenModel } from '@api/modules/auth/auth.model.js';

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function newOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

export function signAccessToken(userId: Types.ObjectId, role: Role, config: Env): string {
  return jwt.sign({ role }, config.JWT_ACCESS_SECRET, {
    algorithm: 'HS256',
    subject: userId.toString(),
    expiresIn: config.JWT_ACCESS_TTL as SignOptions['expiresIn'],
  });
}

export interface IssuedSession {
  accessToken: string;
  refreshToken: string;
  refreshRecordId: Types.ObjectId;
}

export async function issueSession(
  userId: Types.ObjectId,
  role: Role,
  config: Env,
  family: string = randomUUID(),
  userAgent?: string,
  ip?: string,
  session?: ClientSession,
): Promise<IssuedSession> {
  const refreshToken = newOpaqueToken();
  const record = new RefreshTokenModel({
    user: userId,
    tokenHash: hashToken(refreshToken),
    family,
    expiresAt: new Date(Date.now() + config.REFRESH_TOKEN_TTL_DAYS * 86_400_000),
    ...(userAgent ? { userAgent } : {}),
    ...(ip ? { ip } : {}),
  });
  await record.save(session ? { session } : {});
  return {
    accessToken: signAccessToken(userId, role, config),
    refreshToken,
    refreshRecordId: record._id,
  };
}
