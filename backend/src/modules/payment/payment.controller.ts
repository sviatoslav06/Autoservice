import { Request, Response, NextFunction } from 'express';
import { PaymentService } from './payment.service';
import { AuthRequest } from '../../middleware/auth.middleware';

const service = new PaymentService();

export class PaymentController {
  private parseFilters(req: Request) {
    return {
      orderId: typeof req.query.orderId === 'string' ? Number(req.query.orderId) : undefined,
      clientId:
        typeof req.query.clientId === 'string' ? Number(req.query.clientId) : undefined,
      paymentMethod:
        typeof req.query.paymentMethod === 'string' ? req.query.paymentMethod : undefined,
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
      paymentStatus:
        typeof req.query.paymentStatus === 'string'
          ? (req.query.paymentStatus as 'paid' | 'partially_paid' | 'unpaid')
          : undefined,
      dateFrom: typeof req.query.dateFrom === 'string' ? req.query.dateFrom : undefined,
      dateTo: typeof req.query.dateTo === 'string' ? req.query.dateTo : undefined
    };
  }

  create = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const orderId = Number(req.params.orderId);
      const payment = await service.create(req.user!, orderId, req.body);
      res.status(201).json(payment);
    } catch (e) {
      next(e);
    }
  };

  getByOrder = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const orderId = Number(req.params.orderId);
      res.json(await service.getByOrder(req.user!, orderId));
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

    getStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.json(await service.getStats(this.parseFilters(req)));
    } catch (e) {
        next(e);
    }
    };

  getFinancialOrders = async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.json(await service.getFinancialOrders(this.parseFilters(req)));
    } catch (e) {
        next(e);
    }
    };
}
