import type { OrderView } from './orders.js';
export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  description: string;
  image: string;
  sortOrder: number;
  isActive: boolean;
}
export interface AdminVariant {
  id?: string;
  sku: string;
  options: Record<string, string>;
  price: number;
  compareAtPrice?: number;
  stock: number;
  lowStockThreshold: number;
  isActive: boolean;
  images: string[];
  weightGrams?: number;
}
export interface AdminProduct {
  id: string;
  name: string;
  slug: string;
  description: string;
  brand: string;
  category: string;
  tags: string[];
  images: { url: string; alt: string; isPrimary: boolean }[];
  specs: { label: string; value: string }[];
  optionDefinitions: { name: string; values: string[] }[];
  variants: AdminVariant[];
  status: 'draft' | 'active' | 'archived';
  isFeatured: boolean;
  seo: { metaTitle?: string; metaDescription?: string };
  minPrice: number;
  totalStock: number;
  createdAt: string;
  updatedAt: string;
}
export interface InventoryRow {
  productId: string;
  name: string;
  variantId: string;
  sku: string;
  stock: number;
  lowStockThreshold: number;
  price: number;
  isActive: boolean;
}
export interface StockMovement {
  id: string;
  productId: string;
  variantId: string;
  sku: string;
  delta: number;
  stockAfter: number;
  reason: string;
  note: string;
  by: string;
  createdAt: string;
}
export interface AdminOrder extends OrderView {
  customer: { id: string; email: string; name: string };
  internalNotes: { text: string; by: string; at: string }[];
}
export interface AdminCustomer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'customer';
  status: 'active' | 'disabled';
  createdAt: string;
  stats: { orderCount: number; totalSpent: number; lastOrderAt?: string };
  addresses: { fullName: string; line1: string; city: string; country: string; phone: string }[];
  lifetimeValue?: number;
}
export interface AdminDiscount {
  id: string;
  code: string;
  description: string;
  type: 'percentage' | 'fixed';
  value: number;
  minSubtotal: number;
  maxDiscount?: number;
  startsAt?: string;
  expiresAt?: string;
  usageLimit?: number;
  usedCount: number;
  perUserLimit: number;
  appliesTo: { categories: string[]; products: string[] };
  isActive: boolean;
  status: string;
  redemptions?: number;
  discounted?: number;
}
export interface AdminSettings {
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
  tax: { ratePercent: number; inclusive: false };
  shipping: {
    methods: {
      code: string;
      label: string;
      price: number;
      freeOverSubtotal?: number | undefined;
      estimatedDays: number;
      isActive: boolean;
    }[];
  };
  inventory: { lowStockThreshold: number };
  theme: { primary: string; accent: string };
  orderNumberPrefix: string;
  features: { reviews: boolean; wishlist: boolean };
}
export interface Metric {
  value: number;
  previous: number;
  delta: number | null;
}
export interface RevenuePoint {
  date: string;
  revenue: number;
  orders: number;
  aov: number;
}
export interface ProductMetric {
  productId: string;
  name: string;
  revenue: number;
  units: number;
}
export interface DashboardSummary {
  revenue: Metric;
  orders: Metric;
  customers: Metric;
  aov: Metric;
  statusCounts: { status: string; count: number }[];
  revenueSeries: RevenuePoint[];
  topProducts: ProductMetric[];
  lowStock: InventoryRow[];
  recentOrders: AdminOrder[];
  inventory: { totalSkus: number; out: number; low: number; value: number };
}
export interface NamedMetric {
  name: string;
  revenue: number;
  units: number;
}
export interface CustomerMetrics {
  newCustomers: number;
  returningCustomers: number;
  series: { date: string; count: number }[];
}
export interface DiscountMetric {
  code: string;
  redemptions: number;
  discounted: number;
}
