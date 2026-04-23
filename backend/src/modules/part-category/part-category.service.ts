import { prisma } from '../../config/db';

export class PartCategoryService {

  async create(data: any) {
    return prisma.partCategory.create({ data });
  }

  async getAll() {
    return prisma.partCategory.findMany({
      include: { fields: true }
    });
  }

  async update(id: number, data: any) {
    return prisma.partCategory.update({
      where: { id },
      data
    });
  }

  async delete(id: number) {
    const [partsCount, fieldsCount] = await Promise.all([
      prisma.part.count({ where: { categoryId: id } }),
      prisma.partCategoryField.count({ where: { categoryId: id } })
    ]);

    if (partsCount > 0 || fieldsCount > 0) {
      throw new Error('Cannot delete category with linked parts or fields');
    }

    return prisma.partCategory.delete({
      where: { id }
    });
  }
}
