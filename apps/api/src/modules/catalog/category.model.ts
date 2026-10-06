import mongoose, { Schema } from 'mongoose';
import type { Types } from 'mongoose';

export interface Category {
  name: string;
  slug: string;
  parent?: Types.ObjectId;
  description?: string;
  image?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new Schema<Category>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    slug: { type: String, required: true },
    parent: { type: Schema.Types.ObjectId, ref: 'Category' },
    description: { type: String, maxlength: 1000 },
    image: String,
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, strict: true },
);
categorySchema.index({ slug: 1 }, { unique: true });
categorySchema.index({ parent: 1, name: 1 }, { unique: true });
categorySchema.index({ isActive: 1, sortOrder: 1, name: 1 });

export const CategoryModel = mongoose.model<Category>('Category', categorySchema, 'categories');
