import { Request, Response, NextFunction } from 'express';
import { AnalyticsService } from './analytics.service';

const service = new AnalyticsService();

export class AnalyticsController {
  private parseFilters(req: Request) {
    return {
      dateFrom: typeof req.query.dateFrom === 'string' ? req.query.dateFrom : undefined,
      dateTo: typeof req.query.dateTo === 'string' ? req.query.dateTo : undefined,
      clientId:
        typeof req.query.clientId === 'string' ? Number(req.query.clientId) : undefined,
      boxId: typeof req.query.boxId === 'string' ? Number(req.query.boxId) : undefined,
      workerId:
        typeof req.query.workerId === 'string' ? Number(req.query.workerId) : undefined,
      serviceId:
        typeof req.query.serviceId === 'string' ? Number(req.query.serviceId) : undefined,
      partId: typeof req.query.partId === 'string' ? Number(req.query.partId) : undefined
    };
  }

  getDashboard = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await service.getDashboard(this.parseFilters(req)));
    } catch (e) {
      next(e);
    }
  };

  getForecast = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const forecastDays =
        typeof req.query.forecastDays === 'string' ? Number(req.query.forecastDays) : 30;
      res.json(await service.getForecast(forecastDays));
    } catch (e) {
      next(e);
    }
  };
}
