import request from 'supertest';
import { createApp } from '@api/app.js';
import type { Env } from '@api/config/env.js';
import type { ApiErrorEnvelope } from '@commerceos/shared';
import { createLogger } from '@api/config/logger.js';

const config: Env = {
  NODE_ENV: 'test',
  PORT: 4000,
  MONGODB_URI: 'mongodb://localhost:27017/commerceos?directConnection=true',
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

const app = createApp(config, createLogger('silent'));

describe('sample route', () => {
  it('returns a validated response with request ID', async () => {
    const response = await request(app).get('/api/v1/system/echo?message=hello');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: { message: 'hello' } });
    expect(response.headers['x-request-id']).toBeTruthy();
  });

  it('rejects unknown query keys with the standard envelope', async () => {
    const response = await request(app).get('/api/v1/system/echo?message=hello&extra=1');
    expect(response.status).toBe(422);
    const body = response.body as ApiErrorEnvelope;
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.requestId).toBe(response.headers['x-request-id']);
  });

  it('rejects MongoDB operator keys before route handling', async () => {
    const response = await request(app).post('/api/v1/system/echo').send({ $gt: 1 });
    const body = response.body as ApiErrorEnvelope;
    expect(response.status).toBe(400);
    expect(body.error.code).toBe('BAD_REQUEST');
    expect(body.error.requestId).toBe(response.headers['x-request-id']);
  });

  it('wraps unknown routes and malformed JSON in the error envelope', async () => {
    const missing = await request(app).get('/api/v1/missing');
    const malformed = await request(app)
      .post('/api/v1/system/echo')
      .set('Content-Type', 'application/json')
      .send('{invalid');
    expect((missing.body as ApiErrorEnvelope).error.code).toBe('NOT_FOUND');
    expect((malformed.body as ApiErrorEnvelope).error.code).toBe('BAD_REQUEST');
  });

  it('serves the OpenAPI document for the sample route', async () => {
    const response = await request(app).get('/api/docs/openapi.json');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('paths./system/echo');
  });
});
