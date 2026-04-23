import { Request, Response, NextFunction } from 'express';
import { OrderService } from './order.service';
import { AuthRequest } from '../../middleware/auth.middleware';

const service = new OrderService();

export class OrderController {
  private parseFilters(req: Request) {
    return {
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
      paymentStatus:
        typeof req.query.paymentStatus === 'string'
          ? (req.query.paymentStatus as 'paid' | 'partially_paid' | 'unpaid')
          : undefined,
      clientId:
        typeof req.query.clientId === 'string' ? Number(req.query.clientId) : undefined,
      boxId: typeof req.query.boxId === 'string' ? Number(req.query.boxId) : undefined,
      vehicleId:
        typeof req.query.vehicleId === 'string' ? Number(req.query.vehicleId) : undefined,
      workerId:
        typeof req.query.workerId === 'string' ? Number(req.query.workerId) : undefined,
      dateFrom: typeof req.query.dateFrom === 'string' ? req.query.dateFrom : undefined,
      dateTo: typeof req.query.dateTo === 'string' ? req.query.dateTo : undefined
    };
  }

  create = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const order = await service.create(req.user!, req.body);
      res.status(201).json(order);
    } catch (e) {
      next(e);
    }
  };

  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await service.getAll(this.parseFilters(req)));
    } catch (e) {
      next(e);
    }
  };

  getMy = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const filters = this.parseFilters(req);

      const orders = await service.getMyOrders(req.user!, filters);

      res.json(orders);
    } catch (e) {
      next(e);
    }
  };

  getAssigned = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      res.json(await service.getAssignedOrders(req.user!, this.parseFilters(req)));
    } catch (e) {
      next(e);
    }
  };

  getById = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      res.json(await service.getById(req.user!, Number(req.params.id)));
    } catch (e) {
      next(e);
    }
  };

  close = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      res.json(await service.closeOrder(req.user!, Number(req.params.id)));
    } catch (e) {
      next(e);
    }
  };

  updateStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      res.json(
        await service.updateOrderStatus(req.user!, Number(req.params.id), req.body.status)
      );
    } catch (e) {
      next(e);
    }
  };

  addPart = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      res.status(201).json(
        await service.addOrderPart(req.user!, Number(req.params.id), req.body)
      );
    } catch (e) {
      next(e);
    }
  };

  updatePart = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      res.json(
        await service.updateOrderPart(
          req.user!,
          Number(req.params.id),
          Number(req.params.partId),
          req.body
        )
      );
    } catch (e) {
      next(e);
    }
  };

  deletePart = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      res.json(
        await service.deleteOrderPart(
          req.user!,
          Number(req.params.id),
          Number(req.params.partId)
        )
      );
    } catch (e) {
      next(e);
    }
  };

  addService = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      res.status(201).json(
        await service.addOrderService(req.user!, Number(req.params.id), req.body)
      );
    } catch (e) {
      next(e);
    }
  };

  updateService = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      res.json(
        await service.updateOrderService(
          req.user!,
          Number(req.params.id),
          Number(req.params.serviceId),
          req.body
        )
      );
    } catch (e) {
      next(e);
    }
  };

  deleteService = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      res.json(
        await service.deleteOrderService(
          req.user!,
          Number(req.params.id),
          Number(req.params.serviceId)
        )
      );
    } catch (e) {
      next(e);
    }
  };

  update = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      res.json(await service.updateOrder(req.user!, Number(req.params.id), req.body));
    } catch (e) {
      next(e);
    }
  };

  delete = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      res.json(await service.deleteOrder(req.user!, Number(req.params.id)));
    } catch (e) {
      next(e);
    }
  };

  cancel = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      res.json(await service.cancelOrder(req.user!, Number(req.params.id)));
    } catch (e) {
      next(e);
    }
  };
}
