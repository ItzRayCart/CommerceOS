import { model, Schema, type Types } from 'mongoose';

interface Wishlist {
  user: Types.ObjectId;
  products: Types.ObjectId[];
}
const schema = new Schema<Wishlist>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    products: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
  },
  { timestamps: true },
);
export const WishlistModel = model<Wishlist>('Wishlist', schema);
