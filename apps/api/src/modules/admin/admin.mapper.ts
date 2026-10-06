import type {
  AdminProduct,
  AdminCategory,
  AdminCustomer,
  AdminDiscount,
  AdminSettings,
  StockMovement,
} from '@commerceos/shared';
import type { CatalogProduct, CatalogCategory } from '@api/modules/catalog/catalog.mapper.js';
import { variantDto } from '@api/modules/catalog/catalog.mapper.js';
import type { User } from '@api/modules/users/users.model.js';
import type { Discount } from '@api/modules/cart/discount.model.js';
import type { Settings } from '@api/modules/settings/settings.model.js';
import type { Types } from 'mongoose';
type Identified<T> = T & { _id: Types.ObjectId };
export function adminProductDto(p: CatalogProduct): AdminProduct {
  return {
    id: p._id.toString(),
    name: p.name,
    slug: p.slug,
    description: p.description,
    brand: p.brand,
    category: p.category.toString(),
    tags: p.tags,
    images: p.images.map((i) => ({ url: i.url, alt: i.alt, isPrimary: i.isPrimary })),
    specs: p.specs.map((s) => ({ label: s.label, value: s.value })),
    optionDefinitions: p.optionDefinitions.map((o) => ({ name: o.name, values: o.values })),
    variants: p.variants.map((v) => {
      const dto = variantDto(v);
      return {
        ...dto,
        ...(dto.compareAtPrice === null ? {} : { compareAtPrice: dto.compareAtPrice }),
        compareAtPrice: dto.compareAtPrice ?? undefined,
      } as AdminProduct['variants'][number];
    }),
    status: p.status,
    isFeatured: p.isFeatured,
    seo: {
      ...(p.seo.metaTitle ? { metaTitle: p.seo.metaTitle } : {}),
      ...(p.seo.metaDescription ? { metaDescription: p.seo.metaDescription } : {}),
    },
    minPrice: p.minPrice,
    totalStock: p.totalStock,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}
export function adminCategoryDto(c: CatalogCategory): AdminCategory {
  return {
    id: c._id.toString(),
    name: c.name,
    slug: c.slug,
    parentId: c.parent?.toString() ?? null,
    description: c.description ?? '',
    image: c.image ?? '',
    sortOrder: c.sortOrder,
    isActive: c.isActive,
  };
}
export function adminCustomerDto(u: Identified<User>): AdminCustomer {
  return {
    id: u._id.toString(),
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    role: u.role,
    status: u.status,
    createdAt: u.createdAt.toISOString(),
    stats: {
      orderCount: u.stats.orderCount,
      totalSpent: u.stats.totalSpent,
      ...(u.stats.lastOrderAt ? { lastOrderAt: u.stats.lastOrderAt.toISOString() } : {}),
    },
    addresses: u.addresses.map((a) => ({
      fullName: a.fullName,
      line1: a.line1,
      city: a.city,
      country: a.country,
      phone: a.phone,
    })),
  };
}
export function discountStatus(d: Discount): string {
  const now = new Date();
  return !d.isActive
    ? 'disabled'
    : d.startsAt && d.startsAt > now
      ? 'scheduled'
      : d.expiresAt && d.expiresAt < now
        ? 'expired'
        : d.usageLimit !== undefined && d.usedCount >= d.usageLimit
          ? 'exhausted'
          : 'active';
}
export function adminDiscountDto(d: Identified<Discount>): AdminDiscount {
  return {
    id: d._id.toString(),
    code: d.code,
    description: d.description ?? '',
    type: d.type,
    value: d.value,
    minSubtotal: d.minSubtotal,
    ...(d.maxDiscount === undefined ? {} : { maxDiscount: d.maxDiscount }),
    ...(d.startsAt ? { startsAt: d.startsAt.toISOString() } : {}),
    ...(d.expiresAt ? { expiresAt: d.expiresAt.toISOString() } : {}),
    ...(d.usageLimit === undefined ? {} : { usageLimit: d.usageLimit }),
    usedCount: d.usedCount,
    perUserLimit: d.perUserLimit,
    appliesTo: {
      categories: d.appliesTo.categories.map(String),
      products: d.appliesTo.products.map(String),
    },
    isActive: d.isActive,
    status: discountStatus(d),
  };
}
export function adminSettingsDto(s: Settings): AdminSettings {
  return {
    store: {
      name: s.store.name,
      tagline: s.store.tagline,
      logoUrl: s.store.logoUrl,
      supportEmail: s.store.supportEmail,
      phone: s.store.phone,
      address: s.store.address,
      announcement: s.store.announcement,
      valueProps: s.store.valueProps.map((v) => ({ title: v.title, text: v.text })),
    },
    currency: { ...s.currency },
    tax: { ratePercent: s.tax.ratePercent, inclusive: false },
    shipping: {
      methods: s.shipping.methods.map((m) => ({
        code: m.code,
        label: m.label,
        price: m.price,
        ...(m.freeOverSubtotal === undefined ? {} : { freeOverSubtotal: m.freeOverSubtotal }),
        estimatedDays: m.estimatedDays,
        isActive: m.isActive,
      })),
    },
    inventory: { lowStockThreshold: s.inventory.lowStockThreshold },
    theme: { primary: s.theme.primary, accent: s.theme.accent },
    features: { reviews: s.features.reviews, wishlist: s.features.wishlist },
    orderNumberPrefix: s.orderNumberPrefix,
  };
}
export function movementDto(m: {
  _id: Types.ObjectId;
  product: Types.ObjectId;
  variantId: Types.ObjectId;
  sku: string;
  delta: number;
  stockAfter: number;
  reason: string;
  note?: string;
  by: string | Types.ObjectId;
  createdAt: Date;
}): StockMovement {
  return {
    id: String(m._id),
    productId: String(m.product),
    variantId: String(m.variantId),
    sku: m.sku,
    delta: m.delta,
    stockAfter: m.stockAfter,
    reason: m.reason,
    note: m.note ?? '',
    by: String(m.by),
    createdAt: m.createdAt.toISOString(),
  };
}
