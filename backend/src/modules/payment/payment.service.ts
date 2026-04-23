import { Prisma, type OrderStatus, type PaymentMethod, type PaymentStatus } from '@prisma/client';
import { prisma } from '../../config/db';

interface AuthUser {
  id: number;
  role: string;
}

interface CreatePaymentInput {
  amount: number;
  paymentMethod: 'cash' | 'card' | 'transfer';
  paymentDate?: string;
}

interface PaymentFilters {
  orderId?: number;
  clientId?: number;
  paymentMethod?: string;
  status?: string;
  paymentStatus?: 'paid' | 'partially_paid' | 'unpaid';
  dateFrom?: string;
  dateTo?: string;
}

const ORDER_ACCESS_ROLES = new Set(['Admin', 'Manager', 'Accountant']);
const ORDER_STATUSES = ['planned', 'in_progress', 'ready_for_delivery', 'completed', 'canceled'] as const;
const PAYMENT_METHODS = ['cash', 'card', 'transfer'] as const;
const PAYMENT_STATUSES = ['pending', 'completed'] as const;

const isPaymentMethod = (value: string | undefined): value is PaymentMethod =>
  PAYMENT_METHODS.includes(value as (typeof PAYMENT_METHODS)[number]);

const isPaymentStatus = (value: string | undefined): value is PaymentStatus =>
  PAYMENT_STATUSES.includes(value as (typeof PAYMENT_STATUSES)[number]);

const isOrderStatus = (value: string | undefined): value is OrderStatus =>
  ORDER_STATUSES.includes(value as (typeof ORDER_STATUSES)[number]);

export class PaymentService {
  private parseDateRange(filters: PaymentFilters) {
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

  private async ensureOrderAccess(actor: AuthUser, orderId: number) {
    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      throw new Error('Order not found');
    }

    if (ORDER_ACCESS_ROLES.has(actor.role)) {
      return order;
    }

    const client = await prisma.client.findUnique({
      where: { userId: actor.id }
    });

    if (actor.role === 'Client' && client?.id === order.clientId) {
      return order;
    }

    throw new Error('Access denied');
  }

  private enrichOrderFinancials<
    T extends {
      totalAmount: Prisma.Decimal;
      payments: Array<{ amount: Prisma.Decimal; status: PaymentStatus }>;
    }
  >(order: T) {
    const completedPayments = order.payments
      .filter((payment) => payment.status === 'completed')
      .map((payment) => payment.amount);
    const paidAmount = this.sumDecimal(completedPayments);

    return {
      ...order,
      paidAmount,
      outstandingAmount: order.totalAmount.minus(paidAmount),
      paymentStatus: this.resolvePaymentStatus(paidAmount, order.totalAmount)
    };
  }

  async create(actor: AuthUser, orderId: number, data: CreatePaymentInput) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          payments: true
        }
      });

      if (!order) {
        throw new Error('Order not found');
      }

      const client = await tx.client.findUnique({
        where: { userId: actor.id }
      });

      const canAccess =
        ORDER_ACCESS_ROLES.has(actor.role) || (actor.role === 'Client' && client?.id === order.clientId);

      if (!canAccess) {
        throw new Error('Access denied');
      }

      const amount = new Prisma.Decimal(data.amount);
      const paidAmount = this.sumDecimal(
        order.payments
          .filter((payment) => payment.status === 'completed')
          .map((payment) => payment.amount)
      );
      const outstandingAmount = order.totalAmount.minus(paidAmount);

      if (amount.greaterThan(outstandingAmount)) {
        throw new Error('Payment amount exceeds outstanding balance');
      }

      return tx.payment.create({
        data: {
          orderId,
          amount,
        paymentMethod: data.paymentMethod as PaymentMethod,
        paymentDate: data.paymentDate ? new Date(data.paymentDate) : new Date(),
        status: 'completed' as PaymentStatus
      }
      });
    });
  }

  async getByOrder(actor: AuthUser, orderId: number) {
    await this.ensureOrderAccess(actor, orderId);

    return prisma.payment.findMany({
      where: { orderId },
      orderBy: { paymentDate: 'desc' }
    });
  }

  async getAll(filters: PaymentFilters = {}) {
    const paymentDate = this.parseDateRange(filters);
    const paymentMethod = filters.paymentMethod;
    const status = filters.status;

    return prisma.payment.findMany({
      where: {
        ...(typeof filters.orderId === 'number' ? { orderId: filters.orderId } : {}),
        ...(isPaymentMethod(paymentMethod) ? { paymentMethod } : {}),
        ...(isPaymentStatus(status) ? { status } : {}),
        ...(paymentDate ? { paymentDate } : {}),
        ...(typeof filters.clientId === 'number'
          ? {
              order: {
                clientId: filters.clientId
              }
            }
          : {})
      },
      include: {
        order: {
          include: {
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
            }
          }
        }
      },
      orderBy: { paymentDate: 'desc' }
    });
  }

  async getFinancialOrders(filters: PaymentFilters = {}) {
    const orderDate = this.parseDateRange(filters);
    const status = filters.status;
    const paymentMethod = filters.paymentMethod;
    const orders = await prisma.order.findMany({
      where: {
        ...(typeof filters.clientId === 'number' ? { clientId: filters.clientId } : {}),
        ...(orderDate ? { orderDate } : {}),
        ...(isOrderStatus(status) ? { status } : {})
      },
      include: {
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
        vehicle: true,
        box: true,
        payments: {
          where: isPaymentMethod(paymentMethod)
            ? {
                paymentMethod
              }
            : undefined,
          orderBy: { paymentDate: 'desc' }
        }
      },
      orderBy: { orderDate: 'desc' }
    });

    const financialOrders = orders.map((order) =>
      this.enrichOrderFinancials(
        order as Prisma.OrderGetPayload<{
          include: {
            payments: true;
          };
        }>
      )
    );

    if (!filters.paymentStatus) {
      return financialOrders;
    }

    return financialOrders.filter((order) => order.paymentStatus === filters.paymentStatus);
  }

  async getStats(filters: PaymentFilters = {}) {
    const payments = await this.getAll(filters);
    const completedPayments = payments.filter((payment) => payment.status === 'completed');
    const completedAmounts = completedPayments.map((payment) => payment.amount);
    const totalCollected = this.sumDecimal(completedAmounts);
    const avgPayment = completedPayments.length
      ? totalCollected.div(completedPayments.length)
      : new Prisma.Decimal(0);

    const financialOrders = await this.getFinancialOrders(filters);
    const outstandingAmount = this.sumDecimal(
      financialOrders.map((order) => order.outstandingAmount)
    );

    return {
      paymentsCount: payments.length,
      completedPaymentsCount: completedPayments.length,
      totalCollected,
      averagePayment: avgPayment,
      outstandingAmount,
      paidOrdersCount: financialOrders.filter((order) => order.paymentStatus === 'paid').length,
      partiallyPaidOrdersCount: financialOrders.filter(
        (order) => order.paymentStatus === 'partially_paid'
      ).length,
      unpaidOrdersCount: financialOrders.filter((order) => order.paymentStatus === 'unpaid').length
    };
  }
}
