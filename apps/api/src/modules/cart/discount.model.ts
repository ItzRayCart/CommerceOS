import { model, Schema, type Types } from 'mongoose';
export interface Discount {
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  minSubtotal: number;
  maxDiscount?: number;
  startsAt?: Date;
  expiresAt?: Date;
  usageLimit?: number;
  usedCount: number;
  perUserLimit: number;
  appliesTo: { categories: Types.ObjectId[]; products: Types.ObjectId[] };
  isActive: boolean;
}
export const DiscountModel = model<Discount>(
  'DiscountCode',
  new Schema<Discount>(
    {
      code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        match: /^[A-Z0-9_-]{3,32}$/,
      },
      type: { type: String, required: true, enum: ['percentage', 'fixed'] },
      value: {
        type: Number,
        required: true,
        min: 1,
        validate: {
          validator(this: Discount, value: number) {
            return Number.isInteger(value) && (this.type !== 'percentage' || value <= 100);
          },
          message: 'Percentage must be between 1 and 100',
        },
      },
      minSubtotal: { type: Number, default: 0, min: 0 },
      maxDiscount: { type: Number, min: 0 },
      startsAt: Date,
      expiresAt: Date,
      usageLimit: Number,
      usedCount: { type: Number, default: 0 },
      perUserLimit: { type: Number, default: 1 },
      appliesTo: {
        categories: [{ type: Schema.Types.ObjectId }],
        products: [{ type: Schema.Types.ObjectId }],
      },
      isActive: { type: Boolean, default: true },
    },
    { timestamps: true },
  ),
);
interface Redemption {
  code: string;
  user: Types.ObjectId;
  order: Types.ObjectId;
  amount: number;
  at: Date;
}
const redemptionSchema = new Schema<Redemption>({
  code: String,
  user: Schema.Types.ObjectId,
  order: Schema.Types.ObjectId,
  amount: Number,
  at: { type: Date, default: Date.now },
});
redemptionSchema.index({ code: 1, user: 1 });
export const RedemptionModel = model<Redemption>('DiscountRedemption', redemptionSchema);
