import { model, Schema, type Types } from 'mongoose';

export interface CartItem {
  _id: Types.ObjectId;
  product: Types.ObjectId;
  variantId: Types.ObjectId;
  quantity: number;
  quotedPriceHash?: string;
}
export interface Cart {
  user: Types.ObjectId;
  items: CartItem[];
  discountCode?: string;
}
const itemSchema = new Schema<CartItem>({
  product: { type: Schema.Types.ObjectId, required: true, ref: 'Product' },
  variantId: { type: Schema.Types.ObjectId, required: true },
  quantity: { type: Number, required: true, min: 1, max: 10, validate: Number.isInteger },
  quotedPriceHash: { type: String, match: /^[a-f0-9]{64}$/ },
});
export const CartModel = model<Cart>(
  'Cart',
  new Schema<Cart>(
    {
      user: { type: Schema.Types.ObjectId, required: true, unique: true, ref: 'User' },
      items: { type: [itemSchema], default: [] },
      discountCode: String,
    },
    { timestamps: true, optimisticConcurrency: true },
  ),
);
