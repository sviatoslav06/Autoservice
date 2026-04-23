import { type BoxStatus, type OrderStatus } from '@prisma/client';
import { prisma } from '../../config/db';

const BOX_BLOCKING_ORDER_STATUSES: OrderStatus[] = [
  'planned',
  'in_progress',
  'ready_for_delivery',
  'completed'
];

const BOX_STATUSES = ['free', 'busy', 'maintenance'] as const;

const isBoxStatus = (value: string | undefined): value is BoxStatus =>
  BOX_STATUSES.includes(value as (typeof BOX_STATUSES)[number]);

export class BoxService {

  async create(data: any) {
    return prisma.box.create({
      data
    });
  }

  async getAll(filters?: { status?: string; search?: string }) {
    const status = filters?.status;
    return prisma.box.findMany({
      where: {
        ...(isBoxStatus(status) ? { status } : {}),
        ...(filters?.search
          ? { boxNumber: { contains: filters.search, mode: 'insensitive' } }
          : {})
      },
      orderBy: { id: 'asc' }
    });
  }

  async getById(id: number) {
    return prisma.box.findUnique({
      where: { id }
    });
  }

  async update(id: number, data: any) {
    return prisma.box.update({
      where: { id },
      data
    });
  }

  async delete(id: number) {
    return prisma.box.delete({
      where: { id }
    });
  }

  async getAvailableBoxes(filters?: {
    search?: string;
    startTime?: Date;
    durationMinutes?: number;
    excludeOrderId?: number;
  }) {
    const boxes = await prisma.box.findMany({
      where: {
        ...(filters?.search
          ? { boxNumber: { contains: filters.search, mode: 'insensitive' } }
          : {})
      },
      orderBy: { id: 'asc' }
    });

    const startTime = filters?.startTime;

    if (!startTime || Number.isNaN(startTime.getTime())) {
      return boxes.map((box) => ({
        ...box,
        isAvailable: true
      }));
    }

    const dayStart = new Date(startTime);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(startTime);
    dayEnd.setHours(23, 59, 59, 999);

    const busyOrders = await prisma.order.findMany({
      where: {
        boxId: { in: boxes.map((box) => box.id) },
        status: { in: BOX_BLOCKING_ORDER_STATUSES },
        startTime: {
          gte: dayStart,
          lte: dayEnd
        },
        ...(typeof filters?.excludeOrderId === 'number'
          ? { id: { not: filters.excludeOrderId } }
          : {})
      },
      select: {
        boxId: true
      }
    });

    const busyByBox = new Map<number, number>();

    for (const order of busyOrders) {
      busyByBox.set(order.boxId, (busyByBox.get(order.boxId) ?? 0) + 1);
    }

    return boxes
      .map((box) => {
        const occupied = busyByBox.get(box.id) ?? 0;
        const load = box.capacity > 0 ? occupied / box.capacity : 1;

        return {
          ...box,
          isAvailable: occupied < box.capacity,
          _load: load
        };
      })
      .sort((left, right) => {
        if (left.isAvailable !== right.isAvailable) {
          return left.isAvailable ? -1 : 1;
        }

        if (left._load !== right._load) {
          return left._load - right._load;
        }

        if (left.capacity !== right.capacity) {
          return right.capacity - left.capacity;
        }

        return left.id - right.id;
      })
      .map(({ _load, ...box }) => box);
  }
}
