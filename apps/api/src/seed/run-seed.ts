import { closeDatabase, connectDatabase } from '@api/config/db.js';
import { readEnv } from '@api/config/env.js';
import { ensureCatalogSeed, resetCatalogSeed } from '@api/seed/catalog-seed.js';

async function main(): Promise<void> {
  const config = readEnv();
  await connectDatabase(config.MONGODB_URI);
  try {
    if (process.argv.includes('--reset')) await resetCatalogSeed();
    else await ensureCatalogSeed();
  } finally {
    await closeDatabase();
  }
}

void main();
