export interface StoreSettings {
  store: {
    name: string;
    tagline: string;
    logoUrl: string;
    supportEmail: string;
    phone: string;
    address: string;
    announcement: string;
    valueProps: { title: string; text: string }[];
  };
  currency: { code: string; symbol: string; decimals: number };
  tax: { ratePercent: number; inclusive: boolean };
  shipping: {
    methods: {
      code: string;
      label: string;
      price: number;
      freeOverSubtotal?: number;
      estimatedDays: number;
    }[];
  };
  inventory: { lowStockThreshold: number };
  theme: { primary: string; accent: string };
  features: { reviews: boolean; wishlist: boolean };
}
export interface CategoryView {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: string;
  parentId: string | null;
  productCount: number;
  children: { id: string; name: string; slug: string }[];
  breadcrumbs?: { name: string; slug: string }[];
}
export interface ProductSummary {
  id: string;
  slug: string;
  name: string;
  primaryImage: { url: string; alt: string } | null;
  priceFrom: number;
  compareAtFrom: number | null;
  inStock: boolean;
  ratingAverage: number;
  ratingCount: number;
  category: { id: string; name: string; slug: string };
}
export interface ProductVariantView {
  id: string;
  sku: string;
  options: Record<string, string>;
  price: number;
  compareAtPrice: number | null;
  stock: number;
  lowStockThreshold: number;
  isActive: boolean;
  images: string[];
}
export interface ProductDetail extends ProductSummary {
  description: string;
  brand: string;
  tags: string[];
  images: { id: string; url: string; alt: string; isPrimary: boolean }[];
  specs: { label: string; value: string }[];
  optionDefinitions: { name: string; values: string[] }[];
  variants: ProductVariantView[];
  seo: { metaTitle?: string; metaDescription?: string };
}
export interface CatalogMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  facets?: {
    options: Record<string, { value: string; count: number }[]>;
    price: { min: number; max: number };
    categories: { slug: string; count: number }[];
  };
}
