import { CategoryModel } from '@api/modules/catalog/category.model.js';
import { ProductModel } from '@api/modules/catalog/product.model.js';
import { SettingsModel } from '@api/modules/settings/settings.model.js';
import { DiscountModel } from '@api/modules/cart/discount.model.js';

const groups = [
  {
    name: 'Personal audio',
    slug: 'personal-audio',
    description: 'Headphones and earbuds made for focused listening.',
  },
  { name: 'Speakers', slug: 'speakers', description: 'Room-filling sound in considered forms.' },
  { name: 'Cameras', slug: 'cameras', description: 'Tools for keeping the moments that matter.' },
  {
    name: 'Workspace',
    slug: 'workspace',
    description: 'Better essentials for your everyday desk.',
  },
  { name: 'Power', slug: 'power', description: 'Charging and power for wherever work takes you.' },
];
const products: { slug: string; name: string; summary: string; base: number }[] = [
  {
    slug: 'arc-headphones',
    name: 'Arc wireless headphones',
    summary: 'Balanced sound with soft over-ear cushions and all-day battery life.',
    base: 24900,
  },
  {
    slug: 'studio-headphones',
    name: 'Studio reference headphones',
    summary: 'Open detail and a comfortable fit for long listening sessions.',
    base: 32900,
  },
  {
    slug: 'fold-headphones',
    name: 'Fold travel headphones',
    summary: 'Compact over-ear listening with a quiet, secure fit.',
    base: 18900,
  },
  {
    slug: 'commute-earbuds',
    name: 'Commute wireless earbuds',
    summary: 'Pocketable listening with clear calls and stable connection.',
    base: 13900,
  },
  {
    slug: 'reference-earbuds',
    name: 'Reference in-ear monitors',
    summary: 'A precise, wired listening experience in a compact form.',
    base: 17900,
  },
  {
    slug: 'wireless-earbuds',
    name: 'Everyday wireless earbuds',
    summary: 'Dependable sound and an easy fit for daily use.',
    base: 9900,
  },
  {
    slug: 'orbit-speaker',
    name: 'Orbit wireless speaker',
    summary: 'Warm, room-filling sound in a compact circular design.',
    base: 21900,
  },
  {
    slug: 'field-speaker',
    name: 'Field portable speaker',
    summary: 'Durable sound you can take from home to outdoors.',
    base: 15900,
  },
  {
    slug: 'soundbar-mini',
    name: 'Mini soundbar',
    summary: 'Clear dialogue and balanced sound for smaller spaces.',
    base: 27900,
  },
  {
    slug: 'room-speaker',
    name: 'Room bookshelf speaker',
    summary: 'Rich stereo playback with understated presence.',
    base: 39900,
  },
  {
    slug: 'pocket-speaker',
    name: 'Pocket speaker',
    summary: 'A small speaker with a surprisingly full voice.',
    base: 8900,
  },
  {
    slug: 'studio-monitor',
    name: 'Studio monitor',
    summary: 'Accurate nearfield listening for work and play.',
    base: 44900,
  },
  {
    slug: 'frame-camera',
    name: 'Frame mirrorless camera',
    summary: 'A capable everyday camera with intuitive controls.',
    base: 89900,
  },
  {
    slug: 'compact-camera',
    name: 'Compact digital camera',
    summary: 'A light companion for considered photography.',
    base: 49900,
  },
  {
    slug: 'travel-camera',
    name: 'Travel zoom camera',
    summary: 'Flexible framing in a ready-to-go body.',
    base: 64900,
  },
  {
    slug: 'instant-camera',
    name: 'Instant camera',
    summary: 'A tangible print for every memorable frame.',
    base: 16900,
  },
  {
    slug: 'action-camera',
    name: 'Action camera',
    summary: 'Stable capture wherever the day takes you.',
    base: 35900,
  },
  {
    slug: 'film-camera',
    name: '35mm film camera',
    summary: 'A deliberate way to make lasting photographs.',
    base: 29900,
  },
  {
    slug: 'desk-lamp',
    name: 'Adjustable desk lamp',
    summary: 'Focused light with simple, precise adjustment.',
    base: 12900,
  },
  {
    slug: 'mechanical-keyboard',
    name: 'Mechanical keyboard',
    summary: 'Tactile typing with a clean, compact footprint.',
    base: 18900,
  },
  {
    slug: 'wireless-mouse',
    name: 'Wireless mouse',
    summary: 'Comfortable control without desk clutter.',
    base: 7900,
  },
  {
    slug: 'display-light',
    name: 'Display light bar',
    summary: 'Even desk illumination without screen glare.',
    base: 10900,
  },
  {
    slug: 'monitor-stand',
    name: 'Monitor stand',
    summary: 'A stronger workspace with room to breathe.',
    base: 14900,
  },
  {
    slug: 'desk-hub',
    name: 'Desktop USB-C hub',
    summary: 'Essential connections within easy reach.',
    base: 11900,
  },
  {
    slug: 'power-bank',
    name: 'Power bank 20K',
    summary: 'Reliable portable power for longer days.',
    base: 13900,
  },
  {
    slug: 'charging-dock',
    name: 'Three-device charging dock',
    summary: 'One tidy place to recharge your essentials.',
    base: 19900,
  },
  {
    slug: 'travel-adapter',
    name: 'Universal travel adapter',
    summary: 'One compact connection for journeys near and far.',
    base: 8900,
  },
  {
    slug: 'cable-kit',
    name: 'Travel cable kit',
    summary: 'The right connection, organised and ready.',
    base: 4900,
  },
  {
    slug: 'wireless-charger',
    name: 'Wireless charging pad',
    summary: 'A considered place to power up.',
    base: 9900,
  },
  {
    slug: 'solar-charger',
    name: 'Portable solar charger',
    summary: 'Supplemental power for days away from the outlet.',
    base: 24900,
  },
];

export async function ensureCatalogSeed(): Promise<void> {
  await Promise.all([
    CategoryModel.init(),
    ProductModel.init(),
    SettingsModel.init(),
    DiscountModel.init(),
  ]);
  await SettingsModel.updateOne(
    { key: 'store' },
    {
      $setOnInsert: {
        key: 'store',
        store: {
          name: 'HALDEN',
          tagline: 'Considered electronics',
          logoUrl: '/assets/halden-mark.svg',
          supportEmail: 'support@halden.example',
          phone: '+1 415 555 0180',
          address: 'San Francisco, California',
          announcement: 'Complimentary shipping on orders over $150',
          valueProps: [
            { title: 'Considered delivery', text: 'Complimentary standard delivery above $150.' },
            { title: 'Built to last', text: 'Reliable essentials selected with care.' },
            { title: 'Here to help', text: 'Our team is ready to help you choose.' },
          ],
        },
        currency: { code: 'USD', symbol: '$', decimals: 2 },
        tax: { ratePercent: 8, inclusive: false },
        shipping: {
          methods: [
            {
              code: 'standard',
              label: 'Standard delivery',
              price: 1200,
              freeOverSubtotal: 15000,
              estimatedDays: 5,
              isActive: true,
            },
            {
              code: 'express',
              label: 'Express delivery',
              price: 2400,
              estimatedDays: 2,
              isActive: true,
            },
          ],
        },
        inventory: { lowStockThreshold: 5 },
        theme: { primary: '#0E1116', accent: '#B08D57' },
        orderNumberPrefix: 'HLD',
        features: { reviews: false, wishlist: true },
      },
    },
    { upsert: true },
  );
  await SettingsModel.updateOne(
    { key: 'store', 'store.valueProps': { $exists: false } },
    {
      $set: {
        'store.valueProps': [
          { title: 'Considered delivery', text: 'Complimentary standard delivery above $150.' },
          { title: 'Built to last', text: 'Reliable essentials selected with care.' },
          { title: 'Here to help', text: 'Our team is ready to help you choose.' },
        ],
      },
    },
  );
  await DiscountModel.updateOne(
    { code: 'WELCOME10' },
    {
      $setOnInsert: {
        code: 'WELCOME10',
        type: 'percentage',
        value: 10,
        minSubtotal: 5000,
        usedCount: 0,
        perUserLimit: 1,
        appliesTo: { categories: [], products: [] },
        isActive: true,
      },
    },
    { upsert: true },
  );
  const categoryIds = [];
  for (const [index, group] of groups.entries()) {
    const category = await CategoryModel.findOneAndUpdate(
      { slug: group.slug },
      {
        $setOnInsert: {
          ...group,
          sortOrder: index,
          isActive: true,
          image: `/assets/products/${products[index * 6]?.slug ?? 'arc-headphones'}-1.svg`,
        },
      },
      { upsert: true, new: true },
    );
    categoryIds.push(category._id);
  }
  if (await ProductModel.exists({})) return;
  for (const [index, item] of products.entries()) {
    const colors = ['Graphite', 'Sand', 'Brass'];
    await ProductModel.create({
      name: item.name,
      slug: item.slug,
      description: item.summary,
      brand: 'HALDEN',
      category: categoryIds[Math.floor(index / 6)],
      tags: [item.slug.split('-')[0], groups[Math.floor(index / 6)]?.slug ?? 'electronics'],
      images: [
        {
          url: `/assets/products/${item.slug}-1.svg`,
          alt: `${item.name}, front view`,
          isPrimary: true,
        },
        {
          url: `/assets/products/${item.slug}-2.svg`,
          alt: `${item.name}, detail view`,
          isPrimary: false,
        },
      ],
      specs: [
        { label: 'Finish', value: 'Graphite, Sand or Brass' },
        { label: 'Warranty', value: 'Two years' },
      ],
      optionDefinitions: [{ name: 'Color', values: colors }],
      variants: colors.map((color, variantIndex) => ({
        sku: `HLD-${String(index + 1).padStart(3, '0')}-${color.slice(0, 3).toUpperCase()}`,
        options: { Color: color },
        price: item.base + variantIndex * 1000,
        compareAtPrice: item.base + variantIndex * 1000 + 2500,
        stock: index % 7 === 0 && variantIndex === 2 ? 0 : index % 8 === 0 ? 3 : 18 + index,
        lowStockThreshold: 5,
        isActive: true,
        images: [`/assets/products/${item.slug}-${variantIndex === 1 ? 2 : 1}.svg`],
      })),
      status: 'active',
      isFeatured: index % 6 === 0 || index === 19,
      soldCount: 30 - index,
      ratingAverage: 3.8 + (index % 6) * 0.2,
      ratingCount: 12 + index,
      seo: { metaTitle: `${item.name} | HALDEN`, metaDescription: item.summary },
    });
  }
}

export async function resetCatalogSeed(): Promise<void> {
  await ProductModel.deleteMany({});
  await CategoryModel.deleteMany({});
  await SettingsModel.deleteMany({});
  await DiscountModel.deleteMany({});
  await ensureCatalogSeed();
}
