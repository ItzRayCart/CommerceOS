import { createServer } from 'node:http';
import { createApp } from '@api/app.js';
import { closeDatabase, connectDatabase } from '@api/config/db.js';
import { readEnv } from '@api/config/env.js';
import { createLogger } from '@api/config/logger.js';
import { ensureCatalogSeed } from '@api/seed/catalog-seed.js';

const config = readEnv();
const logger = createLogger(config.LOG_LEVEL);

async function start(): Promise<void> {
  await connectDatabase(config.MONGODB_URI);
  if (config.NODE_ENV !== 'production') await ensureCatalogSeed();
  const server = createServer(createApp(config, logger));
  server.listen(config.PORT, () => logger.info({ port: config.PORT }, 'API listening'));

  const shutdown = (): void => {
    server.close(() => {
      void closeDatabase().then(() => process.exit(0));
    });
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

start().catch((error: unknown) => {
  logger.fatal({ err: error }, 'API startup failed');
  process.exitCode = 1;
});
