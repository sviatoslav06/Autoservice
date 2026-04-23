import { Request, Response, NextFunction } from 'express';
import { ServiceService } from './service.service';

const service = new ServiceService();

export class ServiceController {

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
}
