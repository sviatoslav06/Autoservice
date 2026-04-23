import { Request, Response, NextFunction } from 'express';
import { BoxService } from './box.service';

const service = new BoxService();

export class BoxController {

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(201).json(await service.create(req.body));
    } catch (e) {
      next(e);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(
        await service.getAll({
          status: typeof req.query.status === 'string' ? req.query.status : undefined,
          search: typeof req.query.search === 'string' ? req.query.search : undefined
        })
      );
    } catch (e) {
      next(e);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await service.getById(Number(req.params.id)));
    } catch (e) {
      next(e);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await service.update(Number(req.params.id), req.body));
    } catch (e) {
      next(e);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await service.delete(Number(req.params.id)));
    } catch (e) {
      next(e);
    }
  }

  async getAvailable(req: Request, res: Response, next: NextFunction) {
    try {
      const startTime =
        typeof req.query.startTime === 'string' ? new Date(req.query.startTime) : undefined;
      const durationMinutes =
        typeof req.query.durationMinutes === 'string'
          ? Number(req.query.durationMinutes)
          : undefined;

      res.json(
        await service.getAvailableBoxes({
          search: typeof req.query.search === 'string' ? req.query.search : undefined,
          startTime,
          durationMinutes: Number.isFinite(durationMinutes) ? durationMinutes : undefined,
          excludeOrderId:
            typeof req.query.excludeOrderId === 'string' &&
            Number.isFinite(Number(req.query.excludeOrderId))
              ? Number(req.query.excludeOrderId)
              : undefined
        })
      );
    } catch (e) {
      next(e);
    }
  }
}
