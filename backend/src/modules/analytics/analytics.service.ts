import { Prisma } from '@prisma/client';
import { prisma } from '../../config/db';

interface AnalyticsFilters {
  dateFrom?: string;
  dateTo?: string;
  clientId?: number;
  boxId?: number;
  workerId?: number;
  serviceId?: number;
  partId?: number;
}

type ForecastMaterialItem = {
  id: number;
  name: string;
  category: string;
  historicalQuantity: number;
  projectedQuantity: number;
  averageUnitPrice: Prisma.Decimal;
  projectedCost: Prisma.Decimal;
  currentStock: number;
};

type RangeBounds = {
  from: Date;
  to: Date;
};

const kievDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Kyiv'
});

export class AnalyticsService {
  // Витрати на оплату праці
  private calculateLaborCost(
    services: Array<{
      actualDurationMinutes: number | null;
      service: { durationMinutes: number };
      worker: { hourlyRate: Prisma.Decimal };
    }>
  ) {
    return services.reduce((sum, service) => {
      const durationMinutes = Math.max(
        1,
        Number(service.actualDurationMinutes ?? service.service.durationMinutes ?? 0)
      );
      const minutesCost = service.worker.hourlyRate.div(60);
      return sum.plus(minutesCost.mul(durationMinutes));
    }, new Prisma.Decimal(0));
  }

  private parseLocalDate(value: string, endOfDay = false) {
    const [year, month, day] = value.split('-').map((part) => Number(part));

    if ([year, month, day].some((part) => Number.isNaN(part))) {
      return null;
    }

    return new Date(
      year,
      month - 1,
      day,
      endOfDay ? 23 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 999 : 0
    );
  }

  private parseDateRange(filters: AnalyticsFilters) {
    const range: Prisma.DateTimeFilter = {};

    if (filters.dateFrom) {
      const from = this.parseLocalDate(filters.dateFrom);
      if (from && !Number.isNaN(from.getTime())) {
        range.gte = from;
      }
    }

    if (filters.dateTo) {
      const to = this.parseLocalDate(filters.dateTo, true);
      if (to && !Number.isNaN(to.getTime())) {
        range.lte = to;
      }
    }

    return Object.keys(range).length ? range : undefined;
  }

  private resolveRangeBounds(filters: AnalyticsFilters): RangeBounds {
    const parsedFrom = filters.dateFrom ? this.parseLocalDate(filters.dateFrom) : null;
    const parsedTo = filters.dateTo ? this.parseLocalDate(filters.dateTo, true) : null;

    const to = parsedTo && !Number.isNaN(parsedTo.getTime()) ? parsedTo : new Date();
    to.setHours(23, 59, 59, 999);

    const from = parsedFrom && !Number.isNaN(parsedFrom.getTime())
      ? parsedFrom
      : new Date(to);

    if (!parsedFrom || Number.isNaN(parsedFrom.getTime())) {
      from.setDate(from.getDate() - 29);
    }

    from.setHours(0, 0, 0, 0);
    return { from, to };
  }

  private getRangeLengthInDays(filters: AnalyticsFilters) {
    const { from, to } = this.resolveRangeBounds(filters);
    const diff = to.getTime() - from.getTime();
    return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1);
  }

  private getSpanLengthInDays(from: Date, to: Date) {
    const diff = to.getTime() - from.getTime();
    return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1);
  }

  private getRangeMinutes(filters: AnalyticsFilters) {
    const { from, to } = this.resolveRangeBounds(filters);
    return Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 60000) + 1);
  }

  private formatDateKey(value: Date) {
    return kievDateFormatter.format(value);
  }

  private buildTimeline(
    orders: Array<{ startTime: Date; totalAmount: Prisma.Decimal; status: string }>,
    filters: AnalyticsFilters
  ) {
    const { from, to } = this.resolveRangeBounds(filters);
    const series = new Map<
      string,
      { date: string; ordersCount: number; completedOrders: number; revenue: Prisma.Decimal }
    >();

    for (const current = new Date(from); current <= to; current.setDate(current.getDate() + 1)) {
      const key = this.formatDateKey(current);
      series.set(key, {
        date: key,
        ordersCount: 0,
        completedOrders: 0,
        revenue: new Prisma.Decimal(0)
      });
    }

    for (const order of orders) {
      const key = this.formatDateKey(order.startTime);
      const entry = series.get(key);
      if (!entry) continue;

      entry.ordersCount += 1;
      entry.revenue = entry.revenue.plus(order.totalAmount);
      if (order.status === 'completed') {
        entry.completedOrders += 1;
      }
    }

    return [...series.values()];
  }

  private countOverlapMinutes(start: Date, end: Date, rangeFrom: Date, rangeTo: Date) {
    const overlapStart = new Date(Math.max(start.getTime(), rangeFrom.getTime()));
    const overlapEnd = new Date(Math.min(end.getTime(), rangeTo.getTime()));

    if (overlapEnd <= overlapStart) {
      return 0;
    }

    return Math.round((overlapEnd.getTime() - overlapStart.getTime()) / 60000);
  }

  private sumDecimal(values: Prisma.Decimal[]) {
    return values.reduce(
      (total, value) => total.plus(value),
      new Prisma.Decimal(0)
    );
  }

  private clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
  }

  private decimalValue(value: Prisma.Decimal | number | string | null | undefined) {
    return new Prisma.Decimal(value ?? 0);
  }

  private buildWhere(filters: AnalyticsFilters): Prisma.OrderWhereInput {
    return {
      ...(this.parseDateRange(filters) ? { startTime: this.parseDateRange(filters) } : {}),
      ...(typeof filters.clientId === 'number' ? { clientId: filters.clientId } : {}),
      ...(typeof filters.boxId === 'number' ? { boxId: filters.boxId } : {}),
      ...(typeof filters.workerId === 'number'
        ? {
            orderServices: {
              some: {
                workerId: filters.workerId
              }
            }
          }
        : {}),
      ...(typeof filters.serviceId === 'number'
        ? {
            orderServices: {
              some: {
                serviceId: filters.serviceId
              }
            }
          }
        : {}),
      ...(typeof filters.partId === 'number'
        ? {
            orderParts: {
              some: {
                partId: filters.partId
              }
            }
          }
        : {})
    };
  }

  async getDashboard(filters: AnalyticsFilters = {}) {
    const { from, to } = this.resolveRangeBounds(filters);
    const orders = await prisma.order.findMany({
      where: this.buildWhere(filters),
      include: {
        box: true,
        orderServices: {
          include: {
            service: true,
            worker: {
              select: {
                hourlyRate: true,
                user: {
                  select: {
                    username: true
                  }
                }
              }
            }
          }
        },
        orderParts: {
          include: {
            part: {
              include: {
                category: true
              }
            }
          }
        },
        payments: true
      }
    });

    const rangeMinutes = this.getRangeMinutes(filters);

    const totalRevenue = this.sumDecimal(orders.map((order) => order.totalAmount));
    const collectedRevenue = this.sumDecimal(
      orders.flatMap((order) =>
        order.payments
          .filter((payment) => payment.status === 'completed')
          .map((payment) => payment.amount)
      )
    );
    const partsExpense = this.sumDecimal(
      orders.flatMap((order) => order.orderParts.map((part) => part.unitPrice.mul(part.quantity)))
    );
    const laborExpense = this.sumDecimal(
      orders.map((order) => this.calculateLaborCost(order.orderServices))
    );

    const serviceMap = new Map<
      number,
      { id: number; name: string; count: number; revenue: Prisma.Decimal }
    >();
    const partMap = new Map<
      number,
      { id: number; name: string; category: string; quantity: number; cost: Prisma.Decimal }
    >();
    const categoryMap = new Map<
      string,
      { category: string; cost: Prisma.Decimal; quantity: number }
    >();
    const workerMap = new Map<
      number,
      { id: number; username: string; jobsCount: number; minutes: number; earned: Prisma.Decimal }
    >();
    const boxMap = new Map<
      number,
      {
        id: number;
        boxNumber: string;
        capacity: number;
        ordersCount: number;
        occupiedMinutes: number;
        availableMinutes: number;
        utilizationRate: number;
        revenue: Prisma.Decimal;
      }
    >();

    for (const order of orders) {
      const existingBox = boxMap.get(order.boxId) ?? {
        id: order.boxId,
        boxNumber: order.box.boxNumber,
        capacity: order.box.capacity,
        ordersCount: 0,
        occupiedMinutes: 0,
        availableMinutes: 0,
        utilizationRate: 0,
        revenue: new Prisma.Decimal(0)
      };
      existingBox.ordersCount += 1;
      existingBox.revenue = existingBox.revenue.plus(order.totalAmount);
      const orderEnd = new Date(order.startTime.getTime() + (order.totalDurationMinutes ?? 60) * 60_000);
      existingBox.occupiedMinutes += this.countOverlapMinutes(order.startTime, orderEnd, from, to);
      boxMap.set(order.boxId, existingBox);

      for (const orderService of order.orderServices) {
        const serviceEntry = serviceMap.get(orderService.serviceId) ?? {
          id: orderService.serviceId,
          name: orderService.service.name,
          count: 0,
          revenue: new Prisma.Decimal(0)
        };
        serviceEntry.count += 1;
        serviceEntry.revenue = serviceEntry.revenue.plus(
          orderService.actualCost ?? new Prisma.Decimal(0)
        );
        serviceMap.set(orderService.serviceId, serviceEntry);

        const workerEntry = workerMap.get(orderService.workerId) ?? {
          id: orderService.workerId,
          username: orderService.worker.user.username,
          jobsCount: 0,
          minutes: 0,
          earned: new Prisma.Decimal(0)
        };
        workerEntry.jobsCount += 1;
        workerEntry.minutes += orderService.actualDurationMinutes ?? 0;
        workerEntry.earned = workerEntry.earned.plus(
          orderService.worker.hourlyRate
            .div(60)
            .mul(Math.max(1, Number(orderService.actualDurationMinutes ?? orderService.service.durationMinutes ?? 0)))
        );
        workerMap.set(orderService.workerId, workerEntry);
      }

      for (const orderPart of order.orderParts) {
        const partEntry = partMap.get(orderPart.partId) ?? {
          id: orderPart.partId,
          name: orderPart.part.name,
          category: orderPart.part.category.name,
          quantity: 0,
          cost: new Prisma.Decimal(0)
        };
        partEntry.quantity += orderPart.quantity;
        partEntry.cost = partEntry.cost.plus(orderPart.unitPrice.mul(orderPart.quantity));
        partMap.set(orderPart.partId, partEntry);

        const categoryEntry = categoryMap.get(orderPart.part.category.name) ?? {
          category: orderPart.part.category.name,
          cost: new Prisma.Decimal(0),
          quantity: 0
        };
        categoryEntry.quantity += orderPart.quantity;
        categoryEntry.cost = categoryEntry.cost.plus(orderPart.unitPrice.mul(orderPart.quantity));
        categoryMap.set(orderPart.part.category.name, categoryEntry);
      }
    }

    for (const box of boxMap.values()) {
      box.availableMinutes = rangeMinutes * box.capacity;
      box.utilizationRate = Number(
        box.availableMinutes > 0
          ? box.occupiedMinutes / box.availableMinutes * 100
          : 0
      );
    }

    const averageCheck = orders.length
      ? totalRevenue.div(orders.length)
      : new Prisma.Decimal(0);

    const timeline = this.buildTimeline(
      orders.map((order) => ({
        startTime: order.startTime,
        totalAmount: order.totalAmount,
        status: order.status
      })),
      filters
    );

    return {
      filters,
      timeline,
      summary: {
        totalOrders: orders.length,
        completedOrders: orders.filter((order) => order.status === 'completed').length,
        activeOrders: orders.filter((order) => order.status !== 'completed').length,
        uniqueClients: new Set(orders.map((order) => order.clientId)).size,
        totalRevenue,
        collectedRevenue,
        outstandingRevenue: totalRevenue.minus(collectedRevenue),
        partsExpense,
        laborExpense,
        averageCheck,
        completionRate: orders.length ? orders.filter((order) => order.status === 'completed').length / orders.length * 100 : 0,
        paidRate: orders.length ? orders.filter((order) => order.payments.some((payment) => payment.status === 'completed')).length / orders.length * 100 : 0
      },
      topServices: [...serviceMap.values()].sort((a, b) => b.count - a.count).slice(0, 10),
      topParts: [...partMap.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 10),
      partCategoryExpense: [...categoryMap.values()].sort((a, b) => Number(b.cost) - Number(a.cost)),
      workerLoad: [...workerMap.values()].sort((a, b) => b.jobsCount - a.jobsCount),
      boxLoad: [...boxMap.values()].sort((a, b) => b.ordersCount - a.ordersCount)
    };
  }

  async getForecast(forecastDays = 30) {
    const horizonDays = Number.isFinite(forecastDays)
      ? this.clamp(Math.floor(forecastDays), 1, 365)
      : 30;

    const completedOrders = await prisma.order.findMany({
      where: { status: 'completed' },
      include: {
        orderServices: {
          include: {
            service: true,
            worker: {
              select: {
                hourlyRate: true
              }
            }
          }
        },
        orderParts: {
          include: {
            part: {
              include: {
                category: true
              }
            }
          }
        }
      },
      orderBy: {
        startTime: 'asc'
      }
    });

    const historicalStart = completedOrders.reduce<Date | null>((min, order) => {
      if (!min || order.startTime < min) {
        return order.startTime;
      }
      return min;
    }, null);
    const historicalEnd = completedOrders.reduce<Date | null>((max, order) => {
      if (!max || order.startTime > max) {
        return order.startTime;
      }
      return max;
    }, null);

    const analysisEnd = historicalEnd ? new Date(historicalEnd) : new Date();
    analysisEnd.setHours(23, 59, 59, 999);

    const historyWindowDays = completedOrders.length
      ? this.clamp(Math.max(60, horizonDays * 3), 60, 365)
      : horizonDays;

    const analysisStart = new Date(analysisEnd);
    analysisStart.setDate(analysisStart.getDate() - (historyWindowDays - 1));
    analysisStart.setHours(0, 0, 0, 0);

    const analysisOrders = completedOrders.filter(
      (order) => order.startTime >= analysisStart && order.startTime <= analysisEnd
    );

    const recentWindowDays = Math.min(30, Math.max(1, Math.floor(historyWindowDays / 2)));
    const previousWindowDays = Math.min(
      recentWindowDays,
      Math.max(1, historyWindowDays - recentWindowDays)
    );

    const recentStart = new Date(analysisEnd);
    recentStart.setDate(recentStart.getDate() - (recentWindowDays - 1));
    recentStart.setHours(0, 0, 0, 0);

    const previousEnd = new Date(recentStart);
    previousEnd.setDate(previousEnd.getDate() - 1);
    previousEnd.setHours(23, 59, 59, 999);

    const previousStart = new Date(previousEnd);
    previousStart.setDate(previousStart.getDate() - (previousWindowDays - 1));
    previousStart.setHours(0, 0, 0, 0);

    const recentOrders = analysisOrders.filter(
      (order) => order.startTime >= recentStart && order.startTime <= analysisEnd
    );
    const previousOrders = analysisOrders.filter(
      (order) => order.startTime >= previousStart && order.startTime <= previousEnd
    );

    const totalOrders = analysisOrders.length;
    const analysisDays = analysisOrders.length
      ? this.getSpanLengthInDays(analysisStart, analysisEnd)
      : horizonDays;

    const totalRevenue = this.sumDecimal(analysisOrders.map((order) => order.totalAmount));
    const partsExpense = this.sumDecimal(
      analysisOrders.flatMap((order) =>
        order.orderParts.map((part) => part.unitPrice.mul(part.quantity))
      )
    );
    const laborExpense = this.sumDecimal(
      analysisOrders.map((order) => this.calculateLaborCost(order.orderServices))
    );
    const totalExpense = partsExpense.plus(laborExpense);
    const totalPartsQuantity = analysisOrders.reduce(
      (sum, order) =>
        sum + order.orderParts.reduce((partSum, part) => partSum + part.quantity, 0),
      0
    );

    const averageDailyOrders = totalOrders > 0
      ? new Prisma.Decimal(totalOrders).div(analysisDays)
      : new Prisma.Decimal(0);
    const recentDailyOrders = recentOrders.length / recentWindowDays;
    const previousDailyOrders = previousOrders.length / previousWindowDays;
    const momentum = previousDailyOrders > 0
      ? (recentDailyOrders - previousDailyOrders) / previousDailyOrders
      : recentDailyOrders > 0
        ? 1
        : 0;
    const trendMultiplier = this.clamp(1 + momentum * 0.35, 0.75, 1.25);
    const projectedOrders = averageDailyOrders.mul(horizonDays).mul(trendMultiplier);

    const averageRevenuePerOrder = totalOrders > 0
      ? totalRevenue.div(totalOrders)
      : new Prisma.Decimal(0);
    const averageExpensePerOrder = totalOrders > 0
      ? totalExpense.div(totalOrders)
      : new Prisma.Decimal(0);
    const averageMaterialExpensePerOrder = totalOrders > 0
      ? partsExpense.div(totalOrders)
      : new Prisma.Decimal(0);
    const averageLaborExpensePerOrder = totalOrders > 0
      ? laborExpense.div(totalOrders)
      : new Prisma.Decimal(0);
    const averageMaterialUnitsPerOrder = totalOrders > 0
      ? new Prisma.Decimal(totalPartsQuantity).div(totalOrders)
      : new Prisma.Decimal(0);

    const projectedRevenue = averageRevenuePerOrder.mul(projectedOrders);
    const projectedTotalExpense = averageExpensePerOrder.mul(projectedOrders);
    const projectedMaterialExpense = averageMaterialExpensePerOrder.mul(projectedOrders);
    const projectedLaborExpense = averageLaborExpensePerOrder.mul(projectedOrders);
    const projectedMaterialUnits = averageMaterialUnitsPerOrder.mul(projectedOrders);
    const projectedOperatingMargin = projectedRevenue.minus(projectedTotalExpense);

    const partStatistics = new Map<number, ForecastMaterialItem>();
    for (const order of analysisOrders) {
      for (const line of order.orderParts) {
        const current = partStatistics.get(line.partId);
        const lineCost = line.unitPrice.mul(line.quantity);

        if (current) {
          current.historicalQuantity += line.quantity;
          current.projectedCost = current.projectedCost.plus(lineCost);
        } else {
          partStatistics.set(line.partId, {
            id: line.partId,
            name: line.part?.name ?? `Деталь #${line.partId}`,
            category: line.part?.category?.name ?? 'Без категорії',
            historicalQuantity: line.quantity,
            projectedQuantity: 0,
            averageUnitPrice: this.decimalValue(line.unitPrice),
            projectedCost: lineCost,
            currentStock: line.part?.stockQuantity ?? 0
          });
        }
      }
    }

    const materialsForecast = [...partStatistics.values()]
      .map((item) => {
        const historicalQuantity = Math.max(1, item.historicalQuantity);
        const averageUnitPrice = item.projectedCost.div(historicalQuantity);
        const projectedQuantity = Math.max(
          0,
          Math.round(Number(projectedMaterialUnits.mul(item.historicalQuantity).div(totalPartsQuantity || 1)))
        );
        return {
          ...item,
          averageUnitPrice,
          projectedQuantity,
          projectedCost: averageUnitPrice.mul(projectedQuantity)
        };
      })
      .sort((a, b) => b.projectedQuantity - a.projectedQuantity)
      .slice(0, 10);

    return {
      historicalDays: analysisDays,
      forecastDays: horizonDays,
      historical: {
        completedOrders: totalOrders,
        partsExpense,
        laborExpense,
        totalExpense,
        totalRevenue
      },
      forecast: {
        averageDailyOrders,
        averageDailyExpense: totalOrders > 0
          ? totalExpense.div(analysisDays)
          : new Prisma.Decimal(0),
        averageDailyRevenue: totalOrders > 0
          ? totalRevenue.div(analysisDays)
          : new Prisma.Decimal(0),
        projectedOrders,
        projectedTotalExpense,
        projectedLaborExpense,
        projectedMaterialExpense,
        projectedRevenue,
        projectedOperatingMargin,
        trendMultiplier
      },
      materialsForecast: {
        averageDailyUnits:
          totalPartsQuantity > 0
            ? new Prisma.Decimal(totalPartsQuantity).div(analysisDays)
            : new Prisma.Decimal(0),
        projectedUnits: projectedMaterialUnits,
        projectedExpense: projectedMaterialExpense,
        topMaterials: materialsForecast
      }
    };
  }
}
