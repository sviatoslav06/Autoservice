import { prisma } from '../../config/db';

export class ServiceService {

  async create(data: any) {
    return prisma.service.create({
      data
    });
  }

  async getAll(filters?: { search?: string }) {
    return prisma.service.findMany({
      where: filters?.search
        ? {
            OR: [
              { name: { contains: filters.search, mode: 'insensitive' } },
              { description: { contains: filters.search, mode: 'insensitive' } }
            ]
          }
        : undefined,
      orderBy: { id: 'asc' }
    });
  }

  async getById(id: number) {
    return prisma.service.findUnique({
      where: { id }
    });
  }

  async update(id: number, data: any) {
    return prisma.service.update({
      where: { id },
      data
    });
  }

  async delete(id: number) {
    return prisma.service.delete({
      where: { id }
    });
  }
}
