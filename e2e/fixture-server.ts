import type * as CommerceSeedModule from '../apps/api/src/seed/commerce-seed.js';
import type * as AppModule from '../apps/api/src/app.js';
import type * as LoggerModule from '../apps/api/src/config/logger.js';
import type * as SeedModule from '../apps/api/src/seed/catalog-seed.js';
import type * as OrdersModule from '../apps/api/src/modules/orders/orders.model.js';
import { createServer } from 'node:http';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createRequire } from 'node:module';
const requireApi = createRequire(import.meta.url);
const { createApp } = requireApi('../apps/api/src/app.ts') as typeof AppModule;
const { createLogger } = requireApi('../apps/api/src/config/logger.ts') as typeof LoggerModule;
const { ensureCatalogSeed } = requireApi(
  '../apps/api/src/seed/catalog-seed.ts',
) as typeof SeedModule;
const { OrderModel, CounterModel, StockMovementModel } = requireApi(
  '../apps/api/src/modules/orders/orders.model.ts',
) as typeof OrdersModule;
import type { Env } from '../apps/api/src/config/env.js';
const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
await mongoose.connect(mongo.getUri());
await Promise.all([OrderModel.init(), CounterModel.init(), StockMovementModel.init()]);
await ensureCatalogSeed();
const { ensureAccountsSeed } = requireApi(
  '../apps/api/src/seed/commerce-seed.ts',
) as typeof CommerceSeedModule;
await ensureAccountsSeed();
const config: Env = {
  NODE_ENV: 'test',
  PORT: 4000,
  MONGODB_URI: mongo.getUri(),
  JWT_ACCESS_SECRET: 'e2e-only-ephemeral-secret-not-for-production',
  JWT_ACCESS_TTL: '15m',
  REFRESH_TOKEN_TTL_DAYS: 7,
  COOKIE_SECURE: false,
  CORS_ORIGINS: 'http://localhost:4200',
  WEB_BASE_URL: 'http://localhost:4200',
  MAIL_TRANSPORT: 'console',
  UPLOAD_DIR: './uploads',
  LOG_LEVEL: 'warn',
};
const server = createServer(createApp(config, createLogger('warn')));
server.listen(4000, '127.0.0.1');
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
