import { Request, Response, NextFunction } from 'express';
import { PartFieldService } from './part-field.service';

const service = new PartFieldService();

export class PartFieldController {

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(201).json(await service.create(req.body));
    } catch (e) {
      next(e);
    }
  }

  async getByCategory(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await service.getByCategory(Number(req.params.categoryId)));
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
