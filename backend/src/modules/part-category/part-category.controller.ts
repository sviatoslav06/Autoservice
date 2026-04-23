import { Request, Response, NextFunction } from 'express';
import { PartCategoryService } from './part-category.service';

const service = new PartCategoryService();

export class PartCategoryController {

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(201).json(await service.create(req.body));
    } catch (e) {
      next(e);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await service.getAll());
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