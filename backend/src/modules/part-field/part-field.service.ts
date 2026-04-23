import { prisma } from '../../config/db';

export class PartFieldService {

  async create(data: any) {
    const category = await prisma.partCategory.findUnique({
      where: { id: data.categoryId }
    });

    if (!category) {
      throw new Error('Category not found');
    }

    return prisma.partCategoryField.create({ data });
  }

  async getByCategory(categoryId: number) {
    return prisma.partCategoryField.findMany({
      where: { categoryId }
    });
  }

  async update(id: number, data: any) {
    if (typeof data.categoryId === 'number') {
      const category = await prisma.partCategory.findUnique({
        where: { id: data.categoryId }
      });

      if (!category) {
        throw new Error('Category not found');
      }
    }

    return prisma.partCategoryField.update({
      where: { id },
      data
    });
  }

  async delete(id: number) {
    const usageCount = await prisma.partCustomField.count({
      where: { fieldId: id }
    });

    if (usageCount > 0) {
      throw new Error('Cannot delete field that is already used by parts');
    }

    return prisma.partCategoryField.delete({
      where: { id }
    });
  }
}
