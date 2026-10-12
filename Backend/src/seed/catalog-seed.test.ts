import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { ensureCatalogSeed } from './catalog-seed.js';
import { ProductModel } from '@api/modules/catalog/product.model.js';
import { CategoryModel } from '@api/modules/catalog/category.model.js';

let mongo: MongoMemoryReplSet;
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri());
  await ensureCatalogSeed();
}, 120000);
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
}, 30000);

it('expands to sixty products and one hundred eighty unique variants', async () => {
  const products = await ProductModel.find().lean();
  expect(products).toHaveLength(60);
  expect(await CategoryModel.countDocuments()).toBe(5);
  const skus = products.flatMap((product) => product.variants.map((variant) => variant.sku));
  expect(new Set(skus).size).toBe(180);
  expect(
    products.every(
      (product) =>
        product.images.length === 8 &&
        product.images.filter((image) => image.isPrimary).length === 1,
    ),
  ).toBe(true);
  expect(
    products.every(
      (product) =>
        product.soldCount >= 0 && product.variants.every((variant) => variant.stock >= 0),
    ),
  ).toBe(true);
});

it('repairs partial seeds while preserving user edits, identities and custom media', async () => {
  const product = await ProductModel.findOne({ slug: 'arc-headphones' }).orFail();
  const variant = product.variants[0];
  if (!variant) throw new Error('Missing seed variant');
  const variantId = variant._id.toString();
  variant.price = 77700;
  variant.compareAtPrice = 80000;
  variant.stock = 7;
  product.name = 'Custom edited title';
  product.images[0]!.url = '/uploads/custom.webp';
  product.images[1]!.url = '/assets/products/generated/arc-headphones-rear-v2.png';
  const imageIds = product.images.map((image) => image._id.toString());
  variant.images = ['/assets/products/arc-headphones-1.svg', '/uploads/custom.webp'];
  await product.save();
  const removed = await ProductModel.findOneAndDelete({ slug: 'power-strip' }).orFail();
  await ensureCatalogSeed();
  await ensureCatalogSeed();
  const saved = await ProductModel.findById(product._id).orFail();
  expect(await ProductModel.countDocuments()).toBe(60);
  expect(saved.name).toBe('Custom edited title');
  expect(saved.variants[0]).toMatchObject({ price: 77700, stock: 7 });
  expect(saved.variants[0]?._id.toString()).toBe(variantId);
  expect(saved.images.map((image) => image._id.toString())).toEqual(imageIds);
  expect(saved.images.map((image) => image.url)).toEqual([
    '/uploads/custom.webp',
    '/assets/products/arc-headphones-2.svg',
    ...Array.from({ length: 6 }, (_, index) => `/assets/products/arc-headphones-${index + 3}.svg`),
  ]);
  expect(saved.variants[0]?.images).toEqual([
    '/assets/products/arc-headphones-1.svg',
    '/uploads/custom.webp',
  ]);
  const replacement = await ProductModel.findOne({ slug: 'power-strip' }).orFail();
  expect(replacement.variants.map((item) => item.sku)).toEqual(
    removed.variants.map((item) => item.sku),
  );
});

it('extends the original two-view gallery and maps colour variants without replacing image IDs', async () => {
  const product = await ProductModel.findOne({ slug: 'studio-headphones' }).orFail();
  product.images = product.images.slice(0, 2);
  const originalIds = product.images.map((image) => image._id.toString());
  for (const variant of product.variants)
    variant.images = ['/assets/products/studio-headphones-1.svg'];
  await product.save();
  await ensureCatalogSeed();
  const expanded = await ProductModel.findById(product._id).orFail();
  expect(expanded.images).toHaveLength(8);
  expect(expanded.images.slice(0, 2).map((image) => image._id.toString())).toEqual(originalIds);
  expect(expanded.variants[1]?.images).toEqual([
    '/assets/products/studio-headphones-5.svg',
    '/assets/products/studio-headphones-6.svg',
  ]);
  const updatedAt = expanded.updatedAt.getTime();
  await ensureCatalogSeed();
  expect((await ProductModel.findById(product._id).orFail()).updatedAt.getTime()).toBe(updatedAt);
});
