import mongoose, { Schema } from 'mongoose';
import type { Types } from 'mongoose';

export interface ProductImage {
  _id: Types.ObjectId;
  url: string;
  alt: string;
  isPrimary: boolean;
}
export interface ProductVariant {
  _id: Types.ObjectId;
  sku: string;
  options: Map<string, string>;
  price: number;
  compareAtPrice?: number;
  stock: number;
  lowStockThreshold: number;
  weightGrams?: number;
  isActive: boolean;
  images: string[];
}
export interface Product {
  name: string;
  slug: string;
  description: string;
  brand: string;
  category: Types.ObjectId;
  tags: string[];
  images: ProductImage[];
  specs: { label: string; value: string }[];
  optionDefinitions: { name: string; values: string[] }[];
  variants: ProductVariant[];
  status: 'draft' | 'active' | 'archived';
  isFeatured: boolean;
  seo: { metaTitle?: string; metaDescription?: string };
  minPrice: number;
  maxPrice: number;
  totalStock: number;
  soldCount: number;
  ratingAverage: number;
  ratingCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const imageSchema = new Schema<ProductImage>({
  url: { type: String, required: true },
  alt: { type: String, required: true },
  isPrimary: { type: Boolean, default: false },
});
const variantSchema = new Schema<ProductVariant>({
  sku: { type: String, required: true, uppercase: true, trim: true },
  options: { type: Map, of: String, default: {} },
  price: { type: Number, required: true, min: 0, validate: Number.isInteger },
  compareAtPrice: { type: Number, min: 0, validate: Number.isInteger },
  stock: { type: Number, required: true, min: 0, validate: Number.isInteger },
  lowStockThreshold: { type: Number, default: 5, min: 0 },
  weightGrams: { type: Number, min: 0 },
  isActive: { type: Boolean, default: true },
  images: { type: [String], default: [] },
});
const productSchema = new Schema<Product>(
  {
    name: { type: String, required: true, minlength: 2, maxlength: 140 },
    slug: { type: String, required: true },
    description: { type: String, required: true },
    brand: { type: String, required: true },
    category: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    tags: { type: [String], default: [], validate: (tags: string[]) => tags.length <= 20 },
    images: { type: [imageSchema], default: [] },
    specs: {
      type: [{ label: { type: String, required: true }, value: { type: String, required: true } }],
      default: [],
    },
    optionDefinitions: { type: [{ name: String, values: [String] }], default: [] },
    variants: { type: [variantSchema], default: [] },
    status: { type: String, enum: ['draft', 'active', 'archived'], default: 'draft' },
    isFeatured: { type: Boolean, default: false },
    seo: { metaTitle: String, metaDescription: String },
    minPrice: { type: Number, default: 0 },
    maxPrice: { type: Number, default: 0 },
    totalStock: { type: Number, default: 0 },
    soldCount: { type: Number, default: 0 },
    ratingAverage: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
  },
  { timestamps: true, strict: true },
);

productSchema.pre('validate', function () {
  const active = this.variants.filter((variant) => variant.isActive);
  if (this.variants.length < 1) this.invalidate('variants', 'At least one variant is required');
  if (
    this.status === 'active' &&
    (this.images.length < 1 || this.images.filter((image) => image.isPrimary).length !== 1)
  ) {
    this.invalidate('images', 'Active products require one primary image');
  }
  if (
    this.optionDefinitions.length > 3 ||
    this.optionDefinitions.some((option) => option.values.length > 20)
  ) {
    this.invalidate('optionDefinitions', 'Option limits exceeded');
  }
  const skus = this.variants.map((variant) => variant.sku);
  if (new Set(skus).size !== skus.length) this.invalidate('variants', 'SKUs must be unique');
  const combinations = this.variants.map((variant) => JSON.stringify([...variant.options].sort()));
  if (new Set(combinations).size !== combinations.length)
    this.invalidate('variants', 'Variant combinations must be unique');
  for (const variant of this.variants) {
    if (variant.compareAtPrice !== undefined && variant.compareAtPrice <= variant.price) {
      this.invalidate('variants', 'Compare-at price must exceed price');
    }
  }
  this.minPrice = active.length ? Math.min(...active.map((variant) => variant.price)) : 0;
  this.maxPrice = active.length ? Math.max(...active.map((variant) => variant.price)) : 0;
  this.totalStock = this.variants.reduce((total, variant) => total + variant.stock, 0);
});
productSchema.index({ slug: 1 }, { unique: true });
productSchema.index({ status: 1, category: 1, minPrice: 1 });
productSchema.index({ status: 1, isFeatured: 1 });
productSchema.index({ status: 1, soldCount: -1 });
productSchema.index(
  { name: 'text', tags: 'text', description: 'text' },
  { weights: { name: 10, tags: 5, description: 1 } },
);
productSchema.index({ 'variants.sku': 1 }, { unique: true });

export const ProductModel = mongoose.model<Product>('Product', productSchema, 'products');
