import { prisma } from '../../config/db';

interface PartCustomFieldInput {
  fieldId: number;
  value: string;
}

export class PartService {
  async getAll(filters?: {
    categoryId?: number;
    search?: string;
    supplier?: string;
    inStockOnly?: boolean;
    lowStockBelow?: number;
  }) {
    return prisma.part.findMany({
      where: {
        ...(typeof filters?.categoryId === 'number'
          ? { categoryId: filters.categoryId }
          : {}),
        ...(filters?.search
          ? {
              OR: [
                { name: { contains: filters.search, mode: 'insensitive' } },
                { article: { contains: filters.search, mode: 'insensitive' } }
              ]
            }
          : {}),
        ...(filters?.supplier
          ? { supplier: { contains: filters.supplier, mode: 'insensitive' } }
          : {}),
        ...(filters?.inStockOnly ? { stockQuantity: { gt: 0 } } : {}),
        ...(typeof filters?.lowStockBelow === 'number'
          ? { stockQuantity: { lte: filters.lowStockBelow } }
          : {})
      },
      include: {
        category: true,
        customFields: {
          include: {
            field: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  private validateFieldValue(fieldType: string, value: string) {
    switch (fieldType) {
      case 'number':
        if (Number.isNaN(Number(value))) {
          throw new Error('Custom field value must be a number');
        }
        break;
      case 'date':
        if (Number.isNaN(new Date(value).getTime())) {
          throw new Error('Custom field value must be a valid date');
        }
        break;
      case 'boolean':
        if (!['true', 'false'].includes(value.toLowerCase())) {
          throw new Error('Custom field value must be true or false');
        }
        break;
      default:
        break;
    }
  }

  private async validateCustomFields(
    categoryId: number,
    customFields: PartCustomFieldInput[] | undefined
  ) {
    const categoryFields = await prisma.partCategoryField.findMany({
      where: { categoryId }
    });

    const requiredFieldIds = categoryFields
      .filter((field) => field.isRequired)
      .map((field) => field.id);
    const payloadFieldIds = new Set((customFields ?? []).map((field) => field.fieldId));

    for (const requiredFieldId of requiredFieldIds) {
      if (!payloadFieldIds.has(requiredFieldId)) {
        throw new Error('Missing required custom fields for selected category');
      }
    }

    for (const customField of customFields ?? []) {
      const definition = categoryFields.find((field) => field.id === customField.fieldId);
      if (!definition) {
        throw new Error('Custom field does not belong to selected category');
      }

      if (definition.isRequired && !customField.value.trim()) {
        throw new Error(`Custom field "${definition.fieldName}" is required`);
      }

      this.validateFieldValue(definition.fieldType, customField.value);
    }
  }

  async create(data: any) {
    const { customFields, ...partData } = data;
    await this.validateCustomFields(partData.categoryId, customFields);

    return prisma.$transaction(async (tx) => {
      const part = await tx.part.create({
        data: partData
      });

      if (customFields?.length) {
        await tx.partCustomField.createMany({
          data: customFields.map((customField: PartCustomFieldInput) => ({
            partId: part.id,
            fieldId: customField.fieldId,
            fieldValue: customField.value
          }))
        });
      }

      return tx.part.findUnique({
        where: { id: part.id },
        include: {
          category: true,
          customFields: {
            include: {
              field: true
            }
          }
        }
      });
    });
  }

  async getById(id: number) {
    return prisma.part.findUnique({
      where: { id },
      include: {
        category: true,
        customFields: {
          include: {
            field: true
          }
        }
      }
    });
  }

  async update(id: number, data: any) {
    const existingPart = await prisma.part.findUnique({
      where: { id },
      include: { customFields: true }
    });

    if (!existingPart) {
      throw new Error('Part not found');
    }

    const categoryId = data.categoryId ?? existingPart.categoryId;
    const customFields = data.customFields as PartCustomFieldInput[] | undefined;
    if (customFields) {
      await this.validateCustomFields(categoryId, customFields);
    }

    return prisma.$transaction(async (tx) => {
      const { customFields: nextCustomFields, ...partData } = data;

      await tx.part.update({
        where: { id },
        data: {
          ...partData,
          categoryId
        }
      });

      if (nextCustomFields) {
        await tx.partCustomField.deleteMany({
          where: { partId: id }
        });

        if (nextCustomFields.length) {
          await tx.partCustomField.createMany({
            data: nextCustomFields.map((customField: PartCustomFieldInput) => ({
              partId: id,
              fieldId: customField.fieldId,
              fieldValue: customField.value
            }))
          });
        }
      }

      return tx.part.findUnique({
        where: { id },
        include: {
          category: true,
          customFields: {
            include: {
              field: true
            }
          }
        }
      });
    });
  }

  async delete(id: number) {
    const usageCount = await prisma.orderPart.count({
      where: { partId: id }
    });

    if (usageCount > 0) {
      throw new Error('Cannot delete part that is already used in orders');
    }

    return prisma.part.delete({
      where: { id }
    });
  }

  async decreaseStock(partId: number, quantity: number) {
    const part = await prisma.part.findUnique({
      where: { id: partId }
    });

    if (!part) {
      throw new Error('Part not found');
    }

    if (part.stockQuantity < quantity) {
      throw new Error('Insufficient stock');
    }

    return prisma.part.update({
      where: { id: partId },
      data: {
        stockQuantity: {
          decrement: quantity
        }
      }
    });
  }
}
