export interface CheckoutAddress {
  fullName: string;
  line1: string;
  line2?: string | undefined;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  phone: string;
}
export interface CheckoutInput {
  addressId?: string | undefined;
  address?: CheckoutAddress | undefined;
  shippingMethodCode: string;
}
export interface OrderInput extends CheckoutInput {
  quoteFingerprint?: string | undefined;
  payment: { method: 'card_mock' | 'cod'; token?: string | undefined; last4?: string | undefined };
}
export interface OrderTotals {
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
}
export interface OrderItem {
  productId: string;
  variantId: string;
  sku: string;
  name: string;
  variantLabel: string;
  image: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}
export interface CheckoutQuote {
  fingerprint: string;
  lines: OrderItem[];
  address: CheckoutAddress;
  shippingMethod: { code: string; label: string; price: number; estimatedDays: number };
  currency: { code: string; decimals: number };
  totals: OrderTotals;
  discountCode: string | null;
}
export interface OrderView {
  id: string;
  orderNumber: string;
  items: OrderItem[];
  shippingAddress: CheckoutAddress;
  shippingMethod: CheckoutQuote['shippingMethod'];
  totals: OrderTotals;
  currency: CheckoutQuote['currency'];
  discount?:
    { code: string; type: 'percentage' | 'fixed'; value: number; amount: number } | undefined;
  payment: {
    method: 'card_mock' | 'cod';
    status: 'unpaid' | 'paid' | 'refunded';
    transactionId?: string | undefined;
    last4?: string | undefined;
    paidAt?: string | undefined;
    refundedAt?: string | undefined;
  };
  status: 'pending' | 'paid' | 'shipped' | 'completed' | 'cancelled' | 'refunded';
  statusHistory: { status: string; at: string; by: string; note?: string | undefined }[];
  tracking?: { carrier: string; number: string; shippedAt: string } | undefined;
  createdAt: string;
}
