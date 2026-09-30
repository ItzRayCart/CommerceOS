import type { Types } from 'mongoose';
import type { Category } from '@api/modules/catalog/category.model.js';
import type { Product, ProductVariant } from '@api/modules/catalog/product.model.js';

export type CatalogCategory = Category & { _id: Types.ObjectId };
type CatalogVariant = Omit<ProductVariant, 'options'> & {
  options: Map<string, string> | Record<string, string>;
};
export type CatalogProduct = Omit<Product, 'variants'> & {
  _id: Types.ObjectId;
  variants: CatalogVariant[];
};

export function categoryDto(
  category: CatalogCategory,
  children: CatalogCategory[] = [],
  productCount = 0,
) {
  return {
    id: category._id.toString(),
    name: category.name,
    slug: category.slug,
    description: category.description ?? '',
    image: category.image ?? '',
    parentId: category.parent?.toString() ?? null,
    productCount,
    children: children.map((child) => ({
      id: child._id.toString(),
      name: child.name,
      slug: child.slug,
    })),
  };
}

export function variantDto(variant: CatalogVariant) {
  const options =
    variant.options instanceof Map
      ? Object.fromEntries(variant.options.entries())
      : variant.options;
  return {
    id: variant._id.toString(),
    sku: variant.sku,
    options,
    price: variant.price,
    compareAtPrice: variant.compareAtPrice ?? null,
    stock: variant.stock,
    lowStockThreshold: variant.lowStockThreshold,
    isActive: variant.isActive,
    images: variant.images,
  };
}

export function productSummaryDto(product: CatalogProduct, category: CatalogCategory) {
  const active = product.variants.filter((variant) => variant.isActive);
  const cheapest = active.reduce<CatalogVariant | undefined>(
    (chosen, variant) => (!chosen || variant.price < chosen.price ? variant : chosen),
    undefined,
  );
  const primary = product.images.find((image) => image.isPrimary) ?? product.images[0];
  return {
    id: product._id.toString(),
    slug: product.slug,
    name: product.name,
    primaryImage: primary ? { url: primary.url, alt: primary.alt } : null,
    priceFrom: product.minPrice,
    compareAtFrom: cheapest?.compareAtPrice ?? null,
    inStock: active.some((variant) => variant.stock > 0),
    ratingAverage: product.ratingAverage,
    ratingCount: product.ratingCount,
    category: { id: category._id.toString(), name: category.name, slug: category.slug },
  };
}

export function productDetailDto(product: CatalogProduct, category: CatalogCategory) {
  return {
    ...productSummaryDto(product, category),
    description: product.description,
    brand: product.brand,
    tags: product.tags,
    images: product.images.map((image) => ({
      id: image._id.toString(),
      url: image.url,
      alt: image.alt,
      isPrimary: image.isPrimary,
    })),
    specs: product.specs.map((spec) => ({ label: spec.label, value: spec.value })),
    optionDefinitions: product.optionDefinitions.map((option) => ({
      name: option.name,
      values: option.values,
    })),
    variants: product.variants.filter((variant) => variant.isActive).map(variantDto),
    seo: { metaTitle: product.seo.metaTitle, metaDescription: product.seo.metaDescription },
  };
}
