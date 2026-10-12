import { ProductModel } from '@api/modules/catalog/product.model.js';
import { CategoryModel } from '@api/modules/catalog/category.model.js';
import { orderTransaction } from '@api/modules/orders/orders.service.js';
import { ConflictError, NotFoundError } from '@api/common/errors/app-error.js';
import { paginate } from '@api/common/utils/pagination.js';
import { adminCategoryDto } from './admin.mapper.js';
import type { CategoryInput, ListQuery } from './admin.schemas.js';
import { slugify } from './catalogue-admin.service.js';
export async function listAdminCategories(q: ListQuery) {
  const [rows, total] = await Promise.all([
    CategoryModel.find()
      .sort({ sortOrder: 1, name: 1 })
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .lean(),
    CategoryModel.countDocuments(),
  ]);
  return { data: rows.map(adminCategoryDto), meta: paginate(q.page, q.limit, total) };
}
export async function getAdminCategory(id: string) {
  const category = await CategoryModel.findById(id).lean();
  if (!category) throw new NotFoundError('Category not found');
  return adminCategoryDto(category);
}
export async function saveCategory(input: CategoryInput, id?: string) {
  return orderTransaction(async (session) => {
    const c = id ? await CategoryModel.findById(id).session(session) : new CategoryModel();
    if (!c) throw new NotFoundError('Category not found');
    if (input.parentId) {
      const parent = await CategoryModel.findById(input.parentId).session(session);
      if (!parent) throw new NotFoundError('Parent category not found');
      if (
        parent.parent ||
        String(parent._id) === String(c._id) ||
        (await CategoryModel.exists({ parent: c._id }).session(session))
      )
        throw new ConflictError('Categories support only two levels', 'parentId');
      await CategoryModel.updateOne({ _id: parent._id }, { $inc: { __v: 1 } }, { session });
    }
    c.set({
      name: input.name,
      slug: input.slug ?? (id ? c.slug : slugify(input.name)),
      description: input.description,
      image: input.image,
      sortOrder: input.sortOrder,
      isActive: input.isActive,
      parent: input.parentId || undefined,
    });
    await c.save({ session });
    return adminCategoryDto(c);
  });
}
export async function deleteCategory(id: string) {
  await orderTransaction(async (session) => {
    const c = await CategoryModel.findById(id).session(session);
    if (!c) throw new NotFoundError('Category not found');
    await CategoryModel.updateOne({ _id: id }, { $inc: { __v: 1 } }, { session });
    if (
      (await ProductModel.exists({ category: id }).session(session)) ||
      (await CategoryModel.exists({ parent: id }).session(session))
    )
      throw new ConflictError('Remove products and child categories first', 'category');
    await CategoryModel.deleteOne({ _id: id }, { session });
  });
}
