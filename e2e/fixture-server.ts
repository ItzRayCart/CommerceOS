import type * as CommerceSeedModule from '../Backend/src/seed/commerce-seed.js';
import type * as AppModule from '../Backend/src/app.js';
import type * as LoggerModule from '../Backend/src/config/logger.js';
import type * as SeedModule from '../Backend/src/seed/catalog-seed.js';
import type * as OrdersModule from '../Backend/src/modules/orders/orders.model.js';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createRequire } from 'node:module';
const requireApi = createRequire(import.meta.url);
const { createApp } = requireApi('../Backend/src/app.ts') as typeof AppModule;
const { createLogger } = requireApi('../Backend/src/config/logger.ts') as typeof LoggerModule;
const { ensureCatalogSeed } = requireApi(
  '../Backend/src/seed/catalog-seed.ts',
) as typeof SeedModule;
const { OrderModel, CounterModel, StockMovementModel } = requireApi(
  '../Backend/src/modules/orders/orders.model.ts',
) as typeof OrdersModule;
import type { Env } from '../Backend/src/config/env.js';
const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
await mongoose.connect(mongo.getUri());
await Promise.all([OrderModel.init(), CounterModel.init(), StockMovementModel.init()]);
await ensureCatalogSeed();
const { ensureAccountsSeed } = requireApi(
  '../Backend/src/seed/commerce-seed.ts',
) as typeof CommerceSeedModule;
await ensureAccountsSeed();
const config: Env = {
  NODE_ENV: 'test',
  PORT: 4400,
  MONGODB_URI: mongo.getUri(),
  JWT_ACCESS_SECRET: 'e2e-only-ephemeral-secret-not-for-production',
  JWT_ACCESS_TTL: '15m',
  REFRESH_TOKEN_TTL_DAYS: 7,
  COOKIE_SECURE: false,
  CORS_ORIGINS: 'http://localhost:4500',
  WEB_BASE_URL: 'http://localhost:4500',
  MAIL_TRANSPORT: 'console',
  UPLOAD_DIR: join(tmpdir(), 'uploads'),
  LOG_LEVEL: 'warn',
};
const server = createServer(createApp(config, createLogger('warn')));
server.listen(4400, '127.0.0.1');
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  server.close();
  await mongoose.disconnect();
  await mongo.stop();
}
process.once('SIGTERM', () => {
  void stop();
});
process.once('SIGINT', () => {
  void stop();
});
