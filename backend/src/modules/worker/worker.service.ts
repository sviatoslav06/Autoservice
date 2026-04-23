import { prisma } from '../../config/db';

export class WorkerService {
  async getMechanics() {
    return prisma.worker.findMany({
      where: {
        position: 'Mechanic',
      },
      select: {
        id: true,
        position: true,
        hourlyRate: true,
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: {
        id: 'asc',
      },
    });
  }

  async getAvailableMechanics(filters?: {
    startTime?: Date;
    durationMinutes?: number;
    excludeOrderId?: number;
  }) {
    const mechanics = await this.getMechanics();

    if (!filters?.startTime || !filters.durationMinutes || Number.isNaN(filters.startTime.getTime())) {
      return mechanics.map((mechanic) => ({
        ...mechanic,
        isAvailable: true
      }));
    }

    const requestedEnd = new Date(
      filters.startTime.getTime() + filters.durationMinutes * 60_000
    );

    const busyAssignments = await prisma.orderService.findMany({
      where: {
        workerId: { in: mechanics.map((mechanic) => mechanic.id) },
        order: {
          status: { in: ['planned', 'in_progress', 'ready_for_delivery'] },
          ...(typeof filters?.excludeOrderId === 'number'
            ? { id: { not: filters.excludeOrderId } }
            : {})
        }
      },
      select: {
        workerId: true,
        order: {
          select: {
            startTime: true,
            totalDurationMinutes: true
          }
        }
      }
    });

    const busyWorkerIds = new Set<number>();

    for (const assignment of busyAssignments) {
      const duration = assignment.order.totalDurationMinutes ?? 60;
      const orderEnd = new Date(
        assignment.order.startTime.getTime() + duration * 60_000
      );
      const hasConflict =
        filters.startTime < orderEnd && requestedEnd > assignment.order.startTime;

      if (hasConflict) {
        busyWorkerIds.add(assignment.workerId);
      }
    }

    return mechanics
      .filter((mechanic) => !busyWorkerIds.has(mechanic.id))
      .map((mechanic) => ({
        ...mechanic,
        isAvailable: true
      }));
  }
}
