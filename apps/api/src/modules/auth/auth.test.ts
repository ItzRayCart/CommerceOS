import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import type { Express } from 'express';
import type { ApiErrorEnvelope } from '@commerceos/shared';
import { createApp } from '@api/app.js';
import { createLogger } from '@api/config/logger.js';
import type { Env } from '@api/config/env.js';
import { RefreshTokenModel } from '@api/modules/auth/auth.model.js';
import { PasswordResetModel } from '@api/modules/auth/auth.model.js';
import { hashToken } from '@api/modules/auth/auth.tokens.js';
import { createAuthService } from '@api/modules/auth/auth.service.js';
import { UserModel } from '@api/modules/users/users.model.js';

const config: Env = {
  NODE_ENV: 'test',
  PORT: 4000,
  MONGODB_URI: 'mongodb://localhost:27017/test',
  JWT_ACCESS_SECRET: 'test-secret-with-at-least-thirty-two-characters',
  JWT_ACCESS_TTL: '15m',
  REFRESH_TOKEN_TTL_DAYS: 7,
  COOKIE_SECURE: false,
  CORS_ORIGINS: 'http://localhost:4200',
  WEB_BASE_URL: 'http://localhost:4200',
  MAIL_TRANSPORT: 'console',
  UPLOAD_DIR: './uploads',
  LOG_LEVEL: 'fatal',
};
const password = 'ExamplePassword9';
const registration = {
  email: 'TEST@EXAMPLE.COM',
  password,
  firstName: 'Test',
  lastName: 'Customer',
};
let mongo: MongoMemoryReplSet;
let app: Express;

function bodyOf<T>(response: { body: unknown }): T {
  return response.body as T;
}
function cookieOf(response: { headers: Record<string, unknown> }): string {
  const value = response.headers['set-cookie'];
  if (!Array.isArray(value) || typeof value[0] !== 'string')
    throw new Error('Refresh cookie missing');
  return value[0].split(';')[0] ?? '';
}

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri());
}, 120_000);
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
}, 30_000);
beforeEach(async () => {
  app = createApp(config, createLogger('silent'));
  await UserModel.deleteMany({});
  await RefreshTokenModel.deleteMany({});
  await PasswordResetModel.deleteMany({});
});

describe('authentication session journey', () => {
  it('registers, logs in, rotates refresh, calls a protected endpoint, logs out, and rejects the old refresh token', async () => {
    const registered = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...registration, role: 'admin' });
    expect(registered.status).toBe(201);
    expect(
      bodyOf<{ data: { user: { role: string; email: string } } }>(registered).data.user,
    ).toMatchObject({ role: 'customer', email: 'test@example.com' });
    expect(cookieOf(registered)).toContain('refreshToken=');

    const loggedIn = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: registration.email, password });
    expect(loggedIn.status).toBe(200);
    const loginCookie = cookieOf(loggedIn);
    const refreshed = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', loginCookie)
      .send({});
    expect(refreshed.status).toBe(200);
    const freshCookie = cookieOf(refreshed);
    expect(freshCookie).not.toBe(loginCookie);
    const accessToken = bodyOf<{ data: { accessToken: string } }>(refreshed).data.accessToken;

    const protectedResponse = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(protectedResponse.status).toBe(200);
    expect(bodyOf<{ data: { email: string } }>(protectedResponse).data.email).toBe(
      'test@example.com',
    );

    const loggedOut = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', freshCookie)
      .send({});
    expect(loggedOut.status).toBe(204);
    const oldRefresh = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', freshCookie)
      .send({});
    expect(oldRefresh.status).toBe(401);
    expect(bodyOf<ApiErrorEnvelope>(oldRefresh).error.code).toBe('UNAUTHENTICATED');
  });

  it('revokes the refresh family when a rotated token is reused', async () => {
    const registered = await request(app).post('/api/v1/auth/register').send(registration);
    const original = cookieOf(registered);
    const rotation = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', original)
      .send({});
    const successor = cookieOf(rotation);
    expect(
      (await request(app).post('/api/v1/auth/refresh').set('Cookie', original).send({})).status,
    ).toBe(401);
    expect(
      (await request(app).post('/api/v1/auth/refresh').set('Cookie', successor).send({})).status,
    ).toBe(401);
  });

  it('rejects weak passwords, duplicate registration, wrong login, and customer admin access', async () => {
    expect(
      (
        await request(app)
          .post('/api/v1/auth/register')
          .send({ ...registration, password: 'Password1' })
      ).status,
    ).toBe(422);
    const registered = await request(app).post('/api/v1/auth/register').send(registration);
    expect(registered.status).toBe(201);
    expect((await request(app).post('/api/v1/auth/register').send(registration)).status).toBe(409);
    const wrong = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: registration.email, password: 'wrong' });
    expect(wrong.status).toBe(401);
    const token = bodyOf<{ data: { accessToken: string } }>(registered).data.accessToken;
    expect(
      (await request(app).get('/api/v1/admin/auth/check').set('Authorization', `Bearer ${token}`))
        .status,
    ).toBe(403);
    const raw = cookieOf(registered).slice('refreshToken='.length);
    expect(await RefreshTokenModel.countDocuments({ tokenHash: hashToken(raw) })).toBe(1);
    expect(await RefreshTokenModel.countDocuments({ tokenHash: raw })).toBe(0);
  });

  it('resets a password once and revokes all sessions', async () => {
    const registered = await request(app).post('/api/v1/auth/register').send(registration);
    const cookie = cookieOf(registered);
    let resetUrl = '';
    const service = createAuthService(
      config,
      {
        sendOrderConfirmation() {
          return Promise.resolve();
        },
        sendOrderShipped() {
          return Promise.resolve();
        },
        sendPasswordReset(_to, url) {
          resetUrl = url;
          return Promise.resolve();
        },
      },
      createLogger('silent'),
    );
    await service.forgotPassword({ email: 'test@example.com' });
    const token = resetUrl.split('/').at(-1) ?? '';
    expect(token.length).toBeGreaterThan(20);
    const reset = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, password: 'NewPassword9' });
    expect(reset.status).toBe(204);
    expect(
      (
        await request(app)
          .post('/api/v1/auth/reset-password')
          .send({ token, password: 'NewPassword9' })
      ).status,
    ).toBe(401);
    expect(
      (await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie).send({})).status,
    ).toBe(401);
    expect(
      (await request(app).post('/api/v1/auth/login').send({ email: registration.email, password }))
        .status,
    ).toBe(401);
    expect(
      (
        await request(app)
          .post('/api/v1/auth/login')
          .send({ email: registration.email, password: 'NewPassword9' })
      ).status,
    ).toBe(200);
  });

  it('updates the profile and manages at most one default address', async () => {
    const registered = await request(app).post('/api/v1/auth/register').send(registration);
    const token = bodyOf<{ data: { accessToken: string } }>(registered).data.accessToken;
    const auth = { Authorization: `Bearer ${token}` };
    const profile = await request(app).patch('/api/v1/me').set(auth).send({ firstName: 'Changed' });
    expect(profile.status).toBe(200);
    expect(bodyOf<{ data: { firstName: string } }>(profile).data.firstName).toBe('Changed');
    const address = {
      label: 'Home',
      fullName: 'Test Customer',
      line1: '1 Main Street',
      city: 'Karachi',
      region: 'Sindh',
      postalCode: '74000',
      country: 'pk',
      phone: '03000000000',
    };
    const first = await request(app).post('/api/v1/me/addresses').set(auth).send(address);
    expect(first.status).toBe(201);
    expect(bodyOf<{ data: { isDefault: boolean; country: string } }>(first).data).toMatchObject({
      isDefault: true,
      country: 'PK',
    });
    const second = await request(app)
      .post('/api/v1/me/addresses')
      .set(auth)
      .send({ ...address, label: 'Office', isDefault: true });
    expect(second.status).toBe(201);
    const addresses = await request(app).get('/api/v1/me/addresses').set(auth);
    const items = bodyOf<{ data: { id: string; isDefault: boolean }[] }>(addresses).data;
    expect(items.filter((item) => item.isDefault)).toHaveLength(1);
    expect(items[1]?.isDefault).toBe(true);
    expect(
      (
        await request(app)
          .delete(`/api/v1/me/addresses/${items[1]?.id ?? ''}`)
          .set(auth)
      ).status,
    ).toBe(204);
    const remaining = bodyOf<{ data: { isDefault: boolean }[] }>(
      await request(app).get('/api/v1/me/addresses').set(auth),
    ).data;
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.isDefault).toBe(true);
  });

  it('uses the same login error for unknown email and wrong password and limits the 11th attempt', async () => {
    await request(app).post('/api/v1/auth/register').send(registration);
    const errors: string[] = [];
    for (let attempt = 0; attempt < 9; attempt += 1) {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: attempt === 0 ? 'unknown@example.com' : registration.email,
          password: 'incorrect',
        });
      expect(response.status).toBe(401);
      if (attempt < 2) errors.push(bodyOf<ApiErrorEnvelope>(response).error.message);
    }
    expect(errors[0]).toBe(errors[1]);
    const limited = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: registration.email, password: 'incorrect' });
    expect(limited.status).toBe(429);
    expect(limited.headers['retry-after']).toBeTruthy();
  });

  it('reports expired bearer tokens and enforces admin access at the router', async () => {
    const registered = await request(app).post('/api/v1/auth/register').send(registration);
    expect(registered.headers['cache-control']).toBe('no-store');
    const id = bodyOf<{ data: { user: { id: string } } }>(registered).data.user.id;
    const expired = jwt.sign({ role: 'customer' }, config.JWT_ACCESS_SECRET, {
      algorithm: 'HS256',
      subject: id,
      expiresIn: -1,
    });
    const denied = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${expired}`);
    expect(denied.status).toBe(401);
    expect(bodyOf<ApiErrorEnvelope>(denied).error.code).toBe('TOKEN_EXPIRED');
    expect((await request(app).get('/api/v1/admin/auth/check')).status).toBe(401);
    await UserModel.updateOne({ _id: id }, { $set: { role: 'admin' } });
    const adminToken = jwt.sign({ role: 'admin' }, config.JWT_ACCESS_SECRET, {
      algorithm: 'HS256',
      subject: id,
      expiresIn: '15m',
    });
    expect(
      (
        await request(app)
          .get('/api/v1/admin/auth/check')
          .set('Authorization', `Bearer ${adminToken}`)
      ).status,
    ).toBe(200);
  });

  it('requires the current password and revokes refresh sessions after a password change', async () => {
    const registered = await request(app).post('/api/v1/auth/register').send(registration);
    const token = bodyOf<{ data: { accessToken: string } }>(registered).data.accessToken;
    const cookie = cookieOf(registered);
    const wrong = await request(app)
      .post('/api/v1/me/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'wrong', newPassword: 'NewPassword9' });
    expect(wrong.status).toBe(401);
    const changed = await request(app)
      .post('/api/v1/me/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: password, newPassword: 'NewPassword9' });
    expect(changed.status).toBe(204);
    expect(
      (await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie).send({})).status,
    ).toBe(401);
  });
});
