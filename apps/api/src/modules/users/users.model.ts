import mongoose, { Schema } from 'mongoose';
import type { Types } from 'mongoose';
import { Role } from '@commerceos/shared';

export interface Address {
  _id: Types.ObjectId;
  label: string;
  fullName: string;
  line1: string;
  line2?: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  phone: string;
  isDefault: boolean;
}

export interface User {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: Role;
  status: 'active' | 'disabled';
  addresses: Address[];
  lastLoginAt?: Date;
  stats: { orderCount: number; totalSpent: number; lastOrderAt?: Date };
  createdAt: Date;
  updatedAt: Date;
}

const addressSchema = new Schema<Address>({
  label: { type: String, required: true, trim: true },
  fullName: { type: String, required: true, trim: true },
  line1: { type: String, required: true, trim: true },
  line2: { type: String, trim: true },
  city: { type: String, required: true, trim: true },
  region: { type: String, required: true, trim: true },
  postalCode: { type: String, required: true, trim: true },
  country: { type: String, required: true, uppercase: true },
  phone: { type: String, required: true, trim: true },
  isDefault: { type: Boolean, required: true, default: false },
});

const userSchema = new Schema<User>(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    passwordHash: { type: String, required: true, select: false },
    firstName: { type: String, required: true, trim: true, minlength: 1, maxlength: 60 },
    lastName: { type: String, required: true, trim: true, minlength: 1, maxlength: 60 },
    phone: { type: String, trim: true, match: /^\+?[1-9]\d{6,14}$/ },
    role: { type: String, enum: Object.values(Role), default: Role.Customer, required: true },
    status: { type: String, enum: ['active', 'disabled'], default: 'active', required: true },
    addresses: {
      type: [addressSchema],
      default: [],
      validate: {
        validator: (addresses: Address[]) =>
          addresses.length <= 10 &&
          (addresses.length === 0 || addresses.filter((address) => address.isDefault).length === 1),
        message: 'Addresses require at most ten entries and exactly one default',
      },
    },
    lastLoginAt: Date,
    stats: {
      orderCount: { type: Number, default: 0 },
      totalSpent: { type: Number, default: 0 },
      lastOrderAt: Date,
    },
  },
  { timestamps: true, strict: true },
);

userSchema.index({ email: 1 }, { unique: true });

export const UserModel = mongoose.model<User>('User', userSchema);
