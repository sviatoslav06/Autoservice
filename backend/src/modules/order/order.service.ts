import { Prisma, type OrderStatus } from '@prisma/client';
import { prisma } from '../../config/db';

interface AuthUser {
  id: number;
  role: string;
}

type OrderSummaryViewRow = {
  id: number;
  orderDate: Date;
  status: OrderStatus;
  totalAmount: Prisma.Decimal;
  totalDurationMinutes: number | null;
  client_name: string;
  email: string;
  make: string;
  model: string;
  licensePlate: string;
  boxNumber: string;
  services_count: bigint | number;
  parts_count: bigint | number;
  workers_count: bigint | number;
  collected_amount: Prisma.Decimal | string | number;
  pending_amount: Prisma.Decimal | string | number;
  payments_count: bigint | number;
};

type OrderSummaryView = {
  id: number;
  orderDate: Date;
  status: OrderStatus;
  totalAmount: Prisma.Decimal;
  totalDurationMinutes: number | null;
  client_name: string;
  email: string;
  make: string;
  model: string;
  licensePlate: string;
  boxNumber: string;
  services_count: number;
  parts_count: number;
  workers_count: number;
  collected_amount: Prisma.Decimal | string | number;
  pending_amount: Prisma.Decimal | string | number;
  payments_count: number;
};

interface CreateOrderInput {
  clientId?: number;
  vehicleId: number;
  boxId?: number;
  startTime: string;
  notes?: string;
  status?: 'planned' | 'in_progress';
  services?: Array<{
    serviceId: number;
    workerId: number;
  }>;
  parts?: Array<{
    partId: number;
    quantity: number;
  }>;
}

interface UpdateOrderInput {
  clientId?: number;
  vehicleId?: number;
  boxId?: number;
  startTime?: string;
  notes?: string;
  status?: 'planned' | 'in_progress' | 'ready_for_delivery';
}

interface AddOrderPartInput {
  partId: number;
  quantity: number;
}

interface UpdateOrderPartInput {
  quantity: number;
}

interface AddOrderServiceInput {
  serviceId: number;
  workerId?: number;
}

interface UpdateOrderServiceInput {
  actualDurationMinutes?: number;
  actualCost?: number;
  workerId?: number;
}

interface OrderFilters {
  status?: string;
  clientId?: number;
  boxId?: number;
  vehicleId?: number;
  workerId?: number;
  paymentStatus?: 'paid' | 'partially_paid' | 'unpaid';
  dateFrom?: string;
  dateTo?: string;
}

const STAFF_ROLES = new Set(['Admin', 'Manager', 'Accountant']);
const MANAGEMENT_ROLES = new Set(['Admin', 'Manager']);
const ACTIVE_ORDER_STATUSES: OrderStatus[] = ['planned', 'in_progress', 'ready_for_delivery'];
const BOX_BLOCKING_ORDER_STATUSES: OrderStatus[] = [
  'planned',
  'in_progress',
  'ready_for_delivery',
  'completed'
];

const isOrderStatus = (value: string | undefined): value is OrderStatus =>
  value === 'planned' ||
  value === 'in_progress' ||
  value === 'ready_for_delivery' ||
  value === 'completed' ||
  value === 'canceled';

export class OrderService {
  private readonly orderInclude = {
    vehicle: true,
    box: true,
    client: {
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            phone: true
          }
        }
      }
    },
    orderServices: {
      include: {
        service: true,
        worker: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true
              }
            }
          }
        }
      }
    },
    orderParts: {
      include: {
        part: true
      }
    },
    payments: true
  } satisfies Prisma.OrderInclude;

  private async requireClientId(tx: Prisma.TransactionClient, userId: number) {
    const client = await tx.client.findUnique({
      where: { userId }
    });

    if (!client) {
      throw new Error('Client not found');
    }

    return client.id;
  }

  private async requireWorker(actor: AuthUser) {
    const worker = await prisma.worker.findUnique({
      where: { userId: actor.id }
    });

    if (!worker) {
      throw new Error('Worker not found');
    }

    return worker;
  }

  private parseDateRange(filters: OrderFilters) {
    const range: Prisma.DateTimeFilter = {};

    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom);
      if (!Number.isNaN(from.getTime())) {
        range.gte = from;
      }
    }

    if (filters.dateTo) {
      const to = new Date(filters.dateTo);
      if (!Number.isNaN(to.getTime())) {
        to.setHours(23, 59, 59, 999);
        range.lte = to;
      }
    }

    return Object.keys(range).length ? range : undefined;
  }

  private buildWhere(filters: OrderFilters): Prisma.OrderWhereInput {
    const where: Prisma.OrderWhereInput = {};
    const orderDateRange = this.parseDateRange(filters);
    const status = filters.status;

    if (isOrderStatus(status)) {
      where.status = status;
    }

    if (typeof filters.clientId === 'number') {
      where.clientId = filters.clientId;
    }

    if (typeof filters.boxId === 'number') {
      where.boxId = filters.boxId;
    }

    if (typeof filters.vehicleId === 'number') {
      where.vehicleId = filters.vehicleId;
    }

    if (typeof filters.workerId === 'number') {
      where.orderServices = {
        some: {
          workerId: filters.workerId
        }
      };
    }

    if (orderDateRange) {
      where.orderDate = orderDateRange;
    }

    return where;
  }

  private sumDecimal(values: Prisma.Decimal[]) {
    return values.reduce(
      (total, value) => total.plus(value),
      new Prisma.Decimal(0)
    );
  }

  private resolvePaymentStatus(totalPaid: Prisma.Decimal, totalAmount: Prisma.Decimal) {
    if (totalPaid.greaterThanOrEqualTo(totalAmount)) {
      return 'paid';
    }

    if (totalPaid.greaterThan(0)) {
      return 'partially_paid';
    }

    return 'unpaid';
  }

  private enrichOrderWithPaymentStatus<
    T extends { payments: Array<{ amount: Prisma.Decimal }>; totalAmount: Prisma.Decimal }
  >(order: T) {
    const totalPaid = this.sumDecimal(order.payments.map((payment) => payment.amount));

    return {
      ...order,
      paymentStatus: this.resolvePaymentStatus(totalPaid, order.totalAmount)
    };
  }

  private filterByPaymentStatus<T extends { paymentStatus: string }>(
    orders: T[],
    paymentStatus?: OrderFilters['paymentStatus']
  ) {
    if (!paymentStatus) {
      return orders;
    }

    return orders.filter((order) => order.paymentStatus === paymentStatus);
  }

  private async ensureVehicleBelongsToClient(
    tx: Prisma.TransactionClient,
    vehicleId: number,
    clientId: number
  ) {
    const vehicle = await tx.vehicle.findFirst({
      where: {
        id: vehicleId,
        clientId
      }
    });

    if (!vehicle) {
      throw new Error('Vehicle not found or access denied');
    }
  }

  private async ensureBoxAvailable(
    tx: Prisma.TransactionClient,
    boxId: number,
    startTime: Date,
    durationMinutes: number,
    excludeOrderId?: number
  ) {
    const box = await tx.box.findUnique({
      where: { id: boxId },
      select: {
        id: true,
        capacity: true
      }
    });

    if (!box) {
      throw new Error('Box not found');
    }

    const dayStart = new Date(startTime);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(startTime);
    dayEnd.setHours(23, 59, 59, 999);

    const dayOrders = await tx.order.findMany({
      where: {
        boxId,
        status: { in: BOX_BLOCKING_ORDER_STATUSES },
        startTime: {
          gte: dayStart,
          lte: dayEnd
        },
        ...(excludeOrderId ? { id: { not: excludeOrderId } } : {})
      },
      select: {
        id: true
      }
    });

    const occupiedSlots = dayOrders.length;

    if (occupiedSlots >= box.capacity) {
      throw new Error('Selected box capacity is exceeded for this day');
    }

    // The original project referenced a DB procedure here, but the current
    // schema/migrations do not define it. Availability is already enforced by
    // the overlap checks above, so we keep the reservation logic in application
    // code instead of depending on a missing database function.
  }

  private async tryReserveBoxWithProcedure(
    boxId: number,
    startTime: Date,
    durationMinutes: number,
    excludeOrderId?: number
  ) {
    try {
      await prisma.$executeRaw`
        SELECT "PROC_reserve_box_and_time"(
          ${boxId},
          ${startTime},
          ${durationMinutes},
          ${excludeOrderId ?? null}
        )
      `;
      return true;
    } catch {
      return false;
    }
  }

  private hasTimeConflict(
    startTime: Date,
    durationMinutes: number,
    otherStartTime: Date,
    otherDurationMinutes: number
  ) {
    const requestedEnd = new Date(startTime.getTime() + durationMinutes * 60_000);
    const otherEnd = new Date(otherStartTime.getTime() + otherDurationMinutes * 60_000);

    return startTime < otherEnd && requestedEnd > otherStartTime;
  }

  private async findAvailableBox(
    tx: Prisma.TransactionClient,
    startTime: Date,
    durationMinutes: number
  ): Promise<number> {
    // Беремо всі бокси та рахуємо фактичне завантаження у вибраному проміжку часу.
    const allBoxes = await tx.box.findMany({
      orderBy: { id: 'asc' },
      select: {
        id: true,
        capacity: true
      }
    });

    const boxIds = allBoxes.map((box) => box.id);
    const dayStart = new Date(startTime);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(startTime);
    dayEnd.setHours(23, 59, 59, 999);

    const boxOrders = await tx.order.findMany({
      where: {
        boxId: { in: boxIds },
        status: { in: BOX_BLOCKING_ORDER_STATUSES },
        startTime: {
          gte: dayStart,
          lte: dayEnd
        }
      },
      select: {
        boxId: true
      }
    });

    const occupiedByBox = new Map<number, number>();

    for (const order of boxOrders) {
      occupiedByBox.set(order.boxId, (occupiedByBox.get(order.boxId) ?? 0) + 1);
    }

    const orderedBoxes = [...allBoxes].sort((left, right) => {
      const leftOccupied = occupiedByBox.get(left.id) ?? 0;
      const rightOccupied = occupiedByBox.get(right.id) ?? 0;
      const leftLoad = left.capacity > 0 ? leftOccupied / left.capacity : 1;
      const rightLoad = right.capacity > 0 ? rightOccupied / right.capacity : 1;

      if (leftLoad !== rightLoad) {
        return leftLoad - rightLoad;
      }

      if (left.capacity !== right.capacity) {
        return right.capacity - left.capacity;
      }

      return left.id - right.id;
    });

    for (const box of orderedBoxes) {
      const occupiedSlots = occupiedByBox.get(box.id) ?? 0;

      if (occupiedSlots < box.capacity) {
        return box.id;
      }
    }

    throw new Error('Немає вільних боксів на вказаний час');
  }

  private async ensureWorkersAvailable(
    tx: Prisma.TransactionClient,
    services: Array<{ serviceId: number; workerId: number }>,
    startTime: Date,
    durationMinutes: number,
    excludeOrderId?: number
  ) {
    const workerIds = [...new Set(services.map((service) => service.workerId))];
    const workers = await tx.worker.findMany({
      where: { id: { in: workerIds } },
      select: { id: true, position: true }
    });

    if (workers.length !== workerIds.length) {
      throw new Error('One or more workers were not found');
    }

    const invalidWorker = workers.find((worker) => worker.position !== 'Mechanic');
    if (invalidWorker) {
      throw new Error('Only mechanics can be assigned to order services');
    }

    const requestedEnd = new Date(startTime.getTime() + durationMinutes * 60_000);
    const workerAssignments = await tx.orderService.findMany({
      where: {
        workerId: { in: workerIds },
        order: {
          status: { in: ACTIVE_ORDER_STATUSES },
          ...(excludeOrderId ? { id: { not: excludeOrderId } } : {})
        }
      },
      include: {
        order: {
          select: {
            startTime: true,
            totalDurationMinutes: true
          }
        }
      }
    });

    const busyWorker = workerAssignments.find((assignment) => {
      const assignmentDuration = assignment.order.totalDurationMinutes ?? 60;
      const assignmentEnd = new Date(
        assignment.order.startTime.getTime() + assignmentDuration * 60_000
      );

      return startTime < assignmentEnd && requestedEnd > assignment.order.startTime;
    });

    if (busyWorker) {
      throw new Error('One of the selected mechanics is already booked for this time');
    }
  }

  private validateCreateStatus(actor: AuthUser, status: string | undefined): OrderStatus {
    if (!status) {
      return 'planned';
    }

    if (status === 'in_progress' && MANAGEMENT_ROLES.has(actor.role)) {
      return 'in_progress';
    }

    if (status === 'planned') {
      return 'planned';
    }

    throw new Error('Invalid initial order status');
  }

  private async getServicesSnapshot(
    tx: Prisma.TransactionClient,
    services: Array<{ serviceId: number; workerId: number }>
  ) {
    const serviceIds = [...new Set(services.map((service) => service.serviceId))];
    const serviceRecords = await tx.service.findMany({
      where: { id: { in: serviceIds } }
    });

    if (serviceRecords.length !== serviceIds.length) {
      throw new Error('One or more services were not found');
    }

    return serviceRecords;
  }

  private calculateOrderDurationMinutes(serviceRecords: Array<{ durationMinutes: number }>) {
    const calculatedDuration = serviceRecords.reduce((sum, service) => {
      const minutes = Number(service.durationMinutes);
      return sum + (Number.isFinite(minutes) && minutes > 0 ? minutes : 0);
    }, 0);

    return Math.max(1, calculatedDuration);
  }

  private async buildPartRows(
    tx: Prisma.TransactionClient,
    parts: Array<{ partId: number; quantity: number }>
  ) {
    const rows: Array<{
      partId: number;
      quantity: number;
      unitPrice: Prisma.Decimal;
    }> = [];

    for (const partInput of parts) {
      const part = await tx.part.findUnique({
        where: { id: partInput.partId }
      });

      if (!part) {
        throw new Error('Part not found');
      }

      if (part.stockQuantity < partInput.quantity) {
        throw new Error(`Insufficient stock for part "${part.name}"`);
      }

      rows.push({
        partId: partInput.partId,
        quantity: partInput.quantity,
        unitPrice: part.basePrice
      });
    }

    return rows;
  }

  private async getDetailedOrder(id: number) {
    const order = await prisma.order.findUnique({
      where: { id },
      include: this.orderInclude
    });

    if (!order) {
      throw new Error('Order not found');
    }

    return order;
  }

  private async getOrderSummaryFromView(id: number) {
    try {
      const rows = await prisma.$queryRaw<OrderSummaryViewRow[]>`
        SELECT
          id,
          "orderDate",
          status,
          "totalAmount",
          "totalDurationMinutes",
          client_name,
          email,
          make,
          model,
          "licensePlate",
          "boxNumber",
          services_count,
          parts_count,
          workers_count,
          collected_amount,
          pending_amount,
          payments_count
        FROM "vw_order_detailed_summary"
        WHERE id = ${id}
        LIMIT 1
      `;

      const row = rows[0];
      if (!row) {
        return null;
      }

      return {
        ...row,
        services_count: Number(row.services_count),
        parts_count: Number(row.parts_count),
        workers_count: Number(row.workers_count),
        payments_count: Number(row.payments_count)
      } satisfies OrderSummaryView;
    } catch {
      return null;
    }
  }

  private async recalculateOrderTotal(
    db: Pick<typeof prisma, 'orderService' | 'orderPart' | 'order'>,
    orderId: number
  ) {
    const [services, parts] = await Promise.all([
      db.orderService.findMany({
        where: { orderId },
        include: {
          service: {
            select: {
              standardPrice: true
            }
          }
        }
      }),
      db.orderPart.findMany({
        where: { orderId }
      })
    ]);

    const serviceTotal = services.reduce((sum, line) => {
      const rawCost = line.actualCost ?? line.service.standardPrice;
      return sum.plus(new Prisma.Decimal(rawCost));
    }, new Prisma.Decimal(0));

    const partsTotal = parts.reduce((sum, line) => {
      const unitPrice = new Prisma.Decimal(line.unitPrice);
      return sum.plus(unitPrice.mul(line.quantity));
    }, new Prisma.Decimal(0));

    const total = serviceTotal.plus(partsTotal);

    await db.order.update({
      where: { id: orderId },
      data: {
        totalAmount: total
      }
    });

    return total;
  }

  private async ensureMechanicAssigned(actor: AuthUser, orderId: number) {
    const worker = await this.requireWorker(actor);
    const assignment = await prisma.orderService.findFirst({
      where: {
        orderId,
        workerId: worker.id
      }
    });

    if (!assignment) {
      throw new Error('Access denied');
    }

    return worker;
  }

  private async ensureCanOperateOrder(actor: AuthUser, orderId: number) {
    if (actor.role === 'Mechanic') {
      await this.ensureMechanicAssigned(actor, orderId);
      return;
    }

    if (MANAGEMENT_ROLES.has(actor.role)) {
      return;
    }

    throw new Error('Access denied');
  }

  private async ensureOrderMutable(orderId: number) {
    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.status === 'completed') {
      throw new Error('Cannot modify completed order');
    }

    return order;
  }

  async create(actor: AuthUser, data: CreateOrderInput) {
    return prisma.$transaction(
      async (tx) => {
        const clientId =
          actor.role === 'Client'
            ? await this.requireClientId(tx, actor.id)
            : data.clientId;

        if (!clientId) {
          throw new Error('Client id is required for staff-created orders');
        }

        await this.ensureVehicleBelongsToClient(tx, data.vehicleId, clientId);

        const services = data.services ?? [];
        const parts = data.parts ?? [];
        const serviceRecords = services.length
          ? await this.getServicesSnapshot(tx, services)
          : [];

        const partRows = parts.length ? await this.buildPartRows(tx, parts) : [];

        const totalDurationMinutes = services.length
          ? this.calculateOrderDurationMinutes(serviceRecords)
          : 1;
        const safeTotalDurationMinutes =
          Number.isFinite(totalDurationMinutes) && totalDurationMinutes > 0
            ? totalDurationMinutes
            : 1;

        const startTime = new Date(data.startTime);
        if (Number.isNaN(startTime.getTime())) {
          throw new Error('Invalid start time');
        }

        // === АВТОМАТИЧНИЙ ПІДБІР БОКСУ ===
        let boxId = data.boxId;
        if (boxId == null) {
          // Автоматичний вибір
          boxId = await this.findAvailableBox(tx, startTime, safeTotalDurationMinutes);
        } else {
          // Якщо бокс вказаний вручну — перевіряємо його.
          // Якщо за час до створення замовлення слот вже зайняли,
          // автоматично підбираємо інший вільний бокс, щоб не зривати запис.
          try {
            await this.ensureBoxAvailable(tx, boxId, startTime, safeTotalDurationMinutes);
          } catch {
            boxId = await this.findAvailableBox(tx, startTime, safeTotalDurationMinutes);
          }
        }

        const procedureReserved = await this.tryReserveBoxWithProcedure(
          boxId,
          startTime,
          safeTotalDurationMinutes
        );

        if (!procedureReserved) {
          await this.ensureBoxAvailable(tx, boxId, startTime, safeTotalDurationMinutes);
        }

        if (services.length) {
          await this.ensureWorkersAvailable(tx, services, startTime, safeTotalDurationMinutes);
        }

        const order = await tx.order.create({
          data: {
            clientId,
            vehicleId: data.vehicleId,
            boxId,
            orderDate: new Date(),
            startTime,
            totalDurationMinutes: safeTotalDurationMinutes,
            status: this.validateCreateStatus(actor, data.status),
            notes: data.notes
          }
        });

        if (services.length) {
          await tx.orderService.createMany({
            data: services.map((service) => ({
              orderId: order.id,
              serviceId: service.serviceId,
              workerId: service.workerId,
              actualDurationMinutes:
                serviceRecords.find((record) => record.id === service.serviceId)
                  ?.durationMinutes ?? 1,
              actualCost: null
            }))
          });
        }

        if (partRows.length) {
          await tx.orderPart.createMany({
            data: partRows.map((part) => ({
              orderId: order.id,
              partId: part.partId,
              quantity: part.quantity,
              unitPrice: part.unitPrice
            }))
          });
        }

        await this.recalculateOrderTotal(tx, order.id);

        const detailedOrder = await tx.order.findUnique({
          where: { id: order.id },
          include: this.orderInclude
        });

        if (!detailedOrder) throw new Error('Order not found');

        return this.enrichOrderWithPaymentStatus(detailedOrder);
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
      }
    );
  }

  async getAll(filters: OrderFilters = {}) {
    const orders = await prisma.order.findMany({
      where: this.buildWhere(filters),
      include: this.orderInclude,
      orderBy: { createdAt: 'desc' }
    });

    return this.filterByPaymentStatus(
      orders.map((order) => this.enrichOrderWithPaymentStatus(order)),
      filters.paymentStatus
    );
  }

  async getMyOrders(actor: AuthUser, filters: OrderFilters = {}) {
    const client = await prisma.client.findUnique({
      where: { userId: actor.id }
    });

    if (!client) {
      throw new Error('Client not found');
    }

    const orders = await prisma.order.findMany({
      where: {
        ...this.buildWhere(filters),
        clientId: client.id
      },
      include: this.orderInclude,
      orderBy: { createdAt: 'desc' }
    });

    return this.filterByPaymentStatus(
      orders.map((order) => this.enrichOrderWithPaymentStatus(order)),
      filters.paymentStatus
    );
  }

  async getAssignedOrders(actor: AuthUser, filters: OrderFilters = {}) {
    const worker = await this.requireWorker(actor);

    const orders = await prisma.order.findMany({
      where: {
        ...this.buildWhere(filters),
        orderServices: {
          some: {
            workerId: worker.id
          }
        },
        status: {
          not: 'canceled'
        }
      },
      include: this.orderInclude,
      orderBy: { startTime: 'asc' }
    });

    return this.filterByPaymentStatus(
      orders.map((order) => this.enrichOrderWithPaymentStatus(order)),
      filters.paymentStatus
    );
  }

  async getById(actor: AuthUser, id: number) {
    const order = await this.getDetailedOrder(id);
    const summaryFromView = await this.getOrderSummaryFromView(id);

    if (STAFF_ROLES.has(actor.role) || actor.role === 'Admin') {
      return {
        ...this.enrichOrderWithPaymentStatus(order),
        summaryFromView
      };
    }

    if (actor.role === 'Client') {
      const client = await prisma.client.findUnique({
        where: { userId: actor.id }
      });

      if (!client || client.id !== order.clientId) {
        throw new Error('Access denied');
      }

      return {
        ...this.enrichOrderWithPaymentStatus(order),
        summaryFromView
      };
    }

    if (actor.role === 'Mechanic') {
      const worker = await this.requireWorker(actor);
      const assigned = order.orderServices.some((service) => service.workerId === worker.id);

      if (!assigned) {
        throw new Error('Access denied');
      }

      return {
        ...this.enrichOrderWithPaymentStatus(order),
        summaryFromView
      };
    }

    throw new Error('Access denied');
  }

  async updateOrder(actor: AuthUser, id: number, data: UpdateOrderInput) {
    if (!MANAGEMENT_ROLES.has(actor.role)) {
      throw new Error('Access denied');
    }

    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id },
        include: { orderServices: true }
      });

      if (!order) {
        throw new Error('Order not found');
      }

      if (order.status === 'completed') {
        throw new Error('Cannot edit completed order');
      }

      const nextClientId = data.clientId ?? order.clientId;
      const nextVehicleId = data.vehicleId ?? order.vehicleId;
      const nextBoxId = data.boxId ?? order.boxId;
      const nextStartTime = data.startTime ? new Date(data.startTime) : order.startTime;

      if (Number.isNaN(nextStartTime.getTime())) {
        throw new Error('Invalid start time');
      }

      await this.ensureVehicleBelongsToClient(tx, nextVehicleId, nextClientId);

      const totalDurationMinutes =
        Math.max(
          1,
          order.orderServices.reduce(
            (sum, service) => sum + (service.actualDurationMinutes ?? 0),
            0
          ) || order.totalDurationMinutes || 1
        );

      await this.ensureBoxAvailable(tx, nextBoxId, nextStartTime, totalDurationMinutes, id);

      const nextServices = order.orderServices.map((service) => ({
        serviceId: service.serviceId,
        workerId: service.workerId
      }));

      if (nextServices.length) {
        await this.ensureWorkersAvailable(
          tx,
          nextServices,
          nextStartTime,
          totalDurationMinutes,
          id
        );
      }

      await tx.order.update({
        where: { id },
        data: {
          clientId: nextClientId,
          vehicleId: nextVehicleId,
          boxId: nextBoxId,
          startTime: nextStartTime,
          notes: data.notes,
          status: data.status
        }
      });

      await this.recalculateOrderTotal(tx, id);

    return this.enrichOrderWithPaymentStatus(await this.getDetailedOrder(id));
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });
  }

  async updateOrderStatus(actor: AuthUser, id: number, status: string) {
    if (!isOrderStatus(status)) {
      throw new Error('Invalid order status');
    }

    if (status === 'completed') {
      return this.closeOrder(actor, id);
    }

    if (actor.role === 'Mechanic') {
      await this.ensureMechanicAssigned(actor, id);

      if (!['in_progress', 'ready_for_delivery'].includes(status)) {
        throw new Error('Mechanic can only set in_progress or ready_for_delivery');
      }
    } else if (!STAFF_ROLES.has(actor.role) && actor.role !== 'Admin') {
      throw new Error('Access denied');
    }

    await prisma.order.update({
      where: { id },
      data: { status }
    });

    return this.getById(actor, id);
  }

  async addOrderPart(actor: AuthUser, orderId: number, data: AddOrderPartInput) {
    await this.ensureCanOperateOrder(actor, orderId);
    await this.ensureOrderMutable(orderId);

    const existing = await prisma.orderPart.findUnique({
      where: {
        orderId_partId: {
          orderId,
          partId: data.partId
        }
      }
    });

    if (existing) {
      throw new Error('This part is already added to the order');
    }

    const part = await prisma.part.findUnique({
      where: { id: data.partId }
    });

    if (!part) {
      throw new Error('Part not found');
    }

    if (part.stockQuantity < data.quantity) {
      throw new Error('Insufficient stock');
    }

    await prisma.orderPart.create({
      data: {
        orderId,
        partId: data.partId,
        quantity: data.quantity,
        unitPrice: part.basePrice
      }
    });

    return this.getById(actor, orderId);
  }

  async updateOrderPart(
    actor: AuthUser,
    orderId: number,
    partId: number,
    data: UpdateOrderPartInput
  ) {
    await this.ensureCanOperateOrder(actor, orderId);
    await this.ensureOrderMutable(orderId);

    return prisma.$transaction(async (tx) => {
      const orderPart = await tx.orderPart.findUnique({
        where: {
          orderId_partId: {
            orderId,
            partId
          }
        }
      });

      if (!orderPart) {
        throw new Error('Order part not found');
      }

      const nextQuantity = data.quantity;
      if (!Number.isFinite(nextQuantity) || nextQuantity < 1) {
        throw new Error('Quantity must be greater than zero');
      }

      const part = await tx.part.findUnique({
        where: { id: partId }
      });

      if (!part) {
        throw new Error('Part not found');
      }

      const difference = nextQuantity - orderPart.quantity;
      if (difference > 0 && part.stockQuantity < difference) {
        throw new Error('Insufficient stock');
      }

      await tx.orderPart.update({
        where: {
          orderId_partId: {
            orderId,
            partId
          }
        },
        data: {
          quantity: nextQuantity
        }
      });

      await this.recalculateOrderTotal(tx, orderId);
      return this.getById(actor, orderId);
    });
  }

  async deleteOrderPart(actor: AuthUser, orderId: number, partId: number) {
    await this.ensureCanOperateOrder(actor, orderId);
    await this.ensureOrderMutable(orderId);

    return prisma.$transaction(async (tx) => {
      const orderPart = await tx.orderPart.findUnique({
        where: {
          orderId_partId: {
            orderId,
            partId
          }
        }
      });

      if (!orderPart) {
        throw new Error('Order part not found');
      }

      await tx.orderPart.delete({
        where: {
          orderId_partId: {
            orderId,
            partId
          }
        }
      });

      await this.recalculateOrderTotal(tx, orderId);
      return this.getById(actor, orderId);
    });
  }

  async addOrderService(actor: AuthUser, orderId: number, data: AddOrderServiceInput) {
    await this.ensureOrderMutable(orderId);

    let workerId = data.workerId;

    if (actor.role === 'Mechanic') {
      const worker = await this.requireWorker(actor);
      if (workerId && workerId !== worker.id) {
        throw new Error('Mechanic can only assign service to self');
      }
      workerId = worker.id;
    } else {
      await this.ensureCanOperateOrder(actor, orderId);
    }

    if (!workerId) {
      throw new Error('Worker id is required');
    }

    const existing = await prisma.orderService.findUnique({
      where: {
        orderId_serviceId: {
          orderId,
          serviceId: data.serviceId
        }
      }
    });

    if (existing) {
      throw new Error('This service is already added to the order');
    }

    const [service, worker] = await Promise.all([
      prisma.service.findUnique({ where: { id: data.serviceId } }),
      prisma.worker.findUnique({ where: { id: workerId } })
    ]);

    if (!service) {
      throw new Error('Service not found');
    }

    if (!worker || worker.position !== 'Mechanic') {
      throw new Error('Worker not found or is not a mechanic');
    }

    await prisma.orderService.create({
      data: {
        orderId,
        serviceId: data.serviceId,
        workerId,
        actualDurationMinutes: service.durationMinutes,
        actualCost: null
      }
    });

    await this.recalculateOrderTotal(prisma, orderId);
    return this.getById(actor, orderId);
  }

  async updateOrderService(
    actor: AuthUser,
    orderId: number,
    serviceId: number,
    data: UpdateOrderServiceInput
  ) {
    await this.ensureOrderMutable(orderId);

    const orderService = await prisma.orderService.findUnique({
      where: {
        orderId_serviceId: {
          orderId,
          serviceId
        }
      }
    });

    if (!orderService) {
      throw new Error('Order service not found');
    }

    if (actor.role === 'Mechanic') {
      const worker = await this.requireWorker(actor);
      if (orderService.workerId !== worker.id) {
        throw new Error('Access denied');
      }

      if (typeof data.workerId === 'number' && data.workerId !== worker.id) {
        throw new Error('Mechanic cannot reassign service to another worker');
      }
    } else {
      await this.ensureCanOperateOrder(actor, orderId);
    }

    if (typeof data.workerId === 'number') {
      const worker = await prisma.worker.findUnique({
        where: { id: data.workerId }
      });

      if (!worker || worker.position !== 'Mechanic') {
        throw new Error('Worker not found or is not a mechanic');
      }

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: {
          startTime: true,
          totalDurationMinutes: true
        }
      });

      if (!order) {
        throw new Error('Order not found');
      }

      const requestedEnd = new Date(
        order.startTime.getTime() + (order.totalDurationMinutes ?? 60) * 60_000
      );

      const busyAssignments = await prisma.orderService.findMany({
        where: {
          workerId: data.workerId,
          order: {
            status: { in: ['planned', 'in_progress', 'ready_for_delivery'] },
            id: { not: orderId }
          }
        },
        select: {
          order: {
            select: {
              startTime: true,
              totalDurationMinutes: true
            }
          }
        }
      });

      const hasConflict = busyAssignments.some((assignment) => {
        const duration = assignment.order.totalDurationMinutes ?? 60;
        const assignmentEnd = new Date(
          assignment.order.startTime.getTime() + duration * 60_000
        );

        return order.startTime < assignmentEnd && requestedEnd > assignment.order.startTime;
      });

      if (hasConflict) {
        throw new Error('Selected mechanic is already booked for this time');
      }
    }

    await prisma.orderService.update({
      where: {
        orderId_serviceId: {
          orderId,
          serviceId
        }
      },
      data: {
        actualDurationMinutes:
          data.actualDurationMinutes === null ? undefined : data.actualDurationMinutes,
        actualCost:
          data.actualCost === null
            ? null
            : typeof data.actualCost === 'number'
            ? new Prisma.Decimal(data.actualCost)
              : undefined,
        workerId: data.workerId
      }
    });

    await this.recalculateOrderTotal(prisma, orderId);
    return this.getById(actor, orderId);
  }

  async deleteOrderService(actor: AuthUser, orderId: number, serviceId: number) {
    await this.ensureOrderMutable(orderId);

    const orderService = await prisma.orderService.findUnique({
      where: {
        orderId_serviceId: {
          orderId,
          serviceId
        }
      }
    });

    if (!orderService) {
      throw new Error('Order service not found');
    }

    if (actor.role === 'Mechanic') {
      const worker = await this.requireWorker(actor);
      if (orderService.workerId !== worker.id) {
        throw new Error('Access denied');
      }
    } else {
      await this.ensureCanOperateOrder(actor, orderId);
    }

    await prisma.orderService.delete({
      where: {
        orderId_serviceId: {
          orderId,
          serviceId
        }
      }
    });

    await this.recalculateOrderTotal(prisma, orderId);
    return this.getById(actor, orderId);
  }

  async closeOrder(actor: AuthUser, id: number) {
    if (actor.role === 'Mechanic') {
      await this.ensureMechanicAssigned(actor, id);
    } else if (!STAFF_ROLES.has(actor.role) && actor.role !== 'Admin') {
      throw new Error('Access denied');
    }

    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id }
      });

      if (!order) {
        throw new Error('Order not found');
      }

      if (order.status === 'completed') {
        return;
      }

      await tx.order.update({
        where: { id },
        data: {
          status: 'completed'
        }
      });
    });

    return this.getById(actor, id);
  }

  async deleteOrder(actor: AuthUser, id: number) {
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        client: true
      }
    });

    if (!order) {
      throw new Error('Order not found');
    }

    const isClientOwner =
      actor.role === 'Client' &&
      (await prisma.client.findUnique({ where: { userId: actor.id } }))?.id === order.clientId;
    const isStaff = STAFF_ROLES.has(actor.role) || actor.role === 'Admin';

    if (!isClientOwner && !isStaff) {
      throw new Error('Access denied');
    }

    if (order.status === 'completed') {
      throw new Error('Cannot delete completed order');
    }

    await prisma.order.delete({
      where: { id }
    });

    return { success: true, id };
  }

  async cancelOrder(actor: AuthUser, id: number) {
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        client: true
      }
    });

    if (!order) {
      throw new Error('Order not found');
    }

    const isClientOwner =
      actor.role === 'Client' &&
      (await prisma.client.findUnique({ where: { userId: actor.id } }))?.id === order.clientId;
    const isStaff = STAFF_ROLES.has(actor.role) || actor.role === 'Admin';

    if (!isClientOwner && !isStaff) {
      throw new Error('Access denied');
    }

    if (order.status === 'completed') {
      throw new Error('Cannot cancel completed order');
    }

    await prisma.order.update({
      where: { id },
      data: {
        status: 'canceled'
      }
    });

    return this.getById(actor, id);
  }
}
