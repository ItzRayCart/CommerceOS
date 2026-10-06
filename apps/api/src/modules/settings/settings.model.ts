import mongoose, { Schema } from 'mongoose';

export interface ShippingMethod {
  code: string;
  label: string;
  price: number;
  freeOverSubtotal?: number;
  estimatedDays: number;
  isActive: boolean;
}
export interface Settings {
  key: 'store';
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
  shipping: { methods: ShippingMethod[] };
  inventory: { lowStockThreshold: number };
  theme: { primary: string; accent: string };
  orderNumberPrefix: string;
  features: { reviews: boolean; wishlist: boolean };
  createdAt: Date;
  updatedAt: Date;
}

const methodSchema = new Schema<ShippingMethod>(
  {
    code: { type: String, required: true },
    label: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    freeOverSubtotal: { type: Number, min: 0 },
    estimatedDays: { type: Number, required: true, min: 1 },
    isActive: { type: Boolean, default: true },
  },
  { _id: false },
);
const valuePropSchema = new Schema<{ title: string; text: string }>(
  { title: { type: String, required: true }, text: { type: String, default: '' } },
  { _id: false },
);
const settingsSchema = new Schema<Settings>(
  {
    key: { type: String, enum: ['store'], required: true, unique: true },
    store: {
      name: { type: String, required: true },
      tagline: { type: String, default: '' },
      logoUrl: { type: String, default: '' },
      supportEmail: { type: String, required: true },
      phone: { type: String, default: '' },
      address: { type: String, default: '' },
      announcement: { type: String, default: '' },
      valueProps: { type: [valuePropSchema], default: [] },
    },
    currency: {
      code: { type: String, required: true },
      symbol: { type: String, required: true },
      decimals: { type: Number, required: true, min: 0, max: 3 },
    },
    tax: {
      ratePercent: { type: Number, required: true, min: 0 },
      inclusive: { type: Boolean, default: false },
    },
    shipping: { methods: { type: [methodSchema], default: [] } },
    inventory: { lowStockThreshold: { type: Number, default: 5, min: 0 } },
    theme: { primary: { type: String, required: true }, accent: { type: String, required: true } },
    orderNumberPrefix: { type: String, required: true },
    features: {
      reviews: { type: Boolean, default: false },
      wishlist: { type: Boolean, default: true },
    },
  },
  { timestamps: true, strict: true },
);

export const SettingsModel = mongoose.model<Settings>('Settings', settingsSchema, 'settings');
