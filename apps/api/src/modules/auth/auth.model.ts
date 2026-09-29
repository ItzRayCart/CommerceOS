import mongoose, { Schema } from 'mongoose';
import type { Types } from 'mongoose';

export interface RefreshToken {
  user: Types.ObjectId;
  tokenHash: string;
  family: string;
  expiresAt: Date;
  revokedAt?: Date;
  replacedBy?: Types.ObjectId;
  userAgent?: string;
  ip?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PasswordReset {
  user: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  usedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const refreshSchema = new Schema<RefreshToken>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    tokenHash: { type: String, required: true },
    family: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    revokedAt: Date,
    replacedBy: { type: Schema.Types.ObjectId, ref: 'RefreshToken' },
    userAgent: String,
    ip: String,
  },
  { timestamps: true, strict: true },
);
refreshSchema.index({ tokenHash: 1 }, { unique: true });
refreshSchema.index({ user: 1 });
refreshSchema.index({ family: 1 });
refreshSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const resetSchema = new Schema<PasswordReset>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    usedAt: Date,
  },
  { timestamps: true, strict: true },
);
resetSchema.index({ tokenHash: 1 }, { unique: true });
resetSchema.index({ user: 1 });
resetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshTokenModel = mongoose.model<RefreshToken>(
  'RefreshToken',
  refreshSchema,
  'refreshTokens',
);
export const PasswordResetModel = mongoose.model<PasswordReset>(
  'PasswordReset',
  resetSchema,
  'passwordResets',
);
