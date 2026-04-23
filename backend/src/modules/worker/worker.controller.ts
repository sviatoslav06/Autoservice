import { Request, Response, NextFunction } from 'express';
import { WorkerService } from './worker.service';

const service = new WorkerService();

export class WorkerController {
  async getMechanics(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await service.getMechanics());
    } catch (e) {
      next(e);
    }
  }

  async getAvailableMechanics(req: Request, res: Response, next: NextFunction) {
    try {
      const startTime =
        typeof req.query.startTime === 'string' ? new Date(req.query.startTime) : undefined;
      const durationMinutes =
        typeof req.query.durationMinutes === 'string'
          ? Number(req.query.durationMinutes)
          : undefined;

      res.json(
        await service.getAvailableMechanics({
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
