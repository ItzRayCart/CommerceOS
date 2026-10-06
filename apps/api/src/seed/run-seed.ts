import { closeDatabase, connectDatabase } from '@api/config/db.js';
import { readEnv } from '@api/config/env.js';
import { ensureCatalogSeed, resetCatalogSeed } from '@api/seed/catalog-seed.js';
import { ensureCommerceSeed } from '@api/seed/commerce-seed.js';
import { createLogger } from '@api/config/logger.js';
import { OrderModel, CounterModel, StockMovementModel } from '@api/modules/orders/orders.model.js';
import { UserModel } from '@api/modules/users/users.model.js';
import { CartModel } from '@api/modules/cart/cart.model.js';
import { RedemptionModel } from '@api/modules/cart/discount.model.js';

async function main(): Promise<void> {
  const config = readEnv();
  await connectDatabase(config.MONGODB_URI);
  try {
    if (process.argv.includes('--reset')) {
      await Promise.all([
        OrderModel.deleteMany({}),
        CounterModel.deleteMany({}),
        StockMovementModel.deleteMany({}),
        UserModel.deleteMany({}),
        CartModel.deleteMany({}),
        RedemptionModel.deleteMany({}),
      ]);
      await resetCatalogSeed();
    } else await ensureCatalogSeed();
    await ensureCommerceSeed(config, createLogger('silent'));
  } finally {
    await closeDatabase();
  }
}

void main();
