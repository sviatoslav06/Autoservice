import { Request, Response, NextFunction } from 'express';
import { PartService } from './part.service';

const service = new PartService();

export class PartController {

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const part = await service.create(req.body);
      res.status(201).json(part);
    } catch (e) {
      next(e);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(
        await service.getAll({
          categoryId:
            typeof req.query.categoryId === 'string' ? Number(req.query.categoryId) : undefined,
          search: typeof req.query.search === 'string' ? req.query.search : undefined,
          supplier: typeof req.query.supplier === 'string' ? req.query.supplier : undefined,
          inStockOnly: req.query.inStockOnly === 'true',
          lowStockBelow:
            typeof req.query.lowStockBelow === 'string'
              ? Number(req.query.lowStockBelow)
              : undefined
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
